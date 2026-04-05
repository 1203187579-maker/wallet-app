import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { successResponse, errorResponse, getPaginationParams, checkFeatureDisabled } from '../utils';

const router = Router();

/**
 * 获取用户资产列表
 * GET /api/v1/assets
 * Headers: Authorization: Bearer <token>
 */
router.get('/', async (req: Request, res: Response) => {
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
    
    // 检查资产功能是否被禁用
    const featureCheck = checkFeatureDisabled(user, 'asset');
    if (featureCheck.disabled) {
      return res.status(403).json(errorResponse(featureCheck.message!));
    }

    // 获取资产列表
    const { data: assets, error } = await client
      .from('assets')
      .select('*')
      .eq('user_id', session.user_id);

    if (error) throw error;

    // 获取代币价格
    const symbols = assets?.map(a => a.token_symbol) || [];
    const { data: prices } = await client
      .from('token_prices')
      .select('*')
      .in('token_symbol', symbols);

    const priceMap = new Map(prices?.map(p => [p.token_symbol, p]));

    // 计算总价值
    let totalValueUsd = 0;
    const assetsWithValue = assets?.map(asset => {
      const price = priceMap.get(asset.token_symbol);
      const balance = parseFloat(asset.balance) || 0;
      const priceUsd = parseFloat(price?.price_usd) || 0;
      const valueUsd = balance * priceUsd;
      totalValueUsd += valueUsd;
      return {
        ...asset,
        price_usd: price?.price_usd || '0',
        change_24h: price?.change_24h || '0',
        value_usd: valueUsd.toFixed(2),
      };
    });

    res.json(successResponse({
      assets: assetsWithValue,
      total_value_usd: totalValueUsd.toFixed(2),
    }));
  } catch (error: any) {
    console.error('Get assets error:', error);
    res.status(500).json(errorResponse(error.message || '获取资产列表失败'));
  }
});

/**
 * 获取交易记录
 * GET /api/v1/assets/transactions
 * Headers: Authorization: Bearer <token>
 * Query: page, limit, type?
 */
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { type } = req.query;
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

    // 构建查询
    let query = client
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', session.user_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq('type', type);
    }

    const { data: transactions, count, error } = await query;

    if (error) throw error;

    res.json(successResponse({
      transactions,
      total: count,
      page: parseInt(req.query.page as string) || 1,
      limit,
    }));
  } catch (error: any) {
    console.error('Get transactions error:', error);
    res.status(500).json(errorResponse(error.message || '获取交易记录失败'));
  }
});

/**
 * 平台内转账
 * POST /api/v1/assets/transfer
 * Headers: Authorization: Bearer <token>
 * Body: { to_address, amount, token_symbol }
 */
router.post('/transfer', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { to_address, amount, token_symbol } = req.body;
    const client = getSupabaseClient();

    if (!to_address || !amount || !token_symbol) {
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

    // 查找目标用户
    const { data: toWallet } = await client
      .from('wallets')
      .select('user_id')
      .eq('address', to_address)
      .maybeSingle();

    if (!toWallet) {
      return res.status(400).json(errorResponse('目标地址不存在'));
    }

    if (toWallet.user_id === session.user_id) {
      return res.status(400).json(errorResponse('不能转账给自己'));
    }

    // 检查余额
    const { data: fromAsset } = await client
      .from('assets')
      .select('*')
      .eq('user_id', session.user_id)
      .eq('token_symbol', token_symbol)
      .maybeSingle();

    if (!fromAsset || parseFloat(fromAsset.balance) < parseFloat(amount)) {
      return res.status(400).json(errorResponse('余额不足'));
    }

    // 获取目标用户资产
    const { data: toAsset } = await client
      .from('assets')
      .select('*')
      .eq('user_id', toWallet.user_id)
      .eq('token_symbol', token_symbol)
      .maybeSingle();

    // 开始转账
    const transferAmount = parseFloat(amount);
    const newFromBalance = parseFloat(fromAsset.balance) - transferAmount;
    const newToBalance = toAsset 
      ? parseFloat(toAsset.balance) + transferAmount 
      : transferAmount;

    // 更新转出方余额
    await client
      .from('assets')
      .update({ 
        balance: newFromBalance.toString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', fromAsset.id);

    // 更新或创建转入方余额
    if (toAsset) {
      await client
        .from('assets')
        .update({ 
          balance: newToBalance.toString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', toAsset.id);
    } else {
      await client.from('assets').insert({
        user_id: toWallet.user_id,
        token_symbol,
        balance: newToBalance.toString(),
      });
    }

    // 记录交易
    await client.from('transactions').insert([
      {
        user_id: session.user_id,
        type: 'transfer',
        amount: `-${amount}`,
        token_symbol,
        balance_before: fromAsset.balance,
        balance_after: newFromBalance.toString(),
        to_address,
        status: 'completed',
      },
      {
        user_id: toWallet.user_id,
        type: 'transfer',
        amount: amount,
        token_symbol,
        balance_before: toAsset?.balance || '0',
        balance_after: newToBalance.toString(),
        from_address: (await client.from('wallets').select('address').eq('user_id', session.user_id).maybeSingle()).data?.address,
        status: 'completed',
      },
    ]);

    res.json(successResponse(null, '转账成功'));
  } catch (error: any) {
    console.error('Transfer error:', error);
    res.status(500).json(errorResponse(error.message || '转账失败'));
  }
});

export default router;
