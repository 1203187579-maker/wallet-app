import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { successResponse, errorResponse } from '../utils';

const router = Router();

// 支付类型定义（不包含独立的phone类型，phone字段是其他支付方式的附属信息）
const PAYMENT_TYPES = ['alipay', 'wechat', 'usdt_bsc'] as const;
type PaymentType = typeof PAYMENT_TYPES[number];

/**
 * 获取用户收款信息
 * GET /api/v1/payment-info
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

    // 获取收款信息
    const { data: paymentInfo, error } = await client
      .from('payment_info')
      .select('*')
      .eq('user_id', session.user_id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // 获取用户邮箱
    const { data: user } = await client
      .from('users')
      .select('email')
      .eq('id', session.user_id)
      .maybeSingle();

    // 获取支付方式开关配置
    const { data: paymentConfigs } = await client
      .from('system_config')
      .select('config_key, config_value')
      .in('config_key', ['payment_alipay_enabled', 'payment_wechat_enabled', 'payment_usdt_enabled']);

    const enabledPaymentTypes: string[] = [];
    paymentConfigs?.forEach(c => {
      if (c.config_value === 'true') {
        // payment_alipay_enabled -> alipay, payment_wechat_enabled -> wechat, payment_usdt_enabled -> usdt_bsc
        if (c.config_key === 'payment_alipay_enabled') {
          enabledPaymentTypes.push('alipay');
        } else if (c.config_key === 'payment_wechat_enabled') {
          enabledPaymentTypes.push('wechat');
        } else if (c.config_key === 'payment_usdt_enabled') {
          enabledPaymentTypes.push('usdt_bsc');
        }
      }
    });

    // 如果没有配置，默认全部启用
    const availablePaymentTypes = enabledPaymentTypes.length > 0 
      ? enabledPaymentTypes 
      : ['alipay', 'wechat', 'usdt_bsc'];

    res.json(successResponse({ 
      payment_info: paymentInfo || [],
      email: user?.email || '',
      available_payment_types: availablePaymentTypes,
    }));
  } catch (error: any) {
    console.error('Get payment info error:', error);
    res.status(500).json(errorResponse(error.message || '获取收款信息失败'));
  }
});

/**
 * 获取指定用户的收款信息（用于C2C订单详情）
 * GET /api/v1/payment-info/user/:userId
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const client = getSupabaseClient();

    // 获取用户收款信息
    const { data: paymentInfo, error } = await client
      .from('payment_info')
      .select('payment_type, account_info, account_name, phone, qrcode_url')
      .eq('user_id', userId);

    if (error) throw error;

    res.json(successResponse({ payment_info: paymentInfo || [] }));
  } catch (error: any) {
    console.error('Get user payment info error:', error);
    res.status(500).json(errorResponse(error.message || '获取收款信息失败'));
  }
});

/**
 * 更新用户邮箱（用于C2C订单通知）
 * PUT /api/v1/payment-info/email
 * Headers: Authorization: Bearer <token>
 * Body: { email }
 */
router.put('/email', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { email } = req.body;

    // 验证邮箱格式
    if (!email || email.trim() === '') {
      return res.status(400).json(errorResponse('邮箱不能为空'));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json(errorResponse('邮箱格式不正确'));
    }

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

    // 更新用户邮箱
    const { error } = await client
      .from('users')
      .update({ 
        email: email.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.user_id);

    if (error) throw error;

    res.json(successResponse({ email: email.trim() }, '邮箱保存成功'));
  } catch (error: any) {
    console.error('Save email error:', error);
    res.status(500).json(errorResponse(error.message || '保存失败'));
  }
});

/**
 * 保存/更新收款信息
 * PUT /api/v1/payment-info
 * Headers: Authorization: Bearer <token>
 * Body: { payment_type, account_info, account_name?, phone?, qrcode_url? }
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { payment_type, account_info, account_name, phone, qrcode_url } = req.body;

    // 验证支付类型
    if (!PAYMENT_TYPES.includes(payment_type)) {
      return res.status(400).json(errorResponse('无效的支付类型'));
    }

    if (!account_info || account_info.trim() === '') {
      return res.status(400).json(errorResponse('账号信息不能为空'));
    }

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

    // 使用 upsert 插入或更新
    const { data, error } = await client
      .from('payment_info')
      .upsert({
        user_id: session.user_id,
        payment_type,
        account_info: account_info.trim(),
        account_name: account_name?.trim() || null,
        phone: phone?.trim() || null,
        qrcode_url: qrcode_url || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,payment_type',
      })
      .select()
      .single();

    if (error) throw error;

    res.json(successResponse({ payment_info: data }, '保存成功'));
  } catch (error: any) {
    console.error('Save payment info error:', error);
    res.status(500).json(errorResponse(error.message || '保存失败'));
  }
});

/**
 * 删除收款信息
 * DELETE /api/v1/payment-info/:paymentType
 * Headers: Authorization: Bearer <token>
 */
router.delete('/:paymentType', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { paymentType } = req.params;

    // 验证支付类型
    if (!PAYMENT_TYPES.includes(paymentType as PaymentType)) {
      return res.status(400).json(errorResponse('无效的支付类型'));
    }

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

    // 删除收款信息
    const { error } = await client
      .from('payment_info')
      .delete()
      .eq('user_id', session.user_id)
      .eq('payment_type', paymentType);

    if (error) throw error;

    res.json(successResponse(null, '删除成功'));
  } catch (error: any) {
    console.error('Delete payment info error:', error);
    res.status(500).json(errorResponse(error.message || '删除失败'));
  }
});

export default router;
