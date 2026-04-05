/**
 * 质押收益自动发放调度器
 * 当配置为自动领取模式时，每天定时发放所有用户的待领取收益
 */

import { getSupabaseClient } from '../storage/database/supabase-client';
import { generateId } from '../utils';
import { distributeReferralRewards } from '../routes/stake';

// 配置缓存
interface SchedulerConfig {
  claimMode: 'manual' | 'auto';  // 领取模式
  autoTime: number;              // 自动发放时间（小时）
}

let cachedConfig: SchedulerConfig | null = null;
let configLastFetch: number = 0;
const CONFIG_CACHE_TTL = 60000; // 配置缓存1分钟

// 记录上次执行日期，防止重复执行
let lastExecutionDate: string | null = null;

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
      'stake_reward_claim_mode',
      'stake_reward_auto_time',
    ]);

  const configMap = new Map(configs?.map(c => [c.config_key, c.config_value]));

  cachedConfig = {
    claimMode: (configMap.get('stake_reward_claim_mode') || 'manual') as 'manual' | 'auto',
    autoTime: parseInt(configMap.get('stake_reward_auto_time') || '2', 10),
  };
  
  configLastFetch = now;
  return cachedConfig;
}

/**
 * 计算并生成质押收益
 */
async function calculateAndGenerateRewards(userId: string, client: any): Promise<number> {
  const now = new Date();
  
  // 获取用户所有活跃质押
  const { data: stakes } = await client
    .from('stake_records')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (!stakes || stakes.length === 0) return 0;

  let totalNewReward = 0;

  for (const stake of stakes) {
    // 检查是否已过期
    if (stake.end_date && new Date(stake.end_date) < now) continue;

    // 检查质押是否满24小时
    const startDate = new Date(stake.start_date);
    const hoursSinceStake = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceStake < 24) continue;

    // 检查今天是否已生成收益
    const today = now.toISOString().split('T')[0];
    const { data: existingReward } = await client
      .from('stake_rewards')
      .select('id')
      .eq('stake_id', stake.id)
      .eq('reward_date', today)
      .maybeSingle();

    if (existingReward) continue;

    // 计算收益
    const stakeAmount = parseFloat(stake.amount);
    const dailyRate = parseFloat(stake.daily_rate);
    const rewardAmount = stakeAmount * dailyRate;

    // 创建收益记录
    await client.from('stake_rewards').insert({
      id: generateId(),
      user_id: userId,
      stake_id: stake.id,
      amount: rewardAmount.toFixed(8),
      reward_date: today,
      status: 'pending',
    });

    // 更新质押总收益
    const newTotalReward = parseFloat(stake.total_reward) + rewardAmount;
    await client
      .from('stake_records')
      .update({ total_reward: newTotalReward.toFixed(8) })
      .eq('id', stake.id);

    totalNewReward += rewardAmount;
  }

  return totalNewReward;
}

/**
 * 自动发放所有用户的待领取收益
 */
async function autoClaimAllRewards(): Promise<{ users: number; totalAmount: number }> {
  const client = getSupabaseClient();
  
  // 获取所有有待领取收益的用户
  const { data: pendingRewards } = await client
    .from('stake_rewards')
    .select('user_id')
    .eq('status', 'pending');

  if (!pendingRewards || pendingRewards.length === 0) {
    return { users: 0, totalAmount: 0 };
  }

  // 去重用户ID
  const userIds = [...new Set(pendingRewards.map(r => r.user_id))];
  
  let totalUsers = 0;
  let totalAmount = 0;

  for (const userId of userIds) {
    try {
      // 先计算并生成新收益
      await calculateAndGenerateRewards(userId, client);

      // 获取所有待领取收益
      const now = new Date();
      const { data: rewards } = await client
        .from('stake_rewards')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .or(`expired_at.is.null,expired_at.gt.${now.toISOString()}`);

      if (!rewards || rewards.length === 0) continue;

      const userTotal = rewards.reduce((sum, r) => sum + parseFloat(r.amount), 0);

      // 更新收益状态
      await client
        .from('stake_rewards')
        .update({
          status: 'claimed',
          claimed_at: now.toISOString(),
        })
        .in('id', rewards.map(r => r.id));

      // 增加用户余额
      const { data: asset } = await client
        .from('assets')
        .select('*')
        .eq('user_id', userId)
        .eq('token_symbol', 'AI')
        .maybeSingle();

      if (asset) {
        const newBalance = parseFloat(asset.balance) + userTotal;
        await client
          .from('assets')
          .update({ 
            balance: newBalance.toString(),
            updated_at: now.toISOString(),
          })
          .eq('id', asset.id);

        // 记录交易
        await client.from('transactions').insert({
          id: generateId(),
          user_id: userId,
          type: 'reward_auto',
          amount: userTotal.toString(),
          token_symbol: 'AI',
          balance_before: asset.balance,
          balance_after: newBalance.toString(),
          status: 'completed',
          description: '系统自动发放质押收益',
        });
      }

      // 发放推荐收益给上级
      await distributeReferralRewards(userId, userTotal, client);

      totalUsers++;
      totalAmount += userTotal;
      
      console.log(`[Stake Scheduler] Auto-claimed for user ${userId}: ${userTotal.toFixed(8)} AI`);
    } catch (error) {
      console.error(`[Stake Scheduler] Failed to auto-claim for user ${userId}:`, error);
    }
  }

  return { users: totalUsers, totalAmount };
}

// 定时任务句柄
let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * 启动定时任务
 * 每分钟检查一次是否需要自动发放
 */
export function startStakeRewardScheduler(): void {
  if (schedulerInterval) {
    console.log('[Stake Reward Scheduler] Already running');
    return;
  }

  console.log('[Stake Reward Scheduler] Starting...');

  // 立即执行一次检查
  runSchedulerCheck();

  // 每分钟执行一次检查
  schedulerInterval = setInterval(async () => {
    await runSchedulerCheck();
  }, 60000);
}

/**
 * 停止定时任务
 */
export function stopStakeRewardScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Stake Reward Scheduler] Stopped');
  }
}

/**
 * 执行调度检查
 */
async function runSchedulerCheck(): Promise<void> {
  try {
    const config = await getConfig();
    
    // 如果不是自动模式，跳过
    if (config.claimMode !== 'auto') {
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const today = now.toISOString().split('T')[0];

    // 检查是否到达自动发放时间
    if (currentHour !== config.autoTime) {
      return;
    }

    // 检查今天是否已执行
    if (lastExecutionDate === today) {
      return;
    }

    console.log(`[Stake Reward Scheduler] Starting auto-claim at ${config.autoTime}:00...`);

    // 执行自动发放
    const result = await autoClaimAllRewards();

    // 标记今天已执行
    lastExecutionDate = today;

    console.log(`[Stake Reward Scheduler] Completed: ${result.users} users, ${result.totalAmount.toFixed(8)} AI distributed`);
  } catch (error) {
    console.error('[Stake Reward Scheduler] Error:', error);
  }
}

// 导出用于手动触发
export { autoClaimAllRewards };
