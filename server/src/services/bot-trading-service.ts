/**
 * 机器人交易服务
 * 负责自动化市值管理策略执行
 */

import { getSupabaseClient } from '../storage/database/supabase-client';
import { broadcastOrderbookUpdate } from './orderbook-sse';

const BOT_USER_ID = 'bot_trading_sys_001';

interface BotConfig {
  id: string;
  token_symbol: string;
  enabled: boolean;
  strategy: string;
  buy_enabled: boolean;
  sell_enabled: boolean;
  target_price: string | null;
  price_floor: string;
  price_ceiling: string;
  max_price_change_percent: string;
  daily_buy_limit: string;
  daily_sell_limit: string;
  min_order_amount: string;
  max_order_amount: string;
  order_interval_seconds: number;
  max_open_orders: number;
  today_buy_amount: string;
  today_sell_amount: string;
  last_order_at: string | null;
}

interface PriceInfo {
  price_usd: string;
  token_symbol: string;
}

interface OrderbookData {
  bids: Array<{ price: string; amount: number; count: number }>;
  asks: Array<{ price: string; amount: number; count: number }>;
}

/**
 * 触发撮合引擎 - 在创建订单后立即尝试撮合
 */
async function triggerMatchingEngine(
  client: ReturnType<typeof getSupabaseClient>,
  newOrder: {
    id: string;
    user_id: string;
    order_type: string;
    base_currency: string;
    quote_currency: string;
    amount: number;
    price: number;
  }
): Promise<{ matchedAmount: number; matchedCount: number }> {
  let matchedAmount = 0;
  let matchedCount = 0;

  try {
    // 查找可撮合的对手方订单（价格匹配）
    const oppositeType = newOrder.order_type === 'buy' ? 'sell' : 'buy';
    
    if (newOrder.order_type === 'buy') {
      // 买单找卖单：卖价 <= 买价
      const { data: matchingOrders } = await client
        .from('trade_orders')
        .select('*')
        .eq('order_type', 'sell')
        .eq('base_currency', newOrder.base_currency)
        .eq('quote_currency', newOrder.quote_currency)
        .in('status', ['open', 'partial'])
        .lte('price', newOrder.price)
        .order('price', { ascending: true }) // 最优价格优先
        .order('created_at', { ascending: true });

      if (matchingOrders && matchingOrders.length > 0) {
        let remainingAmount = newOrder.amount;
        
        for (const order of matchingOrders) {
          if (remainingAmount <= 0) break;
          
          const availableAmount = parseFloat(order.amount) - parseFloat(order.filled_amount || 0);
          const matchAmount = Math.min(remainingAmount, availableAmount);
          const matchPrice = parseFloat(order.price);  // 确保转换为数字

          // 创建成交记录（买方）
          const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await client.from('trade_history').insert({
            id: tradeId,
            user_id: newOrder.user_id,
            trade_type: 'buy',
            base_currency: newOrder.base_currency,
            quote_currency: newOrder.quote_currency,
            amount: matchAmount.toString(),
            price: matchPrice.toString(),
            total_value: (matchAmount * matchPrice).toString(),
            status: 'completed',
            trader_type: 'bot',
            bot_id: newOrder.id,
          });

          // 创建成交记录（卖方）
          const tradeId2 = `trade_${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`;
          await client.from('trade_history').insert({
            id: tradeId2,
            user_id: order.user_id,
            trade_type: 'sell',
            base_currency: newOrder.base_currency,
            quote_currency: newOrder.quote_currency,
            amount: matchAmount.toString(),
            price: matchPrice.toString(),
            total_value: (matchAmount * matchPrice).toString(),
            status: 'completed',
            trader_type: order.trader_type || 'user',
            bot_id: order.bot_id || null,
          });

          // 更新卖单状态
          const orderFilledAmount = parseFloat(order.filled_amount || 0);
          const orderTotalAmount = parseFloat(order.amount);
          const newFilledAmount = orderFilledAmount + matchAmount;
          const newStatus = newFilledAmount >= orderTotalAmount ? 'filled' : 'partial';
          await client
            .from('trade_orders')
            .update({ filled_amount: newFilledAmount, status: newStatus })
            .eq('id', order.id);

          matchedAmount += matchAmount;
          matchedCount++;
          remainingAmount -= matchAmount;
        }

        // 更新买单状态
        const newFilledAmount = newOrder.amount - remainingAmount;
        const newStatus = newFilledAmount >= newOrder.amount ? 'filled' : 'partial';
        await client
          .from('trade_orders')
          .update({ filled_amount: newFilledAmount, status: newStatus })
          .eq('id', newOrder.id);
      }
    } else {
      // 卖单找买单：买价 >= 卖价
      const { data: matchingOrders } = await client
        .from('trade_orders')
        .select('*')
        .eq('order_type', 'buy')
        .eq('base_currency', newOrder.base_currency)
        .eq('quote_currency', newOrder.quote_currency)
        .in('status', ['open', 'partial'])
        .gte('price', newOrder.price)
        .order('price', { ascending: false }) // 最优价格优先
        .order('created_at', { ascending: true });

      if (matchingOrders && matchingOrders.length > 0) {
        let remainingAmount = newOrder.amount;
        
        for (const order of matchingOrders) {
          if (remainingAmount <= 0) break;
          
          const availableAmount = parseFloat(order.amount) - parseFloat(order.filled_amount || 0);
          const matchAmount = Math.min(remainingAmount, availableAmount);
          const matchPrice = parseFloat(order.price);  // 确保转换为数字

          // 创建成交记录（卖方）
          const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await client.from('trade_history').insert({
            id: tradeId,
            user_id: newOrder.user_id,
            trade_type: 'sell',
            base_currency: newOrder.base_currency,
            quote_currency: newOrder.quote_currency,
            amount: matchAmount.toString(),
            price: matchPrice.toString(),
            total_value: (matchAmount * matchPrice).toString(),
            status: 'completed',
            trader_type: 'bot',
            bot_id: newOrder.id,
          });

          // 创建成交记录（买方）
          const tradeId2 = `trade_${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`;
          await client.from('trade_history').insert({
            id: tradeId2,
            user_id: order.user_id,
            trade_type: 'buy',
            base_currency: newOrder.base_currency,
            quote_currency: newOrder.quote_currency,
            amount: matchAmount.toString(),
            price: matchPrice.toString(),
            total_value: (matchAmount * matchPrice).toString(),
            status: 'completed',
            trader_type: order.trader_type || 'user',
            bot_id: order.bot_id || null,
          });

          // 更新买单状态
          const orderFilledAmount = parseFloat(order.filled_amount || 0);
          const orderTotalAmount = parseFloat(order.amount);
          const newFilledAmount = orderFilledAmount + matchAmount;
          const newStatus = newFilledAmount >= orderTotalAmount ? 'filled' : 'partial';
          await client
            .from('trade_orders')
            .update({ filled_amount: newFilledAmount, status: newStatus })
            .eq('id', order.id);

          matchedAmount += matchAmount;
          matchedCount++;
          remainingAmount -= matchAmount;
        }

        // 更新卖单状态
        const newFilledAmount = newOrder.amount - remainingAmount;
        const newStatus = newFilledAmount >= newOrder.amount ? 'filled' : 'partial';
        await client
          .from('trade_orders')
          .update({ filled_amount: newFilledAmount, status: newStatus })
          .eq('id', newOrder.id);
      }
    }

    // === 更新最新价格 ===
    if (matchedAmount > 0) {
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
        const newVolume = currentVolume + matchedAmount;
        
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

        console.log(`[MatchingEngine] 更新价格: ${newOrder.base_currency} = ${latestPrice.toFixed(4)}, 24h最高: ${newHigh.toFixed(4)}, 最低: ${newLow.toFixed(4)}, 成交量: ${newVolume.toFixed(2)}, 涨幅: ${change24h.toFixed(2)}%`);
      }
    }
  } catch (error) {
    console.error('[MatchingEngine] 撮合失败:', error);
  }

  return { matchedAmount, matchedCount };
}

/**
 * 获取机器人配置
 */
export async function getActiveBotConfigs(): Promise<BotConfig[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('bot_trading_config')
    .select('*')
    .eq('enabled', true);

  if (error) {
    console.error('获取机器人配置失败:', error);
    return [];
  }
  return data || [];
}

/**
 * 获取代币当前价格
 */
export async function getTokenPrice(symbol: string): Promise<number> {
  const client = getSupabaseClient();
  const { data } = await client
    .from('token_prices')
    .select('price_usd')
    .eq('token_symbol', symbol)
    .maybeSingle();

  return data ? parseFloat(data.price_usd || '0') : 0;
}

/**
 * 获取订单簿深度
 */
export async function getOrderbook(symbol: string, limit: number = 10): Promise<OrderbookData> {
  const client = getSupabaseClient();
  
  // 获取买单
  const { data: buyOrders } = await client
    .from('trade_orders')
    .select('price, amount')
    .eq('base_currency', symbol)
    .eq('order_type', 'buy')
    .eq('status', 'open')
    .order('price', { ascending: false })
    .limit(limit);

  // 获取卖单
  const { data: sellOrders } = await client
    .from('trade_orders')
    .select('price, amount')
    .eq('base_currency', symbol)
    .eq('order_type', 'sell')
    .eq('status', 'open')
    .order('price', { ascending: true })
    .limit(limit);

  // 聚合订单
  const aggregateOrders = (orders: any[]) => {
    const map = new Map<string, { amount: number; count: number }>();
    orders?.forEach(o => {
      const price = parseFloat(o.price).toFixed(8);
      const amount = parseFloat(o.amount);
      if (map.has(price)) {
        const existing = map.get(price)!;
        existing.amount += amount;
        existing.count++;
      } else {
        map.set(price, { amount, count: 1 });
      }
    });
    return Array.from(map.entries()).map(([price, data]) => ({
      price,
      amount: data.amount,
      count: data.count,
    }));
  };

  return {
    bids: aggregateOrders(buyOrders || []),
    asks: aggregateOrders(sellOrders || []),
  };
}

/**
 * 获取机器人当前挂单数量
 */
export async function getBotOpenOrderCount(symbol: string): Promise<number> {
  const client = getSupabaseClient();
  const { count, error } = await client
    .from('trade_orders')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', BOT_USER_ID)
    .eq('base_currency', symbol)
    .eq('status', 'open');

  if (error) {
    console.error('获取机器人挂单数量失败:', error);
    return 0;
  }
  return count || 0;
}

/**
 * 执行做市策略
 */
async function executeMarketMaking(config: BotConfig): Promise<void> {
  const client = getSupabaseClient();
  const symbol = config.token_symbol;
  
  // 检查是否到达挂单间隔
  if (config.last_order_at) {
    const lastOrderTime = new Date(config.last_order_at).getTime();
    const now = Date.now();
    const intervalMs = config.order_interval_seconds * 1000;
    if (now - lastOrderTime < intervalMs) {
      return; // 未到间隔时间
    }
  }

  // 检查挂单数量
  const openOrderCount = await getBotOpenOrderCount(symbol);
  if (openOrderCount >= config.max_open_orders) {
    return; // 已达到最大挂单数
  }

  // 获取当前价格和订单簿
  const currentPrice = await getTokenPrice(symbol);
  if (currentPrice <= 0) return;

  const orderbook = await getOrderbook(symbol);
  
  // 计算买卖压力
  const totalBidAmount = orderbook.bids.reduce((sum, b) => sum + b.amount, 0);
  const totalAskAmount = orderbook.asks.reduce((sum, a) => sum + a.amount, 0);
  const pressure = totalBidAmount / (totalBidAmount + totalAskAmount + 0.001); // 买入压力比例

  // 决定交易方向
  let orderType: 'buy' | 'sell';
  let orderPrice: number;

  const priceFloor = parseFloat(config.price_floor);
  const priceCeiling = parseFloat(config.price_ceiling);
  const maxChange = parseFloat(config.max_price_change_percent) / 100;

  if (pressure < 0.4 && config.buy_enabled) {
    // 买入压力大，执行买入
    orderType = 'buy';
    orderPrice = Math.min(currentPrice * (1 + Math.random() * maxChange * 0.5), priceCeiling);
  } else if (pressure > 0.6 && config.sell_enabled) {
    // 卖出压力大，执行卖出
    orderType = 'sell';
    orderPrice = Math.max(currentPrice * (1 - Math.random() * maxChange * 0.5), priceFloor);
  } else {
    // 压力均衡，随机选择
    if (Math.random() > 0.5 && config.buy_enabled) {
      orderType = 'buy';
      orderPrice = currentPrice * (1 + (Math.random() - 0.5) * maxChange);
    } else if (config.sell_enabled) {
      orderType = 'sell';
      orderPrice = currentPrice * (1 + (Math.random() - 0.5) * maxChange);
    } else {
      return;
    }
  }

  // 确保价格在范围内
  orderPrice = Math.max(priceFloor, Math.min(priceCeiling, orderPrice));

  // 检查每日限额
  const minAmount = parseFloat(config.min_order_amount);
  const maxAmount = parseFloat(config.max_order_amount);
  const dailyLimit = orderType === 'buy' ? parseFloat(config.daily_buy_limit) : parseFloat(config.daily_sell_limit);
  const todayAmount = orderType === 'buy' ? parseFloat(config.today_buy_amount) : parseFloat(config.today_sell_amount);

  if (todayAmount >= dailyLimit) {
    return; // 已达每日限额
  }

  // 计算订单数量
  let orderAmount = minAmount + Math.random() * (maxAmount - minAmount);
  orderAmount = Math.min(orderAmount, dailyLimit - todayAmount);

  if (orderAmount < minAmount) {
    return; // 剩余额度不足
  }

  // 创建挂单
  const orderId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const { error: orderError } = await client
    .from('trade_orders')
    .insert({
      id: orderId,
      user_id: BOT_USER_ID,
      order_type: orderType,
      base_currency: symbol,
      quote_currency: 'USDT',
      amount: orderAmount,
      price: orderPrice,
      filled_amount: 0,
      status: 'open',
      trader_type: 'bot',
      bot_id: config.id,
    });

  if (orderError) {
    console.error('创建机器人挂单失败:', orderError);
    return;
  }

  // === 触发撮合引擎 ===
  const matchedResult = await triggerMatchingEngine(client, {
    id: orderId,
    user_id: BOT_USER_ID,
    order_type: orderType,
    base_currency: symbol,
    quote_currency: 'USDT',
    amount: orderAmount,
    price: orderPrice,
  });

  // 更新机器人统计
  const updateField = orderType === 'buy' ? 'today_buy_amount' : 'today_sell_amount';
  const newAmount = todayAmount + orderAmount;
  
  await client
    .from('bot_trading_config')
    .update({
      [updateField]: newAmount,
      last_order_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', config.id);

  console.log(`[BotTrading] ${orderType.toUpperCase()} ${orderAmount.toFixed(2)} ${symbol} @ ${orderPrice.toFixed(4)}, 成交: ${matchedResult.matchedAmount.toFixed(2)}`);

  // === 触发订单簿实时推送 ===
  broadcastOrderbookUpdate(symbol);
}

/**
 * 执行趋势跟踪策略
 */
async function executeTrendFollow(config: BotConfig): Promise<void> {
  const client = getSupabaseClient();
  const symbol = config.token_symbol;
  
  // 获取最近价格变化
  const { data: recentTrades } = await client
    .from('trade_history')
    .select('price, created_at')
    .eq('base_currency', symbol)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!recentTrades || recentTrades.length < 5) {
    // 数据不足，使用做市策略
    return executeMarketMaking(config);
  }

  // 计算价格趋势
  const prices = recentTrades.map(t => parseFloat(t.price));
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const recentAvg = prices.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const trend = (recentAvg - avgPrice) / avgPrice; // 正值表示上涨趋势

  const currentPrice = await getTokenPrice(symbol);
  if (currentPrice <= 0) return;

  let orderType: 'buy' | 'sell';
  let orderPrice: number;

  const priceFloor = parseFloat(config.price_floor);
  const priceCeiling = parseFloat(config.price_ceiling);
  const maxChange = parseFloat(config.max_price_change_percent) / 100;

  if (trend > 0.01 && config.buy_enabled) {
    // 上涨趋势，买入
    orderType = 'buy';
    orderPrice = currentPrice * (1 + Math.random() * maxChange * 0.3);
  } else if (trend < -0.01 && config.sell_enabled) {
    // 下跌趋势，卖出
    orderType = 'sell';
    orderPrice = currentPrice * (1 - Math.random() * maxChange * 0.3);
  } else {
    // 无明显趋势，使用做市策略
    return executeMarketMaking(config);
  }

  // 确保价格在范围内
  orderPrice = Math.max(priceFloor, Math.min(priceCeiling, orderPrice));

  // 检查限额
  const minAmount = parseFloat(config.min_order_amount);
  const maxAmount = parseFloat(config.max_order_amount);
  const dailyLimit = orderType === 'buy' ? parseFloat(config.daily_buy_limit) : parseFloat(config.daily_sell_limit);
  const todayAmount = orderType === 'buy' ? parseFloat(config.today_buy_amount) : parseFloat(config.today_sell_amount);

  if (todayAmount >= dailyLimit) return;

  let orderAmount = minAmount + Math.random() * (maxAmount - minAmount);
  orderAmount = Math.min(orderAmount, dailyLimit - todayAmount);

  if (orderAmount < minAmount) return;

  // 创建挂单
  const orderId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await client.from('trade_orders').insert({
    id: orderId,
    user_id: BOT_USER_ID,
    order_type: orderType,
    base_currency: symbol,
    quote_currency: 'USDT',
    amount: orderAmount,
    price: orderPrice,
    filled_amount: 0,
    status: 'open',
    trader_type: 'bot',
    bot_id: config.id,
  });

  // === 触发撮合引擎 ===
  const matchedResult = await triggerMatchingEngine(client, {
    id: orderId,
    user_id: BOT_USER_ID,
    order_type: orderType,
    base_currency: symbol,
    quote_currency: 'USDT',
    amount: orderAmount,
    price: orderPrice,
  });

  // 更新统计
  const updateField = orderType === 'buy' ? 'today_buy_amount' : 'today_sell_amount';
  await client
    .from('bot_trading_config')
    .update({
      [updateField]: todayAmount + orderAmount,
      last_order_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', config.id);

  console.log(`[BotTrading-Trend] ${orderType.toUpperCase()} ${orderAmount.toFixed(2)} ${symbol} @ ${orderPrice.toFixed(4)}, 成交: ${matchedResult.matchedAmount.toFixed(2)}`);

  // === 触发订单簿实时推送 ===
  broadcastOrderbookUpdate(symbol);
}

/**
 * 执行均值回归策略
 */
async function executeMeanRevert(config: BotConfig): Promise<void> {
  const client = getSupabaseClient();
  const symbol = config.token_symbol;

  const currentPrice = await getTokenPrice(symbol);
  if (currentPrice <= 0) return;

  const targetPrice = config.target_price ? parseFloat(config.target_price) : null;
  if (!targetPrice) {
    // 无目标价格，使用做市策略
    return executeMarketMaking(config);
  }

  const deviation = (currentPrice - targetPrice) / targetPrice;

  let orderType: 'buy' | 'sell';
  let orderPrice: number;

  const priceFloor = parseFloat(config.price_floor);
  const priceCeiling = parseFloat(config.price_ceiling);
  const maxChange = parseFloat(config.max_price_change_percent) / 100;

  if (deviation < -0.02 && config.buy_enabled) {
    // 价格低于目标，买入推高
    orderType = 'buy';
    orderPrice = currentPrice * (1 + Math.random() * maxChange * 0.3);
  } else if (deviation > 0.02 && config.sell_enabled) {
    // 价格高于目标，卖出压低
    orderType = 'sell';
    orderPrice = currentPrice * (1 - Math.random() * maxChange * 0.3);
  } else {
    // 价格接近目标，维持做市
    return executeMarketMaking(config);
  }

  orderPrice = Math.max(priceFloor, Math.min(priceCeiling, orderPrice));

  // 检查限额
  const minAmount = parseFloat(config.min_order_amount);
  const maxAmount = parseFloat(config.max_order_amount);
  const dailyLimit = orderType === 'buy' ? parseFloat(config.daily_buy_limit) : parseFloat(config.daily_sell_limit);
  const todayAmount = orderType === 'buy' ? parseFloat(config.today_buy_amount) : parseFloat(config.today_sell_amount);

  if (todayAmount >= dailyLimit) return;

  let orderAmount = minAmount + Math.random() * (maxAmount - minAmount);
  orderAmount = Math.min(orderAmount, dailyLimit - todayAmount);

  if (orderAmount < minAmount) return;

  // 创建挂单
  const orderId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await client.from('trade_orders').insert({
    id: orderId,
    user_id: BOT_USER_ID,
    order_type: orderType,
    base_currency: symbol,
    quote_currency: 'USDT',
    amount: orderAmount,
    price: orderPrice,
    filled_amount: 0,
    status: 'open',
    trader_type: 'bot',
    bot_id: config.id,
  });

  // === 触发撮合引擎 ===
  const matchedResult = await triggerMatchingEngine(client, {
    id: orderId,
    user_id: BOT_USER_ID,
    order_type: orderType,
    base_currency: symbol,
    quote_currency: 'USDT',
    amount: orderAmount,
    price: orderPrice,
  });

  // 更新统计
  const updateField = orderType === 'buy' ? 'today_buy_amount' : 'today_sell_amount';
  await client
    .from('bot_trading_config')
    .update({
      [updateField]: todayAmount + orderAmount,
      last_order_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', config.id);

  console.log(`[BotTrading-MeanRevert] ${orderType.toUpperCase()} ${orderAmount.toFixed(2)} ${symbol} @ ${orderPrice.toFixed(4)}, 成交: ${matchedResult.matchedAmount.toFixed(2)}`);

  // === 触发订单簿实时推送 ===
  broadcastOrderbookUpdate(symbol);
}

/**
 * 执行机器人交易策略
 */
export async function executeBotStrategy(config: BotConfig): Promise<void> {
  if (!config.enabled) return;

  switch (config.strategy) {
    case 'trend_follow':
      await executeTrendFollow(config);
      break;
    case 'mean_revert':
      await executeMeanRevert(config);
      break;
    case 'market_making':
    default:
      await executeMarketMaking(config);
      break;
  }
}

/**
 * 运行所有活跃机器人的策略
 */
export async function runAllBotStrategies(): Promise<{ success: number; failed: number }> {
  const configs = await getActiveBotConfigs();
  let success = 0;
  let failed = 0;

  for (const config of configs) {
    try {
      await executeBotStrategy(config);
      success++;
    } catch (error) {
      console.error(`执行机器人策略失败 [${config.token_symbol}]:`, error);
      failed++;
    }
  }

  return { success, failed };
}

/**
 * 重置每日统计
 */
export async function resetDailyStats(): Promise<void> {
  const client = getSupabaseClient();
  await client
    .from('bot_trading_config')
    .update({
      today_buy_amount: 0,
      today_sell_amount: 0,
      updated_at: new Date().toISOString(),
    })
    .neq('id', '');
  
  console.log('[BotTrading] 每日统计已重置');
}

/**
 * 获取交易统计快照
 */
export async function getTradingStatsSnapshot(symbol: string): Promise<{
  user: { buyAmount: number; sellAmount: number; buyValue: number; sellValue: number };
  bot: { buyAmount: number; sellAmount: number; buyValue: number; sellValue: number };
}> {
  const client = getSupabaseClient();
  
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const { data: trades } = await client
    .from('trade_history')
    .select('*')
    .eq('base_currency', symbol)
    .gte('created_at', todayStart.toISOString());

  const userTrades = trades?.filter(t => t.trader_type === 'user') || [];
  const botTrades = trades?.filter(t => t.trader_type === 'bot') || [];

  const calcStats = (tradeList: any[]) => {
    const buys = tradeList.filter(t => t.trade_type === 'buy');
    const sells = tradeList.filter(t => t.trade_type === 'sell');
    return {
      buyAmount: buys.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0),
      sellAmount: sells.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0),
      buyValue: buys.reduce((sum, t) => sum + parseFloat(t.total_value || '0'), 0),
      sellValue: sells.reduce((sum, t) => sum + parseFloat(t.total_value || '0'), 0),
    };
  };

  return {
    user: calcStats(userTrades),
    bot: calcStats(botTrades),
  };
}
