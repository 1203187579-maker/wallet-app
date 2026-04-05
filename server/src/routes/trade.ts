import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { successResponse, errorResponse, generateId, checkFeatureDisabled } from '../utils';
import {
  addSubscriber,
  removeSubscriber,
  broadcastOrderbookUpdate,
  startHeartbeatCheck,
  sendHeartbeat,
  fetchOrderbookData,
  getSubscriberStats,
} from '../services/orderbook-sse';

const router = Router();

// 启动心跳检查
startHeartbeatCheck();

/**
 * 验证用户并返回用户ID和用户信息
 */
async function verifyUser(authHeader: string | undefined): Promise<{ userId: string; user: any } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const client = getSupabaseClient();

  const { data: session } = await client
    .from('user_sessions')
    .select('user_id, users(is_active, disabled_features)')
    .eq('token', token)
    .eq('is_active', true)
    .maybeSingle();

  if (!session) return null;
  
  return { userId: session.user_id, user: session.users };
}

/**
 * 获取用户资产余额
 */
async function getAssetBalance(client: any, userId: string, symbol: string): Promise<number> {
  const { data } = await client
    .from('assets')
    .select('balance')
    .eq('user_id', userId)
    .eq('token_symbol', symbol)
    .maybeSingle();

  return data ? parseFloat(data.balance) || 0 : 0;
}

/**
 * 更新或创建资产余额
 */
async function updateAssetBalance(
  client: any,
  userId: string,
  symbol: string,
  amount: number,
  operation: 'add' | 'subtract'
): Promise<boolean> {
  const currentBalance = await getAssetBalance(client, userId, symbol);
  let newBalance: number;

  if (operation === 'add') {
    newBalance = currentBalance + amount;
  } else {
    newBalance = currentBalance - amount;
    if (newBalance < 0) {
      return false;
    }
  }

  const { data: existingAsset } = await client
    .from('assets')
    .select('id')
    .eq('user_id', userId)
    .eq('token_symbol', symbol)
    .maybeSingle();

  if (existingAsset) {
    const { error } = await client
      .from('assets')
      .update({
        balance: newBalance.toFixed(8),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingAsset.id);
    return !error;
  } else {
    const { error } = await client
      .from('assets')
      .insert({
        id: generateId(),
        user_id: userId,
        token_symbol: symbol,
        balance: newBalance.toFixed(8),
      });
    return !error;
  }
}

/**
 * 获取交易手续费率
 */
async function getTradeFeeRate(client: any): Promise<number> {
  const { data } = await client
    .from('system_config')
    .select('config_value')
    .eq('config_key', 'trade_fee_rate')
    .maybeSingle();
  
  return data ? parseFloat(data.config_value) || 0 : 0;
}

/**
 * 记录交易历史
 */
async function recordTransaction(
  client: any,
  userId: string,
  type: 'buy' | 'sell',
  baseCurrency: string,
  quoteCurrency: string,
  amount: number,
  price: number,
  totalValue: number,
  fee: number = 0
): Promise<void> {
  await client.from('trade_history').insert({
    id: generateId(),
    user_id: userId,
    trade_type: type,
    base_currency: baseCurrency,
    quote_currency: quoteCurrency,
    amount: amount.toFixed(8),
    price: price.toFixed(8),
    total_value: totalValue.toFixed(8),
    fee: fee.toFixed(8),
    status: 'completed',
  });
}

/**
 * 订单撮合引擎
 * 当新订单进入时，尝试与反方向订单撮合
 */
async function matchOrder(
  client: any,
  newOrder: {
    id: string;
    user_id: string;
    order_type: 'buy' | 'sell';
    base_currency: string;
    quote_currency: string;
    amount: number;
    price: number;
  }
): Promise<{ matchedAmount: number; matchedValue: number }> {
  let totalMatchedAmount = 0;
  let totalMatchedValue = 0;

  // 获取手续费率（买卖双方各收一半）
  const totalFeeRate = await getTradeFeeRate(client);
  const halfFeeRate = totalFeeRate / 2;

  // 查找匹配的订单
  // 买单匹配：价格 >= 卖单价格的卖单，按价格从低到高
  // 卖单匹配：价格 <= 买单价格的买单，按价格从高到低
  const oppositeType = newOrder.order_type === 'buy' ? 'sell' : 'buy';
  const priceCondition = newOrder.order_type === 'buy' 
    ? `price <= ${newOrder.price}`  // 买单匹配低价卖单
    : `price >= ${newOrder.price}`; // 卖单匹配高价买单
  const priceOrder = newOrder.order_type === 'buy' ? 'price ASC' : 'price DESC';

  const { data: matchingOrders } = await client
    .from('trade_orders')
    .select('*')
    .eq('base_currency', newOrder.base_currency)
    .eq('quote_currency', newOrder.quote_currency)
    .eq('order_type', oppositeType)
    .in('status', ['open', 'partial'])
    .order(priceOrder.split(' ')[0], { ascending: priceOrder.includes('ASC') });

  if (!matchingOrders || matchingOrders.length === 0) {
    return { matchedAmount: 0, matchedValue: 0 };
  }

  let remainingAmount = newOrder.amount;

  for (const matchOrder of matchingOrders) {
    if (remainingAmount <= 0) break;

    // 再次检查价格条件（因为查询可能返回不满足条件的订单）
    const matchPrice = parseFloat(matchOrder.price);
    if (newOrder.order_type === 'buy' && matchPrice > newOrder.price) continue;
    if (newOrder.order_type === 'sell' && matchPrice < newOrder.price) continue;

    // 不能自己匹配自己
    if (matchOrder.user_id === newOrder.user_id) continue;

    const matchAvailable = parseFloat(matchOrder.amount) - parseFloat(matchOrder.filled_amount || 0);
    const fillAmount = Math.min(remainingAmount, matchAvailable);
    const fillValue = fillAmount * matchPrice;

    // 计算手续费
    const buyerFee = fillValue * halfFeeRate;  // 买方手续费（从获得的代币中扣除等值）
    const sellerFee = fillValue * halfFeeRate; // 卖方手续费（从获得的USDT中扣除）
    
    // 买方实际获得的代币数量（扣除手续费对应的代币）
    const buyerReceiveAmount = fillAmount * (1 - halfFeeRate);
    // 卖方实际获得的USDT（扣除手续费）
    const sellerReceiveValue = fillValue * (1 - halfFeeRate);

    // 更新匹配订单
    const newFilledAmount = parseFloat(matchOrder.filled_amount || 0) + fillAmount;
    const newStatus = newFilledAmount >= parseFloat(matchOrder.amount) ? 'filled' : 'partial';

    await client
      .from('trade_orders')
      .update({
        filled_amount: newFilledAmount.toFixed(8),
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchOrder.id);

    // 执行资产转移（扣除手续费）
    if (newOrder.order_type === 'buy') {
      // 买方获得代币（扣手续费），卖方获得USDT（扣手续费）
      await updateAssetBalance(client, newOrder.user_id, newOrder.base_currency, buyerReceiveAmount, 'add');
      await updateAssetBalance(client, matchOrder.user_id, newOrder.quote_currency, sellerReceiveValue, 'add');
      // 记录交易（含手续费）
      await recordTransaction(client, newOrder.user_id, 'buy', newOrder.base_currency, newOrder.quote_currency, fillAmount, matchPrice, fillValue, buyerFee);
      await recordTransaction(client, matchOrder.user_id, 'sell', newOrder.base_currency, newOrder.quote_currency, fillAmount, matchPrice, fillValue, sellerFee);
    } else {
      // 卖方获得USDT（扣手续费），买方获得代币（扣手续费）
      await updateAssetBalance(client, newOrder.user_id, newOrder.quote_currency, sellerReceiveValue, 'add');
      await updateAssetBalance(client, matchOrder.user_id, newOrder.base_currency, buyerReceiveAmount, 'add');
      // 记录交易（含手续费）
      await recordTransaction(client, newOrder.user_id, 'sell', newOrder.base_currency, newOrder.quote_currency, fillAmount, matchPrice, fillValue, sellerFee);
      await recordTransaction(client, matchOrder.user_id, 'buy', newOrder.base_currency, newOrder.quote_currency, fillAmount, matchPrice, fillValue, buyerFee);
    }

    remainingAmount -= fillAmount;
    totalMatchedAmount += fillAmount;
    totalMatchedValue += fillValue;
  }

  // === 更新最新价格 ===
  if (totalMatchedAmount > 0) {
    // 获取最新成交价
    const { data: latestTrade } = await client
      .from('trade_history')
      .select('price')
      .eq('base_currency', newOrder.base_currency)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestTrade) {
      const latestPrice = parseFloat(latestTrade.price);
      
      // 获取当前价格统计数据
      const { data: currentPriceData } = await client
        .from('token_prices')
        .select('high_24h, low_24h, volume_24h, open_24h')
        .eq('token_symbol', newOrder.base_currency)
        .maybeSingle();
      
      const currentHigh = currentPriceData?.high_24h ? parseFloat(currentPriceData.high_24h) : latestPrice;
      const currentLow = currentPriceData?.low_24h ? parseFloat(currentPriceData.low_24h) : latestPrice;
      const currentVolume = currentPriceData?.volume_24h ? parseFloat(currentPriceData.volume_24h) : 0;
      const openPrice = currentPriceData?.open_24h ? parseFloat(currentPriceData.open_24h) : latestPrice;
      
      // 更新24h统计数据
      const newHigh = Math.max(currentHigh, latestPrice);
      const newLow = Math.min(currentLow, latestPrice);
      const newVolume = currentVolume + totalMatchedAmount;
      
      // 计算涨跌幅
      const change24h = openPrice > 0 ? ((latestPrice - openPrice) / openPrice) * 100 : 0;
      
      // 更新 token_prices 表
      await client
        .from('token_prices')
        .update({
          price_usd: latestPrice.toFixed(8),
          high_24h: newHigh.toFixed(8),
          low_24h: newLow.toFixed(8),
          volume_24h: newVolume.toFixed(8),
          open_24h: openPrice.toFixed(8),
          change_24h: change24h.toFixed(4),
          updated_at: new Date().toISOString(),
        })
        .eq('token_symbol', newOrder.base_currency);

      console.log(`[Matching] 更新价格: ${newOrder.base_currency} = ${latestPrice.toFixed(4)}, 24h最高: ${newHigh.toFixed(4)}, 最低: ${newLow.toFixed(4)}, 成交量: ${newVolume.toFixed(2)}, 涨幅: ${change24h.toFixed(2)}%`);
    }
  }

  return { matchedAmount: totalMatchedAmount, matchedValue: totalMatchedValue };
}

/**
 * 创建限价挂单
 * POST /api/v1/trade/order
 * Body: { orderType: 'buy'|'sell', baseCurrency: string, amount: number, price: number }
 */
router.post('/order', async (req: Request, res: Response) => {
  try {
    const userResult = await verifyUser(req.headers.authorization);
    if (!userResult) {
      return res.status(401).json(errorResponse('未授权访问'));
    }
    
    const { userId, user } = userResult;
    
    // 检查资产功能是否被禁用
    const featureCheck = checkFeatureDisabled(user, 'asset');
    if (featureCheck.disabled) {
      return res.status(403).json(errorResponse(featureCheck.message!));
    }

    const { orderType, baseCurrency, amount, price } = req.body;

    if (!orderType || !baseCurrency || !amount || !price) {
      return res.status(400).json(errorResponse('参数不完整'));
    }

    const orderAmount = parseFloat(amount);
    const orderPrice = parseFloat(price);

    // 验证参数有效性
    if (isNaN(orderAmount) || orderAmount <= 0) {
      return res.status(400).json(errorResponse('数量必须大于0'));
    }
    if (isNaN(orderPrice) || orderPrice <= 0) {
      return res.status(400).json(errorResponse('价格必须大于0'));
    }

    const client = getSupabaseClient();

    // 检查余额
    if (orderType === 'buy') {
      // 买入需要USDT
      const requiredUsdt = orderAmount * orderPrice;
      const usdtBalance = await getAssetBalance(client, userId, 'USDT');
      if (usdtBalance < requiredUsdt) {
        return res.status(400).json(errorResponse(`USDT余额不足，需要 ${requiredUsdt.toFixed(2)} USDT`));
      }
      // 冻结USDT
      await updateAssetBalance(client, userId, 'USDT', requiredUsdt, 'subtract');
    } else {
      // 卖出需要代币
      const tokenBalance = await getAssetBalance(client, userId, baseCurrency);
      if (tokenBalance < orderAmount) {
        return res.status(400).json(errorResponse(`${baseCurrency}余额不足`));
      }
      // 冻结代币
      await updateAssetBalance(client, userId, baseCurrency, orderAmount, 'subtract');
    }

    // 创建订单
    const orderId = generateId();
    const { error: orderError } = await client
      .from('trade_orders')
      .insert({
        id: orderId,
        user_id: userId,
        order_type: orderType,
        base_currency: baseCurrency.toUpperCase(),
        quote_currency: 'USDT',
        amount: orderAmount.toFixed(8),
        price: orderPrice.toFixed(8),
        filled_amount: '0',
        status: 'open',
      });

    if (orderError) {
      // 回滚余额
      if (orderType === 'buy') {
        await updateAssetBalance(client, userId, 'USDT', orderAmount * orderPrice, 'add');
      } else {
        await updateAssetBalance(client, userId, baseCurrency, orderAmount, 'add');
      }
      throw orderError;
    }

    // 尝试撮合
    const { matchedAmount, matchedValue } = await matchOrder(client, {
      id: orderId,
      user_id: userId,
      order_type: orderType,
      base_currency: baseCurrency.toUpperCase(),
      quote_currency: 'USDT',
      amount: orderAmount,
      price: orderPrice,
    });

    // 更新订单状态
    if (matchedAmount > 0) {
      const newFilledAmount = matchedAmount;
      const newStatus = matchedAmount >= orderAmount ? 'filled' : 'partial';
      const remainingAmount = orderAmount - matchedAmount;

      await client
        .from('trade_orders')
        .update({
          filled_amount: newFilledAmount.toFixed(8),
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      // 如果部分成交，退还剩余冻结的资金
      if (newStatus === 'partial') {
        if (orderType === 'buy') {
          // 买单部分成交：退还剩余USDT
          const remainingUsdt = remainingAmount * orderPrice;
          await updateAssetBalance(client, userId, 'USDT', remainingUsdt, 'add');
        } else {
          // 卖单部分成交：退还剩余代币
          await updateAssetBalance(client, userId, baseCurrency.toUpperCase(), remainingAmount, 'add');
        }
      }
    }

    res.json({
      success: true,
      data: {
        orderId,
        orderType,
        baseCurrency,
        amount: orderAmount,
        price: orderPrice,
        matchedAmount,
        matchedValue,
        status: matchedAmount >= orderAmount ? 'filled' : (matchedAmount > 0 ? 'partial' : 'open'),
        message: matchedAmount > 0 
          ? `成功成交 ${matchedAmount.toFixed(8)} ${baseCurrency}`
          : '挂单成功，等待撮合',
      },
    });

    // === 触发订单簿实时推送 ===
    broadcastOrderbookUpdate(baseCurrency.toUpperCase());
  } catch (error) {
    console.error('创建订单失败:', error);
    res.status(500).json(errorResponse('创建订单失败'));
  }
});

/**
 * 取消挂单
 * DELETE /api/v1/trade/order/:orderId
 */
router.delete('/order/:orderId', async (req: Request, res: Response) => {
  try {
    const userResult = await verifyUser(req.headers.authorization);
    if (!userResult) {
      return res.status(401).json(errorResponse('未授权访问'));
    }
    
    const { userId, user } = userResult;
    
    // 检查资产功能是否被禁用
    const featureCheck = checkFeatureDisabled(user, 'asset');
    if (featureCheck.disabled) {
      return res.status(403).json(errorResponse(featureCheck.message!));
    }

    const { orderId } = req.params;
    const client = getSupabaseClient();

    // 查询订单
    const { data: order, error } = await client
      .from('trade_orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    if (order.status === 'filled') {
      return res.status(400).json(errorResponse('订单已完成，无法取消'));
    }

    if (order.status === 'cancelled') {
      return res.status(400).json(errorResponse('订单已取消'));
    }

    // 计算未成交数量
    const orderAmount = parseFloat(order.amount);
    const filledAmount = parseFloat(order.filled_amount || 0);
    const remainingAmount = orderAmount - filledAmount;
    const orderPrice = parseFloat(order.price);

    // 退还冻结的资金
    if (order.order_type === 'buy') {
      const refundUsdt = remainingAmount * orderPrice;
      await updateAssetBalance(client, userId, 'USDT', refundUsdt, 'add');
    } else {
      await updateAssetBalance(client, userId, order.base_currency, remainingAmount, 'add');
    }

    // 更新订单状态
    await client
      .from('trade_orders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    res.json({
      success: true,
      message: '订单已取消',
      data: {
        refundAmount: remainingAmount,
        refundCurrency: order.order_type === 'buy' ? 'USDT' : order.base_currency,
      },
    });

    // === 触发订单簿实时推送 ===
    broadcastOrderbookUpdate(order.base_currency);
  } catch (error) {
    console.error('取消订单失败:', error);
    res.status(500).json(errorResponse('取消订单失败'));
  }
});

/**
 * 获取订单簿（买卖盘深度）
 * GET /api/v1/trade/orderbook/:symbol
 * Query: limit (default 20)
 */
router.get('/orderbook/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = String(req.params.symbol).toUpperCase();
    const limit = parseInt(req.query.limit as string) || 20;
    const client = getSupabaseClient();

    // 获取买单（价格从高到低）
    const { data: bids } = await client
      .from('trade_orders')
      .select('price, amount, filled_amount')
      .eq('base_currency', symbol)
      .eq('quote_currency', 'USDT')
      .eq('order_type', 'buy')
      .in('status', ['open', 'partial'])
      .order('price', { ascending: false })
      .limit(limit);

    // 获取卖单（价格从低到高）
    const { data: asks } = await client
      .from('trade_orders')
      .select('price, amount, filled_amount')
      .eq('base_currency', symbol)
      .eq('quote_currency', 'USDT')
      .eq('order_type', 'sell')
      .in('status', ['open', 'partial'])
      .order('price', { ascending: true })
      .limit(limit);

    // 聚合相同价格
    const aggregateOrders = (orders: any[]) => {
      const priceMap = new Map<string, { price: string; amount: number; count: number }>();
      for (const order of orders || []) {
        const price = parseFloat(order.price).toFixed(8);
        const remaining = parseFloat(order.amount) - parseFloat(order.filled_amount || 0);
        if (remaining > 0) {
          if (priceMap.has(price)) {
            const existing = priceMap.get(price)!;
            existing.amount += remaining;
            existing.count += 1;
          } else {
            priceMap.set(price, { price, amount: remaining, count: 1 });
          }
        }
      }
      return Array.from(priceMap.values());
    };

    res.json({
      success: true,
      data: {
        symbol,
        bids: aggregateOrders(bids || []), // 买单
        asks: aggregateOrders(asks || []), // 卖单
      },
    });
  } catch (error) {
    console.error('获取订单簿失败:', error);
    res.status(500).json(errorResponse('获取订单簿失败'));
  }
});

/**
 * 订单簿实时推送 (SSE)
 * GET /api/v1/trade/orderbook/:symbol/stream
 */
router.get('/orderbook/:symbol/stream', async (req: Request, res: Response) => {
  const symbol = String(req.params.symbol).toUpperCase();

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-store, no-transform, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲

  // 添加订阅者
  const subscriber = addSubscriber(symbol, res);
  const stats = getSubscriberStats();
  const symbolStats = stats.find(s => s.symbol === symbol);
  console.log(`[OrderbookSSE] 新订阅: ${symbol}, 当前订阅数: ${symbolStats?.count || 1}`);

  // 发送初始数据
  try {
    const initialData = await fetchOrderbookData(symbol);
    res.write(`data: ${JSON.stringify(initialData)}\n\n`);
  } catch (error) {
    console.error('[OrderbookSSE] 发送初始数据失败:', error);
  }

  // 心跳定时器
  const heartbeatTimer = setInterval(() => {
    if (!sendHeartbeat(subscriber)) {
      clearInterval(heartbeatTimer);
      removeSubscriber(subscriber);
    }
  }, 30000);

  // 客户端断开连接时清理
  req.on('close', () => {
    clearInterval(heartbeatTimer);
    removeSubscriber(subscriber);
    console.log(`[OrderbookSSE] 订阅断开: ${symbol}`);
  });

  req.on('error', (error) => {
    console.error('[OrderbookSSE] 连接错误:', error);
    clearInterval(heartbeatTimer);
    removeSubscriber(subscriber);
  });
});

/**
 * 获取我的挂单
 * GET /api/v1/trade/my-orders
 * Query: symbol?, status?
 */
router.get('/my-orders', async (req: Request, res: Response) => {
  try {
    const userId = await verifyUser(req.headers.authorization);
    if (!userId) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const { symbol, status } = req.query;
    const client = getSupabaseClient();

    let query = client
      .from('trade_orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (symbol) {
      query = query.eq('base_currency', (symbol as string).toUpperCase());
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: orders, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: orders || [],
    });
  } catch (error) {
    console.error('获取我的订单失败:', error);
    res.status(500).json(errorResponse('获取订单失败'));
  }
});

/**
 * 获取交易历史
 * GET /api/v1/trade/history
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = await verifyUser(req.headers.authorization);
    if (!userId) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const client = getSupabaseClient();
    const { limit = '20', offset = '0' } = req.query;

    const { data, error } = await client
      .from('trade_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('获取交易历史失败:', error);
    res.status(500).json(errorResponse('获取失败'));
  }
});

/**
 * 获取交易对配置（前端用）
 * GET /api/v1/trade/pairs
 */
router.get('/pairs', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('trading_pairs')
      .select('id, base_currency, quote_currency, pair_symbol, is_trading_enabled, is_viewable, min_trade_amount')
      .eq('is_active', true)
      .order('display_order');

    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('获取交易对失败:', error);
    res.status(500).json(errorResponse('获取失败'));
  }
});

/**
 * 获取单个币种交易配置
 * GET /api/v1/trade/config/:symbol
 */
router.get('/config/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = String(req.params.symbol);
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('trading_pairs')
      .select('id, base_currency, quote_currency, pair_symbol, is_trading_enabled, is_viewable, min_trade_amount')
      .eq('base_currency', symbol.toUpperCase())
      .eq('quote_currency', 'USDT')
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;

    res.json({
      success: true,
      data: data ? {
        ...data,
        isTradingEnabled: data.is_trading_enabled,
        isViewable: data.is_viewable ?? true,
      } : {
        base_currency: symbol.toUpperCase(),
        quote_currency: 'USDT',
        isTradingEnabled: true,
        isViewable: true,
        min_trade_amount: 0.0001,
      },
    });
  } catch (error) {
    console.error('获取交易配置失败:', error);
    res.status(500).json(errorResponse('获取失败'));
  }
});

/**
 * 获取用户交易余额
 * GET /api/v1/trade/balance
 */
router.get('/balance', async (req: Request, res: Response) => {
  try {
    const userId = await verifyUser(req.headers.authorization);
    if (!userId) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const client = getSupabaseClient();

    const { data: assets, error } = await client
      .from('assets')
      .select('token_symbol, balance')
      .eq('user_id', userId);

    if (error) throw error;

    const coinBalances: Record<string, string> = {};
    let usdtBalance = '0';

    for (const asset of assets || []) {
      if (asset.token_symbol === 'USDT') {
        usdtBalance = asset.balance;
      } else {
        coinBalances[asset.token_symbol] = asset.balance;
      }
    }

    res.json({
      success: true,
      data: {
        usdtBalance,
        coinBalances,
      },
    });
  } catch (error) {
    console.error('获取余额失败:', error);
    res.status(500).json(errorResponse('获取失败'));
  }
});

/**
 * 即时交易接口（市价单，保持兼容）
 * POST /api/v1/trade/execute
 * Body: { tradeType: 'buy'|'sell', baseCurrency: string, amount: number, price: number }
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const userId = await verifyUser(req.headers.authorization);
    if (!userId) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const { tradeType, baseCurrency, amount, price } = req.body;

    if (!tradeType || !baseCurrency || !amount) {
      return res.status(400).json(errorResponse('参数错误'));
    }

    const tradeAmount = parseFloat(amount);
    const tradePrice = parseFloat(price);

    // 验证参数有效性
    if (isNaN(tradeAmount) || tradeAmount <= 0) {
      return res.status(400).json(errorResponse('数量必须大于0'));
    }
    if (isNaN(tradePrice) || tradePrice <= 0) {
      return res.status(400).json(errorResponse('价格必须大于0'));
    }

    const client = getSupabaseClient();

    // 即时交易：直接按当前价格成交
    if (tradeType === 'buy') {
      const requiredUsdt = tradeAmount * tradePrice;
      const usdtBalance = await getAssetBalance(client, userId, 'USDT');
      
      if (usdtBalance < requiredUsdt) {
        return res.status(400).json(errorResponse(`USDT余额不足，需要 ${requiredUsdt.toFixed(2)} USDT`));
      }

      await updateAssetBalance(client, userId, 'USDT', requiredUsdt, 'subtract');
      await updateAssetBalance(client, userId, baseCurrency, tradeAmount, 'add');
      await recordTransaction(client, userId, 'buy', baseCurrency, 'USDT', tradeAmount, tradePrice, requiredUsdt);

      res.json({
        success: true,
        data: {
          type: 'buy',
          symbol: baseCurrency,
          amount: tradeAmount,
          price: tradePrice,
          totalUsdt: requiredUsdt,
          message: `成功买入 ${tradeAmount} ${baseCurrency}`,
        },
      });
    } else {
      const symbolBalance = await getAssetBalance(client, userId, baseCurrency);
      
      if (symbolBalance < tradeAmount) {
        return res.status(400).json(errorResponse(`${baseCurrency}余额不足`));
      }

      const receivedUsdt = tradeAmount * tradePrice;
      await updateAssetBalance(client, userId, baseCurrency, tradeAmount, 'subtract');
      await updateAssetBalance(client, userId, 'USDT', receivedUsdt, 'add');
      await recordTransaction(client, userId, 'sell', baseCurrency, 'USDT', tradeAmount, tradePrice, receivedUsdt);

      res.json({
        success: true,
        data: {
          type: 'sell',
          symbol: baseCurrency,
          amount: tradeAmount,
          price: tradePrice,
          receivedUsdt,
          message: `成功卖出 ${tradeAmount} ${baseCurrency}，获得 ${receivedUsdt.toFixed(2)} USDT`,
        },
      });
    }
  } catch (error) {
    console.error('交易失败:', error);
    res.status(500).json(errorResponse('交易失败'));
  }
});

export default router;
