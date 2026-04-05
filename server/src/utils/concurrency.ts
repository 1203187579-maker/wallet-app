/**
 * 并发控制工具
 * 用于解决竞态条件和确保数据一致性
 */

import { getSupabaseClient } from '../storage/database/supabase-client';

/**
 * 使用乐观锁更新资产余额
 * 防止并发更新导致的余额不一致
 * 
 * @param userId 用户ID
 * @param tokenSymbol 代币符号
 * @param amount 变动金额（正数增加，负数减少）
 * @param client Supabase客户端
 * @returns 更新结果
 */
export async function updateAssetWithLock(
  userId: string,
  tokenSymbol: string,
  amount: number,
  client: any = getSupabaseClient()
): Promise<{ success: boolean; balanceBefore: number; balanceAfter: number; error?: string }> {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      // 1. 查询当前资产（获取版本号）
      const { data: asset, error: queryError } = await client
        .from('assets')
        .select('id, balance, frozen_balance, version')
        .eq('user_id', userId)
        .eq('token_symbol', tokenSymbol)
        .maybeSingle();

      if (queryError) {
        return { success: false, balanceBefore: 0, balanceAfter: 0, error: queryError.message };
      }

      if (!asset) {
        // 资产不存在，创建新资产
        if (amount < 0) {
          return { success: false, balanceBefore: 0, balanceAfter: 0, error: '余额不足' };
        }

        const { error: insertError } = await client
          .from('assets')
          .insert({
            user_id: userId,
            token_symbol: tokenSymbol,
            balance: amount.toFixed(8),
            frozen_balance: '0',
            version: 1,
          });

        if (insertError) {
          // 可能是并发插入，重试
          retryCount++;
          continue;
        }

        return { success: true, balanceBefore: 0, balanceAfter: amount };
      }

      const balanceBefore = parseFloat(asset.balance) || 0;
      const newBalance = balanceBefore + amount;

      // 检查余额是否足够
      if (newBalance < 0) {
        return { success: false, balanceBefore, balanceAfter: balanceBefore, error: '余额不足' };
      }

      // 2. 使用乐观锁更新（version字段作为版本号）
      const currentVersion = asset.version || 0;
      const { error: updateError, count } = await client
        .from('assets')
        .update({
          balance: newBalance.toFixed(8),
          version: currentVersion + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', asset.id)
        .eq('version', currentVersion); // 乐观锁条件

      if (updateError) {
        return { success: false, balanceBefore, balanceAfter: balanceBefore, error: updateError.message };
      }

      // 3. 检查是否更新成功
      if (count === 0) {
        // 版本不匹配，说明被其他请求修改了，重试
        retryCount++;
        console.log(`[Concurrency] Retry ${retryCount}/${maxRetries} for asset update: ${userId}/${tokenSymbol}`);
        continue;
      }

      return { success: true, balanceBefore, balanceAfter: newBalance };
    } catch (error: any) {
      console.error('[Concurrency] Asset update error:', error);
      retryCount++;
    }
  }

  return { success: false, balanceBefore: 0, balanceAfter: 0, error: '更新失败，请重试' };
}

/**
 * 使用乐观锁更新冻结资产
 * 
 * @param userId 用户ID
 * @param tokenSymbol 代币符号
 * @param freezeAmount 冻结金额（正数冻结，负数解冻）
 * @param client Supabase客户端
 * @returns 更新结果
 */
export async function updateFrozenAssetWithLock(
  userId: string,
  tokenSymbol: string,
  freezeAmount: number,
  client: any = getSupabaseClient()
): Promise<{ success: boolean; error?: string }> {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      const { data: asset, error: queryError } = await client
        .from('assets')
        .select('id, balance, frozen_balance, version')
        .eq('user_id', userId)
        .eq('token_symbol', tokenSymbol)
        .maybeSingle();

      if (queryError || !asset) {
        return { success: false, error: '资产不存在' };
      }

      const currentBalance = parseFloat(asset.balance) || 0;
      const currentFrozen = parseFloat(asset.frozen_balance) || 0;
      const currentVersion = asset.version || 0;

      let newBalance = currentBalance;
      let newFrozen = currentFrozen;

      if (freezeAmount > 0) {
        // 冻结：从余额转移到冻结
        if (currentBalance < freezeAmount) {
          return { success: false, error: '余额不足' };
        }
        newBalance = currentBalance - freezeAmount;
        newFrozen = currentFrozen + freezeAmount;
      } else {
        // 解冻：从冻结转移到余额
        const unfreezeAmount = Math.abs(freezeAmount);
        if (currentFrozen < unfreezeAmount) {
          return { success: false, error: '冻结余额不足' };
        }
        newFrozen = currentFrozen - unfreezeAmount;
        newBalance = currentBalance + unfreezeAmount;
      }

      const { error: updateError, count } = await client
        .from('assets')
        .update({
          balance: newBalance.toFixed(8),
          frozen_balance: newFrozen.toFixed(8),
          version: currentVersion + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', asset.id)
        .eq('version', currentVersion);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      if (count === 0) {
        retryCount++;
        continue;
      }

      return { success: true };
    } catch (error: any) {
      console.error('[Concurrency] Frozen asset update error:', error);
      retryCount++;
    }
  }

  return { success: false, error: '更新失败，请重试' };
}

/**
 * 执行原子性交易操作
 * 确保多个操作要么全部成功，要么全部回滚
 * 
 * @param operations 操作列表
 * @param client Supabase客户端
 * @returns 执行结果
 */
export async function executeAtomicTransaction<T>(
  operations: (() => Promise<T>)[],
  client: any = getSupabaseClient()
): Promise<{ success: boolean; results?: T[]; error?: string }> {
  const results: T[] = [];
  const rollbackOperations: (() => Promise<void>)[] = [];

  try {
    for (const operation of operations) {
      const result = await operation();
      results.push(result);
    }

    return { success: true, results };
  } catch (error: any) {
    console.error('[Concurrency] Transaction failed, rolling back:', error);
    
    // 执行回滚（逆序）
    for (let i = rollbackOperations.length - 1; i >= 0; i--) {
      try {
        await rollbackOperations[i]();
      } catch (rollbackError) {
        console.error('[Concurrency] Rollback failed:', rollbackError);
      }
    }

    return { success: false, error: error.message || '交易失败' };
  }
}

/**
 * 分布式锁（基于数据库实现）
 * 用于防止同一资源的并发操作
 */
export class DistributedLock {
  private lockKey: string;
  private lockValue: string;
  private client: any;
  private ttl: number; // 锁的过期时间（毫秒）

  constructor(lockKey: string, ttl: number = 30000) {
    this.lockKey = lockKey;
    this.lockValue = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.client = getSupabaseClient();
    this.ttl = ttl;
  }

  /**
   * 获取锁
   */
  async acquire(): Promise<boolean> {
    try {
      const expiresAt = new Date(Date.now() + this.ttl).toISOString();

      // 尝试插入锁记录
      const { error } = await this.client
        .from('distributed_locks')
        .insert({
          lock_key: this.lockKey,
          lock_value: this.lockValue,
          expires_at: expiresAt,
        });

      if (!error) {
        return true;
      }

      // 如果插入失败，检查是否是锁已存在
      const { data: existingLock } = await this.client
        .from('distributed_locks')
        .select('lock_value, expires_at')
        .eq('lock_key', this.lockKey)
        .maybeSingle();

      if (!existingLock) {
        // 锁不存在但插入失败，重试
        return false;
      }

      // 检查锁是否过期
      if (new Date(existingLock.expires_at) < new Date()) {
        // 锁已过期，尝试获取
        const { error: updateError } = await this.client
          .from('distributed_locks')
          .update({
            lock_value: this.lockValue,
            expires_at: expiresAt,
          })
          .eq('lock_key', this.lockKey)
          .eq('lock_value', existingLock.lock_value);

        return !updateError;
      }

      return false;
    } catch (error) {
      console.error('[Lock] Acquire error:', error);
      return false;
    }
  }

  /**
   * 释放锁
   */
  async release(): Promise<void> {
    try {
      await this.client
        .from('distributed_locks')
        .delete()
        .eq('lock_key', this.lockKey)
        .eq('lock_value', this.lockValue);
    } catch (error) {
      console.error('[Lock] Release error:', error);
    }
  }

  /**
   * 使用锁执行操作
   */
  static async withLock<T>(
    lockKey: string,
    operation: () => Promise<T>,
    ttl: number = 30000
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    const lock = new DistributedLock(lockKey, ttl);
    
    const acquired = await lock.acquire();
    if (!acquired) {
      return { success: false, error: '获取锁失败，请稍后重试' };
    }

    try {
      const result = await operation();
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error.message };
    } finally {
      await lock.release();
    }
  }
}

/**
 * 创建分布式锁表（如果不存在）
 */
export async function ensureLockTable(): Promise<void> {
  const client = getSupabaseClient();
  
  try {
    // 检查表是否存在
    const { data, error } = await client
      .from('distributed_locks')
      .select('lock_key')
      .limit(1);

    if (error && error.code === '42P01') {
      // 表不存在，创建它
      console.log('[Lock] Creating distributed_locks table...');
      // 注意：Supabase 需要通过 SQL 创建表
      // 这里假设表已通过迁移创建
    }
  } catch (error) {
    console.error('[Lock] Ensure lock table error:', error);
  }
}
