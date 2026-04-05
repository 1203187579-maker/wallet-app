import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { generateId, successResponse, errorResponse, checkFeatureDisabled } from '../utils';

const router = Router();

// 默认的灵活质押收益配置（10天循环）
const DEFAULT_FLEXIBLE_RATE_CONFIG = [
  { day: 1, rate: 0.6 },
  { day: 2, rate: 0.7 },
  { day: 3, rate: 0.8 },
  { day: 4, rate: 0.9 },
  { day: 5, rate: 1.0 },
  { day: 6, rate: 1.1 },
  { day: 7, rate: 1.2 },
  { day: 8, rate: 1.3 },
  { day: 9, rate: 1.4 },
  { day: 10, rate: 1.5 },
];

/**
 * 计算灵活质押的日收益率（从配置读取）
 * @param stakeDays 质押天数（从1开始）
 * @param rateConfig 收益配置数组
 * @returns 日收益率（小数形式，如 0.006 表示 0.6%）
 */
function getFlexibleDailyRate(stakeDays: number, rateConfig?: any[]): number {
  const config = rateConfig || DEFAULT_FLEXIBLE_RATE_CONFIG;
  // 计算在周期内的天数 (1-10)
  const cycleLength = config.length || 10;
  const dayInCycle = ((stakeDays - 1) % cycleLength) + 1;
  
  // 从配置中查找对应天的收益率
  const dayConfig = config.find((c: any) => c.day === dayInCycle);
  if (dayConfig) {
    return dayConfig.rate / 100; // 转为小数
  }
  
  // 兜底：使用默认计算
  const ratePercent = 0.5 + dayInCycle * 0.1;
  return ratePercent / 100;
}

/**
 * 计算质押天数
 * @param startDate 开始时间
 * @returns 质押天数（从1开始）
 */
function getStakeDays(startDate: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - startDate.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, days);
}

/**
 * 获取质押配置
 * GET /api/v1/stake/config
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data: configs, error } = await client
      .from('stake_config')
      .select('*')
      .eq('is_active', true)
      .order('duration_days', { ascending: true });

    if (error) throw error;

    // 为灵活质押添加收益预览
    const configsWithPreview = (configs || []).map((config: any) => {
      if (config.stake_type === 'flexible') {
        const rateConfig = config.rate_config || DEFAULT_FLEXIBLE_RATE_CONFIG;
        // 生成收益预览
        const ratePreview = rateConfig.map((c: any) => ({
          day: c.day,
          rate: c.rate.toFixed(1) + '%',
        }));
        
        // 生成描述
        const minRate = Math.min(...rateConfig.map((c: any) => c.rate));
        const maxRate = Math.max(...rateConfig.map((c: any) => c.rate));
        const cycleDescription = `每${rateConfig.length}天循环：${minRate}%→${maxRate}%`;
        
        return {
          ...config,
          rate_preview: ratePreview,
          cycle_description: cycleDescription,
          rate_config: rateConfig,
        };
      }
      return config;
    });

    res.json(successResponse({ configs: configsWithPreview }));
  } catch (error: any) {
    console.error('Get stake config error:', error);
    res.status(500).json(errorResponse(error.message || '获取质押配置失败'));
  }
});

/**
 * 获取用户质押列表
 * GET /api/v1/stake/my-stakes
 * Headers: Authorization: Bearer <token>
 */
router.get('/my-stakes', async (req: Request, res: Response) => {
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

    // 先计算并生成新的收益
    await calculateAndGenerateRewards(session.user_id, client);

    // 获取灵活质押配置
    const { data: flexibleConfig } = await client
      .from('stake_config')
      .select('rate_config')
      .eq('stake_type', 'flexible')
      .eq('is_active', true)
      .maybeSingle();
    
    const rateConfig = flexibleConfig?.rate_config || DEFAULT_FLEXIBLE_RATE_CONFIG;

    // 获取质押记录
    const { data: stakes, error } = await client
      .from('stake_records')
      .select('*')
      .eq('user_id', session.user_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 为每个活跃质押计算当前收益率和天数
    const stakesWithInfo = (stakes || []).map((stake: any) => {
      if (stake.status === 'active') {
        const stakeDays = getStakeDays(new Date(stake.start_date));
        let currentRate: number;
        
        if (stake.stake_type === 'flexible') {
          currentRate = getFlexibleDailyRate(stakeDays, rateConfig);
        } else {
          currentRate = parseFloat(stake.daily_rate) || 0.006;
        }
        
        return {
          ...stake,
          stake_days: stakeDays,
          current_rate: currentRate,
          current_rate_percent: (currentRate * 100).toFixed(2),
        };
      }
      return stake;
    });

    // 获取待领取收益（只查询有效的，未过期的）
    const now = new Date();
    const { data: pendingRewards } = await client
      .from('stake_rewards')
      .select('*')
      .eq('user_id', session.user_id)
      .eq('status', 'pending')
      .or(`expired_at.is.null,expired_at.gt.${now.toISOString()}`);

    const totalPendingReward = pendingRewards?.reduce(
      (sum, r) => sum + parseFloat(r.amount), 0
    ) || 0;

    res.json(successResponse({
      stakes: stakesWithInfo,
      pending_rewards: pendingRewards,
      total_pending_reward: totalPendingReward.toFixed(8),
    }));
  } catch (error: any) {
    console.error('Get my stakes error:', error);
    res.status(500).json(errorResponse(error.message || '获取质押列表失败'));
  }
});

/**
 * 创建质押
 * POST /api/v1/stake/create
 * Headers: Authorization: Bearer <token>
 * Body: { stake_type, amount }
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { stake_type, amount } = req.body;
    const client = getSupabaseClient();

    if (!stake_type || !amount) {
      return res.status(400).json(errorResponse('参数不完整'));
    }

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

    // 获取质押配置
    const { data: config } = await client
      .from('stake_config')
      .select('*')
      .eq('stake_type', stake_type)
      .eq('is_active', true)
      .maybeSingle();

    if (!config) {
      return res.status(400).json(errorResponse('无效的质押类型'));
    }

    const stakeAmount = parseFloat(amount);
    if (stakeAmount < parseFloat(config.min_amount)) {
      return res.status(400).json(errorResponse(`最低起投金额: ${config.min_amount}`));
    }

    // 检查余额
    const { data: asset } = await client
      .from('assets')
      .select('*')
      .eq('user_id', session.user_id)
      .eq('token_symbol', 'AI')
      .maybeSingle();

    if (!asset || parseFloat(asset.balance) < stakeAmount) {
      return res.status(400).json(errorResponse('余额不足'));
    }

    // 计算结束日期
    const startDate = new Date();
    let endDate = null;
    if (config.duration_days) {
      endDate = new Date(startDate.getTime() + config.duration_days * 24 * 60 * 60 * 1000);
    }

    // 创建质押记录
    const stakeId = generateId();
    const { error: stakeError } = await client
      .from('stake_records')
      .insert({
        id: stakeId,
        user_id: session.user_id,
        stake_type,
        amount: amount.toString(),
        daily_rate: config.daily_rate,
        start_date: startDate.toISOString(),
        end_date: endDate?.toISOString(),
        status: 'active',
      });

    if (stakeError) throw stakeError;

    // 扣除余额
    const newBalance = parseFloat(asset.balance) - stakeAmount;
    await client
      .from('assets')
      .update({ 
        balance: newBalance.toString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', asset.id);

    // 记录交易
    await client.from('transactions').insert({
      user_id: session.user_id,
      type: 'stake',
      amount: `-${amount}`,
      token_symbol: 'AI',
      balance_before: asset.balance,
      balance_after: newBalance.toString(),
      related_id: stakeId,
      status: 'completed',
    });

    // 更新推荐统计
    await updateReferralStats(session.user_id, stakeAmount, client);

    res.json(successResponse({
      stake: {
        id: stakeId,
        stake_type,
        amount,
        daily_rate: config.daily_rate,
        start_date: startDate,
        end_date: endDate,
      },
    }, '质押成功'));
  } catch (error: any) {
    console.error('Create stake error:', error);
    res.status(500).json(errorResponse(error.message || '质押失败'));
  }
});

/**
 * 计算并生成质押收益
 * 规则：
 * 1. 质押满24小时后才开始生成收益（第一天不生成）
 * 2. 每天的收益生成后，设置24小时过期时间
 * 3. 如果配置为不累计（accumulate_rewards=false），过期收益会被标记为expired
 */
async function calculateAndGenerateRewards(userId: string, client: any) {
  const now = new Date();

  // 获取所有质押配置，检查是否累计
  const { data: allConfigs } = await client
    .from('stake_config')
    .select('stake_type, rate_config, accumulate_rewards')
    .eq('is_active', true);

  // 获取灵活质押配置
  const flexibleConfig = allConfigs?.find((c: any) => c.stake_type === 'flexible');
  const rateConfig = flexibleConfig?.rate_config || DEFAULT_FLEXIBLE_RATE_CONFIG;

  // 获取所有活跃的质押记录
  const { data: activeStakes, error } = await client
    .from('stake_records')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error || !activeStakes) return { totalNewReward: 0, rewards: [] };

  // 先处理过期的收益（针对不累计的质押类型）
  for (const stake of activeStakes) {
    const stakeConfig = allConfigs?.find((c: any) => c.stake_type === stake.stake_type);
    const accumulateRewards = stakeConfig?.accumulate_rewards ?? true;

    // 如果不累计，标记过期的收益为 expired
    if (!accumulateRewards) {
      await client
        .from('stake_rewards')
        .update({ status: 'expired' })
        .eq('user_id', userId)
        .eq('stake_record_id', stake.id)
        .eq('status', 'pending')
        .lt('expired_at', now.toISOString());
    }
  }

  const rewards: any[] = [];
  let totalNewReward = 0;

  for (const stake of activeStakes) {
    const startDate = new Date(stake.start_date);
    const lastRewardDate = stake.last_reward_date ? new Date(stake.last_reward_date) : startDate;

    // 获取该质押类型的配置
    const stakeConfig = allConfigs?.find((c: any) => c.stake_type === stake.stake_type);
    const accumulateRewards = stakeConfig?.accumulate_rewards ?? true;

    // 计算质押已经过去的小时数
    const hoursSinceStart = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60);

    // 质押不满24小时，不生成收益
    if (hoursSinceStart < 24) {
      continue;
    }

    // 计算需要生成收益的天数
    // 从质押满24小时后开始计算（即第2天开始）
    // lastRewardDay: 上次发放收益是第几天（0=质押当天，1=满24小时后的第一天）
    const lastRewardDay = Math.floor((lastRewardDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    // currentDay: 当前是第几天
    const currentDay = Math.floor((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

    // 从上次发收益的下一天开始计算（满24小时后的天数）
    // day=1 表示质押满24小时后的第一天
    for (let day = lastRewardDay + 1; day <= currentDay; day++) {
      // day=0 是质押当天，不生成收益
      if (day === 0) continue;

      let dailyRate: number;

      if (stake.stake_type === 'flexible') {
        // 灵活质押：从配置读取循环收益，day从1开始
        dailyRate = getFlexibleDailyRate(day, rateConfig);
      } else {
        // 定期质押：固定利率
        dailyRate = parseFloat(stake.daily_rate) || 0.006;
      }

      const stakeAmount = parseFloat(stake.amount);
      const dayReward = stakeAmount * dailyRate;

      // 生成收益记录
      const rewardDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
      const rewardId = generateId();

      // 设置过期时间：收益生成后24小时
      // 如果不累计，设置24小时后过期；如果累计，设置一个很远的过期时间
      const expiredAt = accumulateRewards
        ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // 累计模式：1年后过期（实际不会过期）
        : new Date(now.getTime() + 24 * 60 * 60 * 1000); // 不累计模式：24小时后过期

      await client.from('stake_rewards').insert({
        id: rewardId,
        user_id: userId,
        stake_record_id: stake.id,
        amount: dayReward.toFixed(8),
        reward_date: rewardDate.toISOString(),
        status: 'pending',
        expired_at: expiredAt.toISOString(),
      });

      rewards.push({
        date: rewardDate.toISOString(),
        amount: dayReward.toFixed(8),
        rate: dailyRate * 100,
        day: day,
        expired_at: expiredAt.toISOString(),
        accumulate: accumulateRewards,
      });

      totalNewReward += dayReward;
    }

    // 更新最后收益日期
    if (currentDay > lastRewardDay) {
      await client
        .from('stake_records')
        .update({
          last_reward_date: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', stake.id);
    }
  }

  return { totalNewReward, rewards };
}

/**
 * 领取收益
 * POST /api/v1/stake/claim-rewards
 * Headers: Authorization: Bearer <token>
 */
router.post('/claim-rewards', async (req: Request, res: Response) => {
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

    // 先计算并生成新的收益（内部已处理过期逻辑）
    await calculateAndGenerateRewards(session.user_id, client);

    // 获取所有有效的待领取收益（未过期的）
    const now = new Date();
    const { data: pendingRewards, error: rewardsError } = await client
      .from('stake_rewards')
      .select('*')
      .eq('user_id', session.user_id)
      .eq('status', 'pending')
      .or(`expired_at.is.null,expired_at.gt.${now.toISOString()}`);

    if (rewardsError) throw rewardsError;

    if (!pendingRewards || pendingRewards.length === 0) {
      return res.status(400).json(errorResponse('没有待领取的收益'));
    }

    const totalReward = pendingRewards.reduce(
      (sum, r) => sum + parseFloat(r.amount), 0
    );

    // 更新收益状态
    await client
      .from('stake_rewards')
      .update({
        status: 'claimed',
        claimed_at: new Date().toISOString(),
      })
      .in('id', pendingRewards.map((r: any) => r.id));

    // 发放推荐收益给上级（领取时才发放）
    await distributeReferralRewards(session.user_id, totalReward, client);

    // 增加余额
    const { data: asset } = await client
      .from('assets')
      .select('*')
      .eq('user_id', session.user_id)
      .eq('token_symbol', 'AI')
      .maybeSingle();

    if (asset) {
      const newBalance = parseFloat(asset.balance) + totalReward;
      await client
        .from('assets')
        .update({ 
          balance: newBalance.toString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', asset.id);

      // 记录交易
      await client.from('transactions').insert({
        user_id: session.user_id,
        type: 'reward',
        amount: totalReward.toString(),
        token_symbol: 'AI',
        balance_before: asset.balance,
        balance_after: newBalance.toString(),
        status: 'completed',
      });
    }

    res.json(successResponse({
      claimed_amount: totalReward.toFixed(8),
    }, '领取成功'));
  } catch (error: any) {
    console.error('Claim rewards error:', error);
    res.status(500).json(errorResponse(error.message || '领取失败'));
  }
});

/**
 * 赎回质押（仅活期）
 * POST /api/v1/stake/redeem
 * Headers: Authorization: Bearer <token>
 * Body: { stake_id }
 */
router.post('/redeem', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { stake_id } = req.body;
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

    // 获取质押记录
    const { data: stake } = await client
      .from('stake_records')
      .select('*')
      .eq('id', stake_id)
      .eq('user_id', session.user_id)
      .eq('status', 'active')
      .maybeSingle();

    if (!stake) {
      return res.status(400).json(errorResponse('质押记录不存在或已赎回'));
    }

    // 检查是否可赎回
    if (stake.stake_type !== 'flexible') {
      const now = new Date();
      const endDate = new Date(stake.end_date);
      if (now < endDate) {
        return res.status(400).json(errorResponse('定期质押未到期，不可赎回'));
      }
    }

    // 更新质押状态
    await client
      .from('stake_records')
      .update({ 
        status: 'redeemed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', stake_id);

    // 返还本金
    const { data: asset } = await client
      .from('assets')
      .select('*')
      .eq('user_id', session.user_id)
      .eq('token_symbol', 'AI')
      .maybeSingle();

    if (asset) {
      const newBalance = parseFloat(asset.balance) + parseFloat(stake.amount);
      await client
        .from('assets')
        .update({ 
          balance: newBalance.toString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', asset.id);

      // 记录交易
      await client.from('transactions').insert({
        user_id: session.user_id,
        type: 'stake',
        amount: stake.amount,
        token_symbol: 'AI',
        balance_before: asset.balance,
        balance_after: newBalance.toString(),
        related_id: stake_id,
        note: '质押赎回',
        status: 'completed',
      });
    }

    res.json(successResponse({
      redeemed_amount: stake.amount,
    }, '赎回成功'));
  } catch (error: any) {
    console.error('Redeem stake error:', error);
    res.status(500).json(errorResponse(error.message || '赎回失败'));
  }
});

// 辅助函数：质押时更新推荐统计（不发放奖励）
// 奖励在下级领取收益时才发放
async function updateReferralStats(userId: string, stakeAmount: number, client: any) {
  // 获取用户推荐信息
  const { data: user } = await client
    .from('users')
    .select('referred_by')
    .eq('id', userId)
    .maybeSingle();

  if (!user?.referred_by) return;

  // 更新直推人的直推质押统计
  const { data: directReferrerStats } = await client
    .from('referral_stats')
    .select('*')
    .eq('user_id', user.referred_by)
    .maybeSingle();

  if (directReferrerStats) {
    await client
      .from('referral_stats')
      .update({
        direct_stake: (parseFloat(directReferrerStats.direct_stake) + stakeAmount).toString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.referred_by);
  }
}

// 辅助函数：领取收益时发放推荐收益给上级
// 规则：
// 1. 向上查找所有上级（最多10层）
// 2. 检查每个上级的直推人数是否解锁对应层级
// 3. 如果解锁了，计算奖励并发放给上级
// 4. 奖励GPU代币
export async function distributeReferralRewards(userId: string, rewardAmount: number, client: any) {
  // 获取用户推荐信息
  const { data: user } = await client
    .from('users')
    .select('referred_by')
    .eq('id', userId)
    .maybeSingle();

  if (!user?.referred_by) return;

  // 获取返佣配置
  const { data: referralConfig } = await client
    .from('referral_config')
    .select('*')
    .order('level', { ascending: true });

  if (!referralConfig || referralConfig.length === 0) return;

  // 获取最大层级配置
  const { data: maxLevelConfig } = await client
    .from('system_config')
    .select('config_value')
    .eq('config_key', 'max_referral_levels')
    .maybeSingle();

  const maxLevel = parseInt(maxLevelConfig?.config_value || '10', 10);

  // 向上遍历所有上级
  let currentUserId = userId;
  let level = 1;

  while (level <= maxLevel) {
    // 获取当前用户的推荐人
    const { data: currentUser } = await client
      .from('users')
      .select('id, referred_by')
      .eq('id', currentUserId)
      .maybeSingle();

    if (!currentUser?.referred_by) break;

    const referrerId = currentUser.referred_by;

    // 检查推荐人是否被封禁
    const { data: referrerUser } = await client
      .from('users')
      .select('is_banned')
      .eq('id', referrerId)
      .maybeSingle();

    if (referrerUser?.is_banned) {
      console.log(`[Referral] Skip banned referrer: ${referrerId}`);
      currentUserId = referrerId;
      level++;
      continue; // 跳过被封禁的推荐人，继续向上查找
    }

    // 获取推荐人的直推人数
    const { data: referrerStats } = await client
      .from('referral_stats')
      .select('direct_count')
      .eq('user_id', referrerId)
      .maybeSingle();

    const directCount = referrerStats?.direct_count || 0;

    // 获取当前层级的配置
    const levelConfig = referralConfig.find((c: any) => c.level === level);
    
    if (levelConfig) {
      const requiredDirect = levelConfig.required_direct_count || level;
      const rate = parseFloat(levelConfig.reward_rate) || 0;

      // 检查是否解锁该层级
      if (directCount >= requiredDirect && rate > 0) {
        // 计算奖励
        const referralReward = rewardAmount * rate;

        // 写入奖励记录
        await client.from('referral_rewards').insert({
          id: generateId(),
          user_id: referrerId,
          from_user_id: userId,
          level: level,
          amount: referralReward.toFixed(8),
          source_type: 'claim',
          source_id: null,
        });

        // 更新推荐人的累计奖励
        const { data: currentStats } = await client
          .from('referral_stats')
          .select('total_reward')
          .eq('user_id', referrerId)
          .maybeSingle();

        const currentTotal = parseFloat(currentStats?.total_reward || '0');
        await client
          .from('referral_stats')
          .update({
            total_reward: (currentTotal + referralReward).toFixed(8),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', referrerId);

        // 给推荐人增加GPU余额
        const { data: referrerAsset } = await client
          .from('assets')
          .select('id, balance')
          .eq('user_id', referrerId)
          .eq('token_symbol', 'GPU')
          .maybeSingle();

        if (referrerAsset) {
          const newBalance = parseFloat(referrerAsset.balance) + referralReward;
          await client
            .from('assets')
            .update({ balance: newBalance.toFixed(8) })
            .eq('id', referrerAsset.id);

          // 记录交易流水
          await client.from('transactions').insert({
            id: generateId(),
            user_id: referrerId,
            type: 'referral_reward',
            amount: referralReward.toFixed(8),
            token_symbol: 'GPU',
            status: 'completed',
            description: `L${level}层收益返佣`,
          });
        }
      }
    }

    // 继续向上查找
    currentUserId = referrerId;
    level++;
  }
}

/**
 * 获取收益记录
 * GET /api/v1/stake/reward-records
 * Headers: Authorization: Bearer <token>
 * Query: page, pageSize
 */
router.get('/reward-records', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

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

    // 获取收益记录（只返回已领取的）
    const { data: rewards, error, count } = await client
      .from('stake_rewards')
      .select('*', { count: 'exact' })
      .eq('user_id', session.user_id)
      .eq('status', 'claimed')
      .order('claimed_at', { ascending: false })
      .range(offset, offset + Number(pageSize) - 1);

    if (error) throw error;

    // 计算总收益
    const { data: allRewards } = await client
      .from('stake_rewards')
      .select('amount')
      .eq('user_id', session.user_id)
      .eq('status', 'claimed');

    const totalClaimed = (allRewards || []).reduce(
      (sum: number, r: any) => sum + parseFloat(r.amount || '0'), 0
    );

    res.json(successResponse({
      records: (rewards || []).map((r: any) => ({
        id: r.id,
        amount: r.amount,
        rewardDate: r.reward_date,
        claimedAt: r.claimed_at,
      })),
      total: count || 0,
      totalClaimed: totalClaimed.toFixed(8),
      page: Number(page),
      pageSize: Number(pageSize),
    }));
  } catch (error: any) {
    console.error('Get reward records error:', error);
    res.status(500).json(errorResponse(error.message || '获取收益记录失败'));
  }
});

export default router;
