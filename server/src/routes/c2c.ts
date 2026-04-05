import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { generateId, successResponse, errorResponse, getPaginationParams, checkFeatureDisabled } from '../utils';
import { isWithinTradingHours, getTradingHours } from '../services/c2c-scheduler';
import { sendC2COrderNotification } from '../services/email';

const router = Router();

/**
 * 获取C2C自动分配配置
 */
async function getAutoMatchConfig(client: any): Promise<{ enabled: boolean; cycleCount: number }> {
  const { data: enabledConfig } = await client
    .from('system_config')
    .select('config_value')
    .eq('config_key', 'c2c_auto_match_enabled')
    .maybeSingle();
  
  const { data: cycleConfig } = await client
    .from('system_config')
    .select('config_value')
    .eq('config_key', 'c2c_match_cycle_count')
    .maybeSingle();
  
  return {
    enabled: enabledConfig?.config_value === 'true',
    cycleCount: parseInt(cycleConfig?.config_value || '100', 10),
  };
}

/**
 * 获取下一个待分配的买单（自动分配模式）
 * 规则：
 * 1. 大单区1号 → 新人区1号 → 大单区2号 → 新人区2号 → ... 交替
 * 2. 部分成交的买单跳过（matched_count > 0）
 * 3. 轮转N个后掉头回到开头
 * 4. 如果某个区域没有买单，跳过继续下一个区域
 */
async function getNextBuyOrder(client: any, cycleCount: number): Promise<any | null> {
  // 获取所有待匹配的买单（按创建时间升序，分区排序）
  const { data: bigOrders } = await client
    .from('buy_orders')
    .select('*')
    .eq('status', 'pending')
    .eq('order_type', 'big')
    .or(`expired_at.is.null,expired_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: true })
    .limit(cycleCount);
  
  const { data: smallOrders } = await client
    .from('buy_orders')
    .select('*')
    .eq('status', 'pending')
    .eq('order_type', 'small')
    .or(`expired_at.is.null,expired_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: true })
    .limit(cycleCount);
  
  // 交替合并两个区域的订单
  const mergedOrders: any[] = [];
  const maxLen = Math.max(bigOrders?.length || 0, smallOrders?.length || 0);
  
  for (let i = 0; i < maxLen; i++) {
    // 大单区优先
    if (bigOrders && bigOrders[i]) {
      mergedOrders.push({ ...bigOrders[i], zone: 'big' });
    }
    // 然后新人区
    if (smallOrders && smallOrders[i]) {
      mergedOrders.push({ ...smallOrders[i], zone: 'small' });
    }
  }
  
  // 找到第一个未被匹配过的买单（matched_count === 0）
  const nextOrder = mergedOrders.find(order => (order.matched_count || 0) === 0);
  
  if (!nextOrder && mergedOrders.length > 0) {
    // 如果所有买单都被匹配过一轮，重置所有买单的 matched_count
    const allOrderIds = mergedOrders.map(o => o.id);
    if (allOrderIds.length > 0) {
      await client
        .from('buy_orders')
        .update({ matched_count: 0 })
        .in('id', allOrderIds);
      console.log('[C2C Auto Match] Reset matched_count for all orders, starting new cycle');
      // 返回第一个买单
      return mergedOrders[0];
    }
  }
  
  return nextOrder || null;
}

/**
 * 获取当前待分配的买单（前端展示用）
 * GET /api/v1/c2c/next-buy-order
 * Headers: Authorization: Bearer <token>
 */
router.get('/next-buy-order', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const client = getSupabaseClient();

    // 验证会话
    const { data: session } = await client
      .from('user_sessions')
      .select('user_id')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      return res.status(401).json(errorResponse('无效的 token'));
    }

    // 获取自动分配配置
    const { enabled, cycleCount } = await getAutoMatchConfig(client);
    
    if (!enabled) {
      return res.json(successResponse({ 
        autoMatchEnabled: false, 
        nextOrder: null 
      }));
    }

    // 获取下一个待分配的买单
    const nextOrder = await getNextBuyOrder(client, cycleCount);

    res.json(successResponse({
      autoMatchEnabled: true,
      nextOrder: nextOrder ? {
        id: nextOrder.id,
        amount: nextOrder.amount,
        price: nextOrder.price,
        total_price: nextOrder.total_price,
        token_symbol: nextOrder.token_symbol,
        order_type: nextOrder.order_type,
        zone: nextOrder.zone,
      } : null,
    }));
  } catch (error: any) {
    console.error('Get next buy order error:', error);
    res.status(500).json(errorResponse(error.message || '获取失败'));
  }
});

/**
 * 获取买单列表
 * GET /api/v1/c2c/buy-orders
 * Headers: Authorization: Bearer <token>
 * Query: page, limit, order_type?
 */
router.get('/buy-orders', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { order_type } = req.query;
    const { limit: requestedLimit, offset } = getPaginationParams(req.query);
    const client = getSupabaseClient();

    // 验证会话
    const { data: session } = await client
      .from('user_sessions')
      .select('user_id')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      return res.status(401).json(errorResponse('无效的 token'));
    }

    // 从系统配置获取 C2C 显示数量
    const { data: configData } = await client
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'c2c_display_count')
      .maybeSingle();
    
    // 默认显示3条，可通过后台配置
    const displayLimit = configData ? parseInt(configData.config_value, 10) || 3 : 3;
    const limit = Math.min(requestedLimit, displayLimit);

    // 构建查询
    let query = client
      .from('buy_orders')
      .select('*', { count: 'exact' })
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (order_type) {
      query = query.eq('order_type', order_type);
    }

    const { data: orders, count, error } = await query;

    if (error) throw error;

    res.json(successResponse({
      orders,
      total: count,
      page: parseInt(req.query.page as string) || 1,
      limit,
      displayLimit,
    }));
  } catch (error: any) {
    console.error('Get buy orders error:', error);
    res.status(500).json(errorResponse(error.message || '获取买单列表失败'));
  }
});

/**
 * 发布买单
 * POST /api/v1/c2c/buy-orders
 * Headers: Authorization: Bearer <token>
 * Body: { amount, price, token_symbol?, expired_hours? }
 */
router.post('/buy-orders', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { amount, price, token_symbol = 'GPU', expired_hours = 24 } = req.body;
    const client = getSupabaseClient();

    if (!amount || !price) {
      return res.status(400).json(errorResponse('参数不完整'));
    }

    // 验证会话
    const { data: session } = await client
      .from('user_sessions')
      .select('user_id, users(*)')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      return res.status(401).json(errorResponse('无效的 token'));
    }

    const user = session.users as any;
    
    // 检查资产功能是否被禁用
    const featureCheck = checkFeatureDisabled(user, 'asset');
    if (featureCheck.disabled) {
      return res.status(403).json(errorResponse(featureCheck.message!));
    }

    // 获取买家求购数量限制配置
    const { data: buyerMinConfig } = await client
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'c2c_buyer_min_amount')
      .maybeSingle();
    const { data: buyerMaxConfig } = await client
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'c2c_buyer_max_amount')
      .maybeSingle();
    const { data: maxOrdersConfig } = await client
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'c2c_max_orders_per_user')
      .maybeSingle();

    const buyerMinAmount = parseFloat(buyerMinConfig?.config_value || '0');
    const buyerMaxAmount = parseFloat(buyerMaxConfig?.config_value || '0');
    const maxOrdersPerUser = parseInt(maxOrdersConfig?.config_value || '0', 10);

    // 校验买家求购最小数量
    if (buyerMinAmount > 0 && parseFloat(amount) < buyerMinAmount) {
      return res.status(400).json(errorResponse(`求购数量不能小于 ${buyerMinAmount} GPU`));
    }

    // 校验买家求购最大数量
    if (buyerMaxAmount > 0 && parseFloat(amount) > buyerMaxAmount) {
      return res.status(400).json(errorResponse(`求购数量不能大于 ${buyerMaxAmount} GPU`));
    }

    // 校验账户挂单数限制
    if (maxOrdersPerUser > 0) {
      const { count: userOrderCount } = await client
        .from('buy_orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user_id)
        .eq('status', 'pending');
      
      if (userOrderCount && userOrderCount >= maxOrdersPerUser) {
        return res.status(400).json(errorResponse(`每个账户最多同时挂 ${maxOrdersPerUser} 个求购单`));
      }
    }

    // 获取大小单阈值配置（按数量判断）
    const { data: config } = await client
      .from('system_config')
      .select('*')
      .eq('config_key', 'c2c_big_order_threshold')
      .maybeSingle();

    const bigThreshold = parseFloat(config?.config_value || '1000');
    const orderAmount = parseFloat(amount);
    const totalPrice = orderAmount * parseFloat(price);

    // 判断大小单（按数量）
    const orderType = orderAmount >= bigThreshold ? 'big' : 'small';

    // 计算过期时间
    const expiredAt = new Date(Date.now() + expired_hours * 60 * 60 * 1000);

    // 创建买单
    const orderId = generateId();
    const { error: orderError } = await client
      .from('buy_orders')
      .insert({
        id: orderId,
        user_id: session.user_id,
        amount: amount.toString(),
        token_symbol,
        price: price.toString(),
        total_price: totalPrice.toString(),
        order_type: orderType,
        status: 'pending',
        expired_at: expiredAt.toISOString(),
      });

    if (orderError) throw orderError;

    res.json(successResponse({
      order: {
        id: orderId,
        amount,
        price,
        total_price: totalPrice,
        order_type: orderType,
        expired_at: expiredAt,
      },
    }, '买单发布成功'));
  } catch (error: any) {
    console.error('Create buy order error:', error);
    res.status(500).json(errorResponse(error.message || '发布买单失败'));
  }
});

/**
 * 出售给买单（匹配）
 * POST /api/v1/c2c/sell
 * Headers: Authorization: Bearer <token>
 * Body: { buy_order_id?, amount? }
 * - 自动分配模式：不传 buy_order_id，系统自动分配
 * - 手动选择模式：传 buy_order_id，指定买单
 */
router.post('/sell', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { buy_order_id, amount } = req.body;
    const client = getSupabaseClient();

    // 验证会话并获取用户信息
    const { data: session } = await client
      .from('user_sessions')
      .select('user_id, users(is_active, disabled_features)')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      return res.status(401).json(errorResponse('无效的 token'));
    }

    const user = session.users as any;
    
    // 检查资产功能是否被禁用
    const featureCheck = checkFeatureDisabled(user, 'asset');
    if (featureCheck.disabled) {
      return res.status(403).json(errorResponse(featureCheck.message!));
    }

    // 检查是否在交易时间内
    const withinHours = await isWithinTradingHours();
    if (!withinHours) {
      const hours = await getTradingHours();
      return res.status(400).json(errorResponse(`交易时间已结束，交易时间为 ${hours.start}:00 - ${hours.end}:00`));
    }

    // 获取自动分配配置
    const { enabled: autoMatchEnabled, cycleCount } = await getAutoMatchConfig(client);
    
    let buyOrder: any = null;
    let actualBuyOrderId: string;

    if (autoMatchEnabled && !buy_order_id) {
      // 自动分配模式：获取下一个待分配的买单
      buyOrder = await getNextBuyOrder(client, cycleCount);
      
      if (!buyOrder) {
        return res.status(400).json(errorResponse('暂无可匹配的买单'));
      }
      
      actualBuyOrderId = buyOrder.id;
      console.log(`[C2C Auto Match] Assigned buy order: ${actualBuyOrderId} (zone: ${buyOrder.zone})`);
    } else if (buy_order_id) {
      // 手动选择模式：获取指定的买单
      const { data: order } = await client
        .from('buy_orders')
        .select('*')
        .eq('id', buy_order_id)
        .eq('status', 'pending')
        .maybeSingle();
      
      if (!order) {
        return res.status(400).json(errorResponse('买单不存在或已被匹配'));
      }
      
      buyOrder = order;
      actualBuyOrderId = buy_order_id;
    } else {
      // 自动分配未开启且未指定买单
      return res.status(400).json(errorResponse('请选择要出售的买单'));
    }

    // 检查是否出售给自己的买单
    if (buyOrder.user_id === session.user_id) {
      return res.status(400).json(errorResponse('不能出售给自己的买单'));
    }

    // 检查过期
    if (buyOrder.expired_at && new Date(buyOrder.expired_at) < new Date()) {
      return res.status(400).json(errorResponse('买单已过期'));
    }

    // 必须提供出售数量
    if (!amount) {
      return res.status(400).json(errorResponse('请输入出售数量'));
    }

    const sellAmount = parseFloat(amount);
    if (isNaN(sellAmount) || sellAmount <= 0) {
      return res.status(400).json(errorResponse('出售数量无效'));
    }
    
    if (sellAmount > parseFloat(buyOrder.amount)) {
      return res.status(400).json(errorResponse('出售数量超过买单数量'));
    }

    // 获取卖家单笔最小/最大数量配置
    const { data: minConfig } = await client
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'c2c_seller_min_amount')
      .maybeSingle();
    const { data: maxConfig } = await client
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'c2c_seller_max_amount')
      .maybeSingle();

    const minAmount = parseFloat(minConfig?.config_value || '0');
    const maxAmount = parseFloat(maxConfig?.config_value || '0');

    // 校验最小数量
    if (minAmount > 0 && sellAmount < minAmount) {
      return res.status(400).json(errorResponse(`出售数量不能小于 ${minAmount} GPU`));
    }

    // 校验最大数量
    if (maxAmount > 0 && sellAmount > maxAmount) {
      return res.status(400).json(errorResponse(`出售数量不能大于 ${maxAmount} GPU`));
    }

    // 检查余额
    const { data: sellerAsset } = await client
      .from('assets')
      .select('*')
      .eq('user_id', session.user_id)
      .eq('token_symbol', buyOrder.token_symbol)
      .maybeSingle();

    if (!sellerAsset || parseFloat(sellerAsset.balance) < sellAmount) {
      return res.status(400).json(errorResponse('余额不足'));
    }

    // 获取手续费配置
    const { data: feeConfig } = await client
      .from('system_config')
      .select('*')
      .eq('config_key', 'c2c_fee_rate')
      .maybeSingle();

    const feeRate = parseFloat(feeConfig?.config_value || '0.05');
    const totalPrice = sellAmount * parseFloat(buyOrder.price);
    const fee = totalPrice * feeRate;

    // 创建订单
    const orderId = generateId();
    const { error: orderError } = await client
      .from('c2c_orders')
      .insert({
        id: orderId,
        buy_order_id: actualBuyOrderId,
        buyer_id: buyOrder.user_id,
        seller_id: session.user_id,
        amount: sellAmount.toString(),
        token_symbol: buyOrder.token_symbol,
        price: buyOrder.price,
        total_price: totalPrice.toString(),
        fee: fee.toString(),
        status: 'pending_payment',
      });

    if (orderError) throw orderError;

    // 冻结卖家资产
    const newSellerBalance = parseFloat(sellerAsset.balance) - sellAmount;
    await client
      .from('assets')
      .update({
        balance: newSellerBalance.toString(),
        frozen_balance: (parseFloat(sellerAsset.frozen_balance) + sellAmount).toString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sellerAsset.id);

    // 更新买单状态和匹配次数
    if (sellAmount >= parseFloat(buyOrder.amount)) {
      // 完全匹配
      await client
        .from('buy_orders')
        .update({ 
          status: 'matched',
          matched_count: (buyOrder.matched_count || 0) + 1,
        })
        .eq('id', actualBuyOrderId);
    } else {
      // 部分匹配，减少买单数量，标记为已匹配过（下次跳过）
      await client
        .from('buy_orders')
        .update({
          amount: (parseFloat(buyOrder.amount) - sellAmount).toString(),
          total_price: ((parseFloat(buyOrder.amount) - sellAmount) * parseFloat(buyOrder.price)).toString(),
          matched_count: (buyOrder.matched_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', actualBuyOrderId);
    }

    res.json(successResponse({
      order: {
        id: orderId,
        buy_order_id: actualBuyOrderId,
        amount: sellAmount,
        price: buyOrder.price,
        total_price: totalPrice,
        fee,
        status: 'pending_payment',
      },
    }, '匹配成功，等待买家付款'));
  } catch (error: any) {
    console.error('Sell error:', error);
    res.status(500).json(errorResponse(error.message || '出售失败'));
  }
});

/**
 * 获取我的订单
 * GET /api/v1/c2c/my-orders
 * Headers: Authorization: Bearer <token>
 * Query: page, limit, status?, role?
 */
router.get('/my-orders', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { status, role } = req.query;
    const { limit, offset } = getPaginationParams(req.query);
    const client = getSupabaseClient();

    // 验证会话
    const { data: session } = await client
      .from('user_sessions')
      .select('user_id')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      return res.status(401).json(errorResponse('无效的 token'));
    }

    // 构建查询 - 简单查询，不使用JOIN
    let query = client
      .from('c2c_orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 根据角色筛选
    if (role === 'buyer') {
      query = query.eq('buyer_id', session.user_id);
    } else if (role === 'seller') {
      query = query.eq('seller_id', session.user_id);
    } else {
      query = query.or(`buyer_id.eq.${session.user_id},seller_id.eq.${session.user_id}`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: orders, count, error } = await query;

    if (error) throw error;
    
    // 手动获取用户信息
    const userIds = [...new Set([
      ...(orders?.map((o: any) => o.buyer_id).filter(Boolean) || []),
      ...(orders?.map((o: any) => o.seller_id).filter(Boolean) || [])
    ])];
    
    const { data: users } = userIds.length > 0 ? await client
      .from('users')
      .select('id, phone, nickname, avatar_url')
      .in('id', userIds) : { data: [] };
    
    const userMap = new Map((users || []).map((u: any) => [u.id, u]));
    
    // 组装结果
    const ordersWithUsers = (orders || []).map((o: any) => ({
      ...o,
      buyer: userMap.get(o.buyer_id) || null,
      seller: userMap.get(o.seller_id) || null,
    }));

    res.json(successResponse({
      orders: ordersWithUsers,
      total: count,
      page: parseInt(req.query.page as string) || 1,
      limit,
    }));
  } catch (error: any) {
    console.error('Get my orders error:', error);
    res.status(500).json(errorResponse(error.message || '获取订单列表失败'));
  }
});

/**
 * 确认付款（买家）
 * POST /api/v1/c2c/confirm-payment
 * Headers: Authorization: Bearer <token>
 * Body: { order_id, payment_proof? }
 */
router.post('/confirm-payment', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { order_id, payment_proof } = req.body;
    const client = getSupabaseClient();

    // 验证会话
    const { data: session } = await client
      .from('user_sessions')
      .select('user_id')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      return res.status(401).json(errorResponse('无效的 token'));
    }

    // 获取订单
    const { data: order } = await client
      .from('c2c_orders')
      .select('*')
      .eq('id', order_id)
      .eq('buyer_id', session.user_id)
      .eq('status', 'pending_payment')
      .maybeSingle();

    if (!order) {
      return res.status(400).json(errorResponse('订单不存在或状态不正确'));
    }

    // 更新订单状态
    await client
      .from('c2c_orders')
      .update({
        status: 'paid',
        payment_proof,
        paid_at: new Date().toISOString(),
      })
      .eq('id', order_id);

    // 发送邮件通知卖家
    try {
      const { data: seller } = await client
        .from('users')
        .select('email, nickname')
        .eq('id', order.seller_id)
        .maybeSingle();
      
      const { data: buyer } = await client
        .from('users')
        .select('nickname')
        .eq('id', session.user_id)
        .maybeSingle();

      if (seller?.email) {
        await sendC2COrderNotification(seller.email, {
          orderId: order_id,
          status: 'paid',
          amount: order.amount,
          tokenSymbol: order.token_symbol,
          buyerName: buyer?.nickname || '买家',
        });
      }
    } catch (emailError) {
      console.error('[Email] Failed to send notification:', emailError);
    }

    res.json(successResponse(null, '已确认付款，等待卖家放币'));
  } catch (error: any) {
    console.error('Confirm payment error:', error);
    res.status(500).json(errorResponse(error.message || '确认付款失败'));
  }
});

/**
 * 放币（卖家）
 * POST /api/v1/c2c/release
 * Headers: Authorization: Bearer <token>
 * Body: { order_id }
 */
router.post('/release', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { order_id } = req.body;
    const client = getSupabaseClient();

    // 验证会话
    const { data: session } = await client
      .from('user_sessions')
      .select('user_id')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      return res.status(401).json(errorResponse('无效的 token'));
    }

    // 获取订单
    const { data: order } = await client
      .from('c2c_orders')
      .select('*')
      .eq('id', order_id)
      .eq('seller_id', session.user_id)
      .eq('status', 'paid')
      .maybeSingle();

    if (!order) {
      return res.status(400).json(errorResponse('订单不存在或状态不正确'));
    }

    // 获取买家资产
    const { data: buyerAsset } = await client
      .from('assets')
      .select('*')
      .eq('user_id', order.buyer_id)
      .eq('token_symbol', order.token_symbol)
      .maybeSingle();

    // 获取卖家冻结资产
    const { data: sellerAsset } = await client
      .from('assets')
      .select('*')
      .eq('user_id', session.user_id)
      .eq('token_symbol', order.token_symbol)
      .maybeSingle();

    // 转账给买家
    if (buyerAsset) {
      await client
        .from('assets')
        .update({
          balance: (parseFloat(buyerAsset.balance) + parseFloat(order.amount)).toString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', buyerAsset.id);
    } else {
      await client.from('assets').insert({
        user_id: order.buyer_id,
        token_symbol: order.token_symbol,
        balance: order.amount,
      });
    }

    // 解冻并扣除卖家资产
    await client
      .from('assets')
      .update({
        frozen_balance: (parseFloat(sellerAsset.frozen_balance) - parseFloat(order.amount)).toString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sellerAsset.id);

    // 更新订单状态
    await client
      .from('c2c_orders')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', order_id);

    // 删除该订单的所有聊天消息
    await client
      .from('c2c_chats')
      .delete()
      .eq('order_id', order_id);

    // 发送邮件通知买家
    try {
      const { data: buyer } = await client
        .from('users')
        .select('email, nickname')
        .eq('id', order.buyer_id)
        .maybeSingle();
      
      const { data: seller } = await client
        .from('users')
        .select('nickname')
        .eq('id', session.user_id)
        .maybeSingle();

      if (buyer?.email) {
        await sendC2COrderNotification(buyer.email, {
          orderId: order_id,
          status: 'completed',
          amount: order.amount,
          tokenSymbol: order.token_symbol,
          sellerName: seller?.nickname || '卖家',
        });
      }
    } catch (emailError) {
      console.error('[Email] Failed to send notification:', emailError);
    }

    // 记录交易
    await client.from('transactions').insert([
      {
        user_id: order.buyer_id,
        type: 'c2c_buy',
        amount: order.amount,
        token_symbol: order.token_symbol,
        balance_before: buyerAsset?.balance || '0',
        balance_after: ((parseFloat(buyerAsset?.balance || '0')) + parseFloat(order.amount)).toString(),
        related_id: order_id,
        status: 'completed',
      },
      {
        user_id: session.user_id,
        type: 'c2c_sell',
        amount: `-${order.amount}`,
        token_symbol: order.token_symbol,
        balance_before: sellerAsset.balance,
        balance_after: (parseFloat(sellerAsset.balance)).toString(),
        related_id: order_id,
        note: `手续费: ${order.fee}`,
        status: 'completed',
      },
    ]);

    res.json(successResponse(null, '放币成功，交易完成'));
  } catch (error: any) {
    console.error('Release error:', error);
    res.status(500).json(errorResponse(error.message || '放币失败'));
  }
});

/**
 * 取消订单（买家）
 * POST /api/v1/c2c/cancel
 * Headers: Authorization: Bearer <token>
 * Body: { order_id, reason? }
 */
router.post('/cancel', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { order_id, reason } = req.body;
    const client = getSupabaseClient();

    // 验证会话
    const { data: session } = await client
      .from('user_sessions')
      .select('user_id')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      return res.status(401).json(errorResponse('无效的 token'));
    }

    // 获取订单
    const { data: order } = await client
      .from('c2c_orders')
      .select('*')
      .eq('id', order_id)
      .eq('buyer_id', session.user_id)
      .eq('status', 'pending_payment')
      .maybeSingle();

    if (!order) {
      return res.status(400).json(errorResponse('订单不存在或状态不正确'));
    }

    // 获取卖家冻结资产
    const { data: sellerAsset } = await client
      .from('assets')
      .select('*')
      .eq('user_id', order.seller_id)
      .eq('token_symbol', order.token_symbol)
      .maybeSingle();

    if (sellerAsset) {
      // 解冻卖家资产
      const newFrozenBalance = parseFloat(sellerAsset.frozen_balance) - parseFloat(order.amount);
      const newBalance = parseFloat(sellerAsset.balance) + parseFloat(order.amount);
      
      await client
        .from('assets')
        .update({
          balance: newBalance.toString(),
          frozen_balance: newFrozenBalance.toString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sellerAsset.id);
    }

    // 更新订单状态
    await client
      .from('c2c_orders')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason || '买家取消',
      })
      .eq('id', order_id);

    // 删除该订单的所有聊天消息
    await client
      .from('c2c_chats')
      .delete()
      .eq('order_id', order_id);

    // 发送邮件通知卖家
    try {
      const { data: seller } = await client
        .from('users')
        .select('email, nickname')
        .eq('id', order.seller_id)
        .maybeSingle();
      
      const { data: buyer } = await client
        .from('users')
        .select('nickname')
        .eq('id', session.user_id)
        .maybeSingle();

      if (seller?.email) {
        await sendC2COrderNotification(seller.email, {
          orderId: order_id,
          status: 'cancelled',
          amount: order.amount,
          tokenSymbol: order.token_symbol,
          buyerName: buyer?.nickname || '买家',
        });
      }
    } catch (emailError) {
      console.error('[Email] Failed to send notification:', emailError);
    }

    res.json(successResponse(null, '订单已取消'));
  } catch (error: any) {
    console.error('Cancel error:', error);
    res.status(500).json(errorResponse(error.message || '取消订单失败'));
  }
});

/**
 * 获取聊天消息
 * GET /api/v1/c2c/chat/:order_id
 * Headers: Authorization: Bearer <token>
 */
router.get('/chat/:order_id', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { order_id } = req.params;
    const { limit, offset } = getPaginationParams(req.query);
    const client = getSupabaseClient();

    // 验证会话
    const { data: session } = await client
      .from('user_sessions')
      .select('user_id')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      return res.status(401).json(errorResponse('无效的 token'));
    }

    // 验证订单权限
    const { data: order } = await client
      .from('c2c_orders')
      .select('buyer_id, seller_id')
      .eq('id', order_id)
      .maybeSingle();

    if (!order || (order.buyer_id !== session.user_id && order.seller_id !== session.user_id)) {
      return res.status(403).json(errorResponse('无权访问'));
    }

    // 获取消息
    const { data: messages, error } = await client
      .from('c2c_chats')
      .select('*')
      .eq('order_id', order_id)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json(successResponse({ messages }));
  } catch (error: any) {
    console.error('Get chat messages error:', error);
    res.status(500).json(errorResponse(error.message || '获取消息失败'));
  }
});

/**
 * 发送消息
 * POST /api/v1/c2c/chat
 * Headers: Authorization: Bearer <token>
 * Body: { order_id, message, message_type? }
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { order_id, message, message_type = 'text' } = req.body;
    const client = getSupabaseClient();

    // 验证会话
    const { data: session } = await client
      .from('user_sessions')
      .select('user_id')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      return res.status(401).json(errorResponse('无效的 token'));
    }

    // 创建消息
    const messageId = generateId();
    const { error } = await client
      .from('c2c_chats')
      .insert({
        id: messageId,
        order_id,
        sender_id: session.user_id,
        message,
        message_type,
      });

    if (error) throw error;

    res.json(successResponse({ message_id: messageId }, '发送成功'));
  } catch (error: any) {
    console.error('Send message error:', error);
    res.status(500).json(errorResponse(error.message || '发送消息失败'));
  }
});

/**
 * 发起申诉（只有卖家可以）
 * POST /api/v1/c2c/appeal
 * Headers: Authorization: Bearer <token>
 * Body: { order_id, reason }
 */
router.post('/appeal', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { order_id, reason } = req.body;
    const client = getSupabaseClient();

    // 验证会话
    const { data: session } = await client
      .from('user_sessions')
      .select('user_id')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      return res.status(401).json(errorResponse('无效的 token'));
    }

    // 验证订单权限（只有卖家可以发起申诉）
    const { data: order } = await client
      .from('c2c_orders')
      .select('buyer_id, seller_id, status, amount, token_symbol')
      .eq('id', order_id)
      .maybeSingle();

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    if (order.seller_id !== session.user_id) {
      return res.status(403).json(errorResponse('只有卖家可以发起申诉'));
    }

    if (order.status !== 'paid') {
      return res.status(400).json(errorResponse('只能对已付款的订单发起申诉'));
    }

    // 更新订单状态为申诉中
    const { error: updateError } = await client
      .from('c2c_orders')
      .update({ status: 'appealing' })
      .eq('id', order_id);

    if (updateError) throw updateError;

    // 发送系统消息
    const messageId = generateId();
    await client
      .from('c2c_chats')
      .insert({
        id: messageId,
        order_id,
        sender_id: session.user_id,
        message: `卖家发起申诉: ${reason || '无原因'}`,
        message_type: 'system',
      });

    // 发送邮件通知买家
    try {
      const { data: buyer } = await client
        .from('users')
        .select('email, nickname')
        .eq('id', order.buyer_id)
        .maybeSingle();
      
      const { data: seller } = await client
        .from('users')
        .select('nickname')
        .eq('id', session.user_id)
        .maybeSingle();

      if (buyer?.email) {
        await sendC2COrderNotification(buyer.email, {
          orderId: order_id,
          status: 'appealing',
          amount: order.amount || '0',
          tokenSymbol: order.token_symbol || 'GPU',
          sellerName: seller?.nickname || '卖家',
        });
      }
    } catch (emailError) {
      console.error('[Email] Failed to send notification:', emailError);
    }

    res.json(successResponse({}, '申诉已提交'));
  } catch (error: any) {
    console.error('Appeal order error:', error);
    res.status(500).json(errorResponse(error.message || '申诉失败'));
  }
});

/**
 * 取消申诉
 * POST /api/v1/c2c/cancel-appeal
 * Headers: Authorization: Bearer <token>
 * Body: { order_id }
 */
router.post('/cancel-appeal', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { order_id } = req.body;
    const client = getSupabaseClient();

    // 验证会话
    const { data: session } = await client
      .from('user_sessions')
      .select('user_id')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      return res.status(401).json(errorResponse('无效的 token'));
    }

    // 验证订单权限（只有卖家可以取消申诉）
    const { data: order } = await client
      .from('c2c_orders')
      .select('buyer_id, seller_id, status, amount, token_symbol')
      .eq('id', order_id)
      .maybeSingle();

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    if (order.seller_id !== session.user_id) {
      return res.status(403).json(errorResponse('只有卖家可以取消申诉'));
    }

    if (order.status !== 'appealing') {
      return res.status(400).json(errorResponse('订单不在申诉状态'));
    }

    // 恢复订单状态为已付款
    const { error: updateError } = await client
      .from('c2c_orders')
      .update({ status: 'paid' })
      .eq('id', order_id);

    if (updateError) throw updateError;

    // 发送系统消息
    const messageId = generateId();
    await client
      .from('c2c_chats')
      .insert({
        id: messageId,
        order_id,
        sender_id: session.user_id,
        message: '卖家已取消申诉',
        message_type: 'system',
      });

    // 发送邮件通知买家
    try {
      const { data: buyer } = await client
        .from('users')
        .select('email, nickname')
        .eq('id', order.buyer_id)
        .maybeSingle();
      
      const { data: seller } = await client
        .from('users')
        .select('nickname')
        .eq('id', session.user_id)
        .maybeSingle();

      if (buyer?.email) {
        await sendC2COrderNotification(buyer.email, {
          orderId: order_id,
          status: 'paid', // 恢复为已付款状态
          amount: order.amount || '0',
          tokenSymbol: order.token_symbol || 'GPU',
          sellerName: seller?.nickname || '卖家',
        });
      }
    } catch (emailError) {
      console.error('[Email] Failed to send notification:', emailError);
    }

    res.json(successResponse({}, '申诉已取消'));
  } catch (error: any) {
    console.error('Cancel appeal error:', error);
    res.status(500).json(errorResponse(error.message || '取消申诉失败'));
  }
});

/**
 * 获取我的求购单
 * GET /api/v1/c2c/my-buy-orders
 * Headers: Authorization: Bearer <token>
 */
router.get('/my-buy-orders', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { limit, offset } = getPaginationParams(req.query);
    const client = getSupabaseClient();

    // 验证会话
    const { data: session } = await client
      .from('user_sessions')
      .select('user_id')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      return res.status(401).json(errorResponse('无效的 token'));
    }

    // 获取我的求购单
    const { data: orders, count, error } = await client
      .from('buy_orders')
      .select('*', { count: 'exact' })
      .eq('user_id', session.user_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json(successResponse({
      orders,
      total: count,
    }));
  } catch (error: any) {
    console.error('Get my buy orders error:', error);
    res.status(500).json(errorResponse(error.message || '获取求购单失败'));
  }
});

/**
 * 取消求购单
 * POST /api/v1/c2c/cancel-buy-order
 * Headers: Authorization: Bearer <token>
 * Body: { order_id }
 */
router.post('/cancel-buy-order', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { order_id } = req.body;
    const client = getSupabaseClient();

    // 验证会话
    const { data: session } = await client
      .from('user_sessions')
      .select('user_id, users(*)')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      return res.status(401).json(errorResponse('无效的 token'));
    }

    const user = session.users as any;
    
    // 检查资产功能是否被禁用
    const featureCheck = checkFeatureDisabled(user, 'asset');
    if (featureCheck.disabled) {
      return res.status(403).json(errorResponse(featureCheck.message!));
    }

    // 验证求购单
    const { data: buyOrder } = await client
      .from('buy_orders')
      .select('*')
      .eq('id', order_id)
      .maybeSingle();

    if (!buyOrder) {
      return res.status(404).json(errorResponse('求购单不存在'));
    }

    if (buyOrder.user_id !== session.user_id) {
      return res.status(403).json(errorResponse('无权操作'));
    }

    if (buyOrder.status !== 'pending') {
      return res.status(400).json(errorResponse('只能取消待匹配的求购单'));
    }

    // 取消求购单
    const { error: updateError } = await client
      .from('buy_orders')
      .update({ status: 'cancelled' })
      .eq('id', order_id);

    if (updateError) throw updateError;

    res.json(successResponse({}, '求购单已取消'));
  } catch (error: any) {
    console.error('Cancel buy order error:', error);
    res.status(500).json(errorResponse(error.message || '取消求购单失败'));
  }
});

/**
 * 获取申诉订单列表（管理后台用）
 * GET /api/v1/c2c/appeal-orders
 * Headers: Authorization: Bearer <admin_token>
 */
router.get('/appeal-orders', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { limit, offset } = getPaginationParams(req.query);
    const client = getSupabaseClient();

    // 验证管理员会话
    const { data: adminSession } = await client
      .from('admin_sessions')
      .select('admin_id')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!adminSession) {
      return res.status(401).json(errorResponse('无效的管理员 token'));
    }

    // 获取申诉中的订单
    const { data: orders, count, error } = await client
      .from('c2c_orders')
      .select(`
        *,
        buyer:users!c2c_orders_buyer_id_users_id_fk(id, nickname, phone),
        seller:users!c2c_orders_seller_id_users_id_fk(id, nickname, phone)
      `, { count: 'exact' })
      .eq('status', 'appealing')
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json(successResponse({
      orders,
      total: count,
    }));
  } catch (error: any) {
    console.error('Get appeal orders error:', error);
    res.status(500).json(errorResponse(error.message || '获取申诉订单失败'));
  }
});

/**
 * 处理申诉订单（管理后台用）
 * POST /api/v1/c2c/handle-appeal
 * Headers: Authorization: Bearer <token>
 * Body: { order_id, action: 'release' | 'cancel' }
 */
router.post('/handle-appeal', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { order_id, action } = req.body;
    const client = getSupabaseClient();

    if (!order_id || !action) {
      return res.status(400).json(errorResponse('参数不完整'));
    }

    if (!['release', 'cancel'].includes(action)) {
      return res.status(400).json(errorResponse('无效的操作类型'));
    }

    // 验证管理员会话
    const { data: adminSession } = await client
      .from('admin_sessions')
      .select('admin_id')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!adminSession) {
      return res.status(401).json(errorResponse('无效的管理员 token'));
    }

    // 获取订单
    const { data: order } = await client
      .from('c2c_orders')
      .select('*')
      .eq('id', order_id)
      .maybeSingle();

    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    if (order.status !== 'appealing') {
      return res.status(400).json(errorResponse('订单不在申诉状态'));
    }

    if (action === 'release') {
      // 放行 - 完成交易，将代币转给买家
      const { error: updateError } = await client
        .from('c2c_orders')
        .update({ status: 'completed' })
        .eq('id', order_id);

      if (updateError) throw updateError;

      // 删除该订单的所有聊天消息
      await client
        .from('c2c_chat_messages')
        .delete()
        .eq('order_id', order_id);

      // 将代币转给买家
      const { data: buyerAsset } = await client
        .from('assets')
        .select('*')
        .eq('user_id', order.buyer_id)
        .eq('token_symbol', order.token_symbol)
        .maybeSingle();

      if (buyerAsset) {
        const newBalance = parseFloat(buyerAsset.balance) + parseFloat(order.amount);
        await client
          .from('assets')
          .update({ balance: newBalance.toString() })
          .eq('id', buyerAsset.id);
      } else {
        // 创建买家资产
        await client
          .from('assets')
          .insert({
            id: generateId(),
            user_id: order.buyer_id,
            token_symbol: order.token_symbol,
            balance: order.amount,
            frozen_balance: '0',
          });
      }

      // 发送系统消息
      await client
        .from('c2c_chats')
        .insert({
          id: generateId(),
          order_id,
          sender_id: adminSession.admin_id,
          message: '客服已处理申诉，交易完成，代币已放行给买家',
          message_type: 'system',
        });

    } else {
      // 取消申诉 - 恢复已付款状态
      const { error: updateError } = await client
        .from('c2c_orders')
        .update({ status: 'paid' })
        .eq('id', order_id);

      if (updateError) throw updateError;

      // 发送系统消息
      await client
        .from('c2c_chats')
        .insert({
          id: generateId(),
          order_id,
          sender_id: adminSession.admin_id,
          message: '客服已取消申诉，订单恢复正常',
          message_type: 'system',
        });
    }

    res.json(successResponse({}, action === 'release' ? '已放行' : '申诉已取消'));
  } catch (error: any) {
    console.error('Handle appeal error:', error);
    res.status(500).json(errorResponse(error.message || '处理申诉失败'));
  }
});

export default router;
