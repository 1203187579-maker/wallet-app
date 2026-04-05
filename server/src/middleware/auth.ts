import type { NextFunction } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';

// 扩展 Request 类型
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: any;
    }
  }
}

// 功能禁用类型
type DisabledFeature = 'login' | 'api' | 'asset' | 'wallet' | 'plaza' | 'referral' | 'kyc';

// 检查用户是否被禁用特定功能
export const checkFeatureDisabled = (feature: DisabledFeature) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: '未授权访问' });
    }
    
    // 检查用户是否被完全禁用
    if (!user.is_active) {
      return res.status(403).json({ error: '账号已被禁用' });
    }
    
    // 检查特定功能是否被禁用
    const disabledFeatures: string[] = user.disabled_features || [];
    if (disabledFeatures.includes(feature)) {
      const featureNames: Record<string, string> = {
        login: '登录',
        api: 'API调用',
        asset: '资产操作',
        wallet: '钱包',
        plaza: '社交广场',
        referral: '推广收益',
        kyc: 'KYC认证',
      };
      return res.status(403).json({ 
        error: `${featureNames[feature] || '该功能'}已被禁用` 
      });
    }
    
    next();
  };
};

// 认证中间件
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未授权访问' });
    }

    const token = authHeader.substring(7);
    const client = getSupabaseClient();
    
    // 验证 token（这里简化处理，实际应使用 JWT 验证）
    const { data: session, error } = await client
      .from('user_sessions')
      .select('user_id, users(*)')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (error || !session) {
      return res.status(401).json({ error: '无效的 token' });
    }

    req.userId = session.user_id;
    req.user = session.users;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: '认证失败' });
  }
};

// 管理员认证中间件
export const adminAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未授权访问' });
    }

    const token = authHeader.substring(7);
    const client = getSupabaseClient();
    
    const { data: admin, error } = await client
      .from('admin_sessions')
      .select('admin_id, admin_users(*)')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      return res.status(401).json({ error: '无效的管理员 token' });
    }

    req.userId = admin.admin_id;
    req.user = admin.admin_users;
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(401).json({ error: '管理员认证失败' });
  }
};

// 可选认证中间件（有token则验证，无token也放行）
export const optionalAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const client = getSupabaseClient();
      
      const { data: session, error } = await client
        .from('user_sessions')
        .select('user_id, users(*)')
        .eq('token', token)
        .eq('is_active', true)
        .maybeSingle();

      if (session && !error) {
        req.userId = session.user_id;
        req.user = session.users;
      }
    }
    next();
  } catch (error) {
    next();
  }
};
