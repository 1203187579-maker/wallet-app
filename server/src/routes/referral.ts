import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { successResponse, errorResponse, checkFeatureDisabled } from '../utils';

const router = Router();

/**
 * 获取推荐统计数据
 * GET /api/v1/referral/stats
 * Headers: Authorization: Bearer <token>
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
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
    
    // 检查推广收益功能是否被禁用
    const featureCheck = checkFeatureDisabled(user, 'referral');
    if (featureCheck.disabled) {
      return res.status(403).json(errorResponse(featureCheck.message!));
    }

    // 获取推荐统计
    const { data: stats } = await client
      .from('referral_stats')
      .select('*')
      .eq('user_id', session.user_id)
      .maybeSingle();

    // 获取直推用户列表
    const { data: directReferrals } = await client
      .from('users')
      .select('id, phone, nickname, avatar_url, created_at, is_kyc_verified')
      .eq('referred_by', session.user_id)
      .order('created_at', { ascending: false })
      .limit(20);

    // 获取推荐收益记录
    const { data: rewards } = await client
      .from('referral_rewards')
      .select('*')
      .eq('user_id', session.user_id)
      .order('created_at', { ascending: false })
      .limit(50);

    // 获取推荐配置
    const { data: referralConfig } = await client
      .from('referral_config')
      .select('*')
      .order('level', { ascending: true });

    // 获取级差配置
    const { data: levelConfig } = await client
      .from('level_config')
      .select('*')
      .order('min_team_stake', { ascending: true });

    res.json(successResponse({
      stats,
      direct_referrals: directReferrals,
      recent_rewards: rewards,
      referral_config: referralConfig,
      level_config: levelConfig,
    }));
  } catch (error: any) {
    console.error('Get referral stats error:', error);
    res.status(500).json(errorResponse(error.message || '获取推荐数据失败'));
  }
});

/**
 * 获取团队列表
 * GET /api/v1/referral/team
 * Headers: Authorization: Bearer <token>
 * Query: level?
 */
router.get('/team', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { level } = req.query;
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

    // 递归获取团队（简化实现，只获取直推）
    const { data: directReferrals } = await client
      .from('users')
      .select(`
        id, phone, nickname, avatar_url, created_at, is_kyc_verified,
        referral_stats(direct_count, direct_stake, team_count, team_stake)
      `)
      .eq('referred_by', session.user_id)
      .order('created_at', { ascending: false });

    res.json(successResponse({
      team: directReferrals,
    }));
  } catch (error: any) {
    console.error('Get team error:', error);
    res.status(500).json(errorResponse(error.message || '获取团队数据失败'));
  }
});

/**
 * 获取推荐收益记录
 * GET /api/v1/referral/rewards
 * Headers: Authorization: Bearer <token>
 */
router.get('/rewards', async (req: Request, res: Response) => {
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

    // 获取收益记录
    const { data: rewards, error } = await client
      .from('referral_rewards')
      .select(`
        *,
        from_user:users!referral_rewards_from_user_id_fkey(id, phone, nickname)
      `)
      .eq('user_id', session.user_id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // 计算总额
    const totalAmount = rewards?.reduce(
      (sum, r) => sum + parseFloat(r.amount), 0
    ) || 0;

    res.json(successResponse({
      rewards,
      total_amount: totalAmount.toFixed(8),
    }));
  } catch (error: any) {
    console.error('Get referral rewards error:', error);
    res.status(500).json(errorResponse(error.message || '获取收益记录失败'));
  }
});

export default router;
