import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { successResponse, errorResponse } from '../utils';

const router = Router();

/**
 * 获取公开配置
 * GET /api/v1/config/public
 */
router.get('/public', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    
    // 获取公开配置
    const publicKeys = [
      'c2c_big_order_threshold',
      'c2c_fee_rate',
      'trade_fee_rate',
      'kyc_airdrop_amount',
      'kyc_max_accounts',
      // 支付方式开关配置
      'payment_alipay_enabled',
      'payment_wechat_enabled',
      'payment_usdt_enabled',
      // C2C买家列表动态标签配置
      'c2c_buyer_list_label',
      // 封禁提示词模板
      'ban_tip_template',
      // 默认封禁天数
      'default_ban_days',
    ];

    const { data: configs, error } = await client
      .from('system_config')
      .select('config_key, config_value, description')
      .in('config_key', publicKeys);

    if (error) throw error;

    // 转换为对象
    const configMap: Record<string, string> = {};
    configs?.forEach(c => {
      configMap[c.config_key] = c.config_value;
    });

    res.json(successResponse({ config: configMap }));
  } catch (error: any) {
    console.error('Get public config error:', error);
    res.status(500).json(errorResponse(error.message || '获取配置失败'));
  }
});

export default router;
