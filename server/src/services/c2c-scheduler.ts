/**
 * C2C订单定时任务服务
 * 处理：
 * 1. 买家超时未付款自动取消
 * 2. 卖家超时未放行自动放行
 */

import { getSupabaseClient } from '../storage/database/supabase-client';
import { sendC2COrderNotification } from './email';

// 配置缓存
interface SchedulerConfig {
  paymentTimeoutMinutes: number;  // 付款超时时间（分钟）
  releaseTimeoutMinutes: number;  // 放行超时时间（分钟）
  tradingStartHour: number;       // 交易开始时间（小时）
  tradingEndHour: number;         // 交易结束时间（小时）
}

let cachedConfig: SchedulerConfig | null = null;
let configLastFetch: number = 0;
const CONFIG_CACHE_TTL = 60000; // 配置缓存1分钟

// 获取配置
async function getConfig(): Promise<SchedulerConfig> {
  const now = Date.now();
  
  // 使用缓存
  if (cachedConfig && (now - configLastFetch) < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }

  const client = getSupabaseClient();
  
  const { data: configs } = await client
    .from('system_config')
    .select('config_key, config_value')
    .in('config_key', [
      'c2c_payment_timeout_minutes',
      'c2c_release_timeout_minutes',
      'c2c_trading_start_hour',
      'c2c_trading_end_hour',
    ]);

  const configMap = new Map(configs?.map(c => [c.config_key, c.config_value]));

  cachedConfig = {
    paymentTimeoutMinutes: parseInt(configMap.get('c2c_payment_timeout_minutes') || '30', 10),
    releaseTimeoutMinutes: parseInt(configMap.get('c2c_release_timeout_minutes') || '30', 10),
    tradingStartHour: parseInt(configMap.get('c2c_trading_start_hour') || '9', 10),
    tradingEndHour: parseInt(configMap.get('c2c_trading_end_hour') || '21', 10),
  };
  
  configLastFetch = now;
  return cachedConfig;
}

/**
 * 检查是否在交易时间内
 */
export async function isWithinTradingHours(): Promise<boolean> {
  const config = await getConfig();
  const now = new Date();
  const currentHour = now.getHours();
  
  return currentHour >= config.tradingStartHour && currentHour < config.tradingEndHour;
}

/**
 * 获取交易时间配置
 */
export async function getTradingHours(): Promise<{ start: number; end: number }> {
  const config = await getConfig();
  return { start: config.tradingStartHour, end: config.tradingEndHour };
}

/**
 * 处理超时未付款订单 - 自动取消
 */
async function cancelUnpaidOrders(): Promise<number> {
  const config = await getConfig();
  const client = getSupabaseClient();
  
  const timeoutThreshold = new Date(Date.now() - config.paymentTimeoutMinutes * 60 * 1000);
  
  // 查找超时未付款的订单
  const { data: orders, error } = await client
    .from('c2c_orders')
    .select('*')
    .eq('status', 'pending_payment')
    .lt('created_at', timeoutThreshold.toISOString());

  if (error || !orders || orders.length === 0) {
    return 0;
  }

  console.log(`[C2C Scheduler] Found ${orders.length} unpaid orders to cancel`);

  let cancelledCount = 0;

  for (const order of orders) {
    try {
      // 解冻并退还卖家资产
      const { data: sellerAsset } = await client
        .from('assets')
        .select('*')
        .eq('user_id', order.seller_id)
        .eq('token_symbol', order.token_symbol)
        .maybeSingle();

      if (sellerAsset) {
        const newFrozenBalance = parseFloat(sellerAsset.frozen_balance) - parseFloat(order.amount);
        const newBalance = parseFloat(sellerAsset.balance) + parseFloat(order.amount);
        
        await client
          .from('assets')
          .update({
            balance: newBalance.toString(),
            frozen_balance: Math.max(0, newFrozenBalance).toString(),
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
          cancel_reason: '买家超时未付款，系统自动取消',
        })
        .eq('id', order.id);

      // 发送邮件通知卖家
      try {
        const { data: seller } = await client
          .from('users')
          .select('email, nickname')
          .eq('id', order.seller_id)
          .maybeSingle();

        if (seller?.email) {
          await sendC2COrderNotification(seller.email, {
            orderId: order.id,
            status: 'cancelled',
            amount: order.amount,
            tokenSymbol: order.token_symbol,
            buyerName: '买家',
          });
        }
      } catch (emailError) {
        console.error('[C2C Scheduler] Failed to send email:', emailError);
      }

      cancelledCount++;
      console.log(`[C2C Scheduler] Cancelled unpaid order: ${order.id}`);
    } catch (error) {
      console.error(`[C2C Scheduler] Failed to cancel order ${order.id}:`, error);
    }
  }

  return cancelledCount;
}

/**
 * 处理超时未放行订单 - 自动放行
 */
async function autoReleaseOrders(): Promise<number> {
  const config = await getConfig();
  const client = getSupabaseClient();
  
  const timeoutThreshold = new Date(Date.now() - config.releaseTimeoutMinutes * 60 * 1000);
  
  // 查找超时未放行的订单（已付款状态）
  const { data: orders, error } = await client
    .from('c2c_orders')
    .select('*')
    .eq('status', 'paid')
    .lt('paid_at', timeoutThreshold.toISOString());

  if (error || !orders || orders.length === 0) {
    return 0;
  }

  console.log(`[C2C Scheduler] Found ${orders.length} paid orders to auto-release`);

  let releasedCount = 0;

  for (const order of orders) {
    try {
      // 获取买家资产
      const { data: buyerAsset } = await client
        .from('assets')
        .select('*')
        .eq('user_id', order.buyer_id)
        .eq('token_symbol', order.token_symbol)
        .maybeSingle();

      // 更新或创建买家资产
      if (buyerAsset) {
        const newBalance = parseFloat(buyerAsset.balance) + parseFloat(order.amount);
        await client
          .from('assets')
          .update({
            balance: newBalance.toString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', buyerAsset.id);
      } else {
        await client
          .from('assets')
          .insert({
            id: crypto.randomUUID(),
            user_id: order.buyer_id,
            token_symbol: order.token_symbol,
            balance: order.amount,
            frozen_balance: '0',
          });
      }

      // 解冻并扣除卖家资产
      const { data: sellerAsset } = await client
        .from('assets')
        .select('*')
        .eq('user_id', order.seller_id)
        .eq('token_symbol', order.token_symbol)
        .maybeSingle();

      if (sellerAsset) {
        const newFrozenBalance = parseFloat(sellerAsset.frozen_balance) - parseFloat(order.amount);
        await client
          .from('assets')
          .update({
            frozen_balance: Math.max(0, newFrozenBalance).toString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', sellerAsset.id);
      }

      // 更新订单状态
      await client
        .from('c2c_orders')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          auto_released: true,
        })
        .eq('id', order.id);

      // 发送邮件通知
      try {
        const { data: buyer } = await client
          .from('users')
          .select('email, nickname')
          .eq('id', order.buyer_id)
          .maybeSingle();
        
        const { data: seller } = await client
          .from('users')
          .select('email, nickname')
          .eq('id', order.seller_id)
          .maybeSingle();

        // 通知买家
        if (buyer?.email) {
          await sendC2COrderNotification(buyer.email, {
            orderId: order.id,
            status: 'completed',
            amount: order.amount,
            tokenSymbol: order.token_symbol,
            sellerName: seller?.nickname || '卖家',
          });
        }

        // 通知卖家
        if (seller?.email) {
          await sendC2COrderNotification(seller.email, {
            orderId: order.id,
            status: 'completed',
            amount: order.amount,
            tokenSymbol: order.token_symbol,
            buyerName: buyer?.nickname || '买家',
          });
        }
      } catch (emailError) {
        console.error('[C2C Scheduler] Failed to send email:', emailError);
      }

      releasedCount++;
      console.log(`[C2C Scheduler] Auto-released order: ${order.id}`);
    } catch (error) {
      console.error(`[C2C Scheduler] Failed to auto-release order ${order.id}:`, error);
    }
  }

  return releasedCount;
}

// 定时任务句柄
let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * 启动定时任务
 * 每分钟检查一次
 */
export function startC2CScheduler(): void {
  if (schedulerInterval) {
    console.log('[C2C Scheduler] Already running');
    return;
  }

  console.log('[C2C Scheduler] Starting...');

  // 立即执行一次
  runSchedulerTasks();

  // 每分钟执行一次
  schedulerInterval = setInterval(async () => {
    await runSchedulerTasks();
  }, 60000);
}

/**
 * 停止定时任务
 */
export function stopC2CScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[C2C Scheduler] Stopped');
  }
}

/**
 * 执行定时任务
 */
async function runSchedulerTasks(): Promise<void> {
  try {
    console.log('[C2C Scheduler] Running tasks...');

    // 检查是否在交易时间内
    const withinHours = await isWithinTradingHours();
    
    if (!withinHours) {
      console.log('[C2C Scheduler] Outside trading hours, skipping');
      return;
    }

    // 处理超时未付款订单
    const cancelledCount = await cancelUnpaidOrders();
    
    // 处理超时未放行订单
    const releasedCount = await autoReleaseOrders();

    if (cancelledCount > 0 || releasedCount > 0) {
      console.log(`[C2C Scheduler] Completed: ${cancelledCount} cancelled, ${releasedCount} released`);
    }
  } catch (error) {
    console.error('[C2C Scheduler] Error running tasks:', error);
  }
}

// 导出用于手动触发
export { cancelUnpaidOrders, autoReleaseOrders };
