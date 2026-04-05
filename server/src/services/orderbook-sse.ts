/**
 * 订单簿实时推送管理器
 * 使用 SSE (Server-Sent Events) 实现订单簿实时更新
 */

import type { Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';

// 订阅者信息
interface OrderbookSubscriber {
  res: Response;
  symbol: string;
  lastPing: number;
}

// 全局订阅管理
const subscribers = new Map<string, Set<OrderbookSubscriber>>();

// 心跳间隔（30秒）
const HEARTBEAT_INTERVAL = 30000;

/**
 * 获取订单簿数据
 */
async function fetchOrderbookData(symbol: string, limit: number = 20) {
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

  // 获取最新成交价
  const { data: latestTrade } = await client
    .from('trade_history')
    .select('price')
    .eq('base_currency', symbol)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 获取24h统计数据
  const { data: priceData } = await client
    .from('token_prices')
    .select('high_24h, low_24h, volume_24h, price_usd, change_24h')
    .eq('token_symbol', symbol)
    .maybeSingle();

  return {
    symbol,
    bids: aggregateOrders(bids || []),
    asks: aggregateOrders(asks || []),
    lastPrice: latestTrade ? parseFloat(latestTrade.price) : null,
    // 24h统计数据
    priceUsd: priceData?.price_usd ? parseFloat(priceData.price_usd) : null,
    high24h: priceData?.high_24h ? parseFloat(priceData.high_24h) : null,
    low24h: priceData?.low_24h ? parseFloat(priceData.low_24h) : null,
    volume24h: priceData?.volume_24h ? parseFloat(priceData.volume_24h) : null,
    change24h: priceData?.change_24h ? parseFloat(priceData.change_24h) : null,
    timestamp: Date.now(),
  };
}

/**
 * 添加订阅者
 */
export function addSubscriber(symbol: string, res: Response): OrderbookSubscriber {
  const subscriber: OrderbookSubscriber = {
    res,
    symbol: symbol.toUpperCase(),
    lastPing: Date.now(),
  };

  const symbolKey = symbol.toUpperCase();
  if (!subscribers.has(symbolKey)) {
    subscribers.set(symbolKey, new Set());
  }
  subscribers.get(symbolKey)!.add(subscriber);

  return subscriber;
}

/**
 * 移除订阅者
 */
export function removeSubscriber(subscriber: OrderbookSubscriber) {
  const symbolKey = subscriber.symbol;
  const set = subscribers.get(symbolKey);
  if (set) {
    set.delete(subscriber);
    if (set.size === 0) {
      subscribers.delete(symbolKey);
    }
  }
}

/**
 * 广播订单簿更新到指定代币的所有订阅者
 */
export async function broadcastOrderbookUpdate(symbol: string) {
  const symbolKey = symbol.toUpperCase();
  const set = subscribers.get(symbolKey);

  if (!set || set.size === 0) {
    return;
  }

  try {
    const data = await fetchOrderbookData(symbolKey);
    const message = `data: ${JSON.stringify(data)}\n\n`;

    const deadSubscribers: OrderbookSubscriber[] = [];

    for (const subscriber of set) {
      try {
        subscriber.res.write(message);
        subscriber.lastPing = Date.now();
      } catch (error) {
        // 连接已断开，标记为删除
        deadSubscribers.push(subscriber);
      }
    }

    // 清理断开的连接
    for (const dead of deadSubscribers) {
      removeSubscriber(dead);
    }
  } catch (error) {
    console.error('[OrderbookSSE] 广播失败:', error);
  }
}

/**
 * 发送心跳
 */
export function sendHeartbeat(subscriber: OrderbookSubscriber): boolean {
  try {
    subscriber.res.write(': heartbeat\n\n');
    subscriber.lastPing = Date.now();
    return true;
  } catch {
    return false;
  }
}

/**
 * 启动心跳检查（定期清理无响应的连接）
 */
let heartbeatTimer: NodeJS.Timeout | null = null;

export function startHeartbeatCheck() {
  if (heartbeatTimer) return;

  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    const timeout = HEARTBEAT_INTERVAL * 2;

    for (const [symbol, set] of subscribers) {
      const deadSubscribers: OrderbookSubscriber[] = [];

      for (const subscriber of set) {
        if (now - subscriber.lastPing > timeout) {
          deadSubscribers.push(subscriber);
        }
      }

      for (const dead of deadSubscribers) {
        try {
          dead.res.end();
        } catch {}
        removeSubscriber(dead);
      }
    }
  }, HEARTBEAT_INTERVAL);
}

/**
 * 获取当前订阅统计
 */
export function getSubscriberStats(): { symbol: string; count: number }[] {
  const stats: { symbol: string; count: number }[] = [];
  for (const [symbol, set] of subscribers) {
    stats.push({ symbol, count: set.size });
  }
  return stats;
}

// 导出获取订单簿数据函数供外部使用
export { fetchOrderbookData };
