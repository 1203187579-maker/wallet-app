import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { getSupabaseClient } from '../storage/database/supabase-client';

// bcrypt 盐值轮数（推荐 10-12）
const BCRYPT_SALT_ROUNDS = 10;

// 生成唯一ID
export const generateId = (): string => {
  return randomBytes(16).toString('hex');
};

// 生成推荐码
export const generateReferralCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// 密码哈希（使用 bcrypt）
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
};

// 验证密码（支持 bcrypt 和旧的 SHA256 兼容）
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  // 检测是否为 bcrypt 哈希（bcrypt 哈希以 $2a$ 或 $2b$ 开头）
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
    return bcrypt.compare(password, hash);
  }
  // 兼容旧的 SHA256 哈希
  const sha256Hash = createHash('sha256').update(password).digest('hex');
  return sha256Hash === hash;
};

// 同步版本（用于向后兼容的简单验证）
export const hashPasswordSync = (password: string): string => {
  return createHash('sha256').update(password).digest('hex');
};

// 生成 Token
export const generateToken = (): string => {
  return randomBytes(32).toString('hex');
};

// 人脸特征哈希（用于防重复认证）
export const generateFaceHash = (faceData: string): string => {
  return createHash('sha256').update(faceData).digest('hex');
};

// 金额格式化
export const formatAmount = (amount: string | number, decimals: number = 8): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toFixed(decimals);
};

// 计算利息
export const calculateInterest = (
  principal: number,
  dailyRate: number,
  days: number
): number => {
  return principal * dailyRate * days;
};

// 生成钱包地址（模拟）
export const generateWalletAddress = (prefix: string = '0x'): string => {
  return prefix + randomBytes(20).toString('hex');
};

// 加密助记词（模拟，实际应使用专业加密库）
export const encryptMnemonic = (mnemonic: string, password: string): string => {
  // 简化实现，实际应使用 AES-256-GCM
  const key = createHash('sha256').update(password).digest();
  return Buffer.from(mnemonic).toString('base64');
};

// 解密助记词
export const decryptMnemonic = (encrypted: string, password: string): string => {
  // 简化实现
  return Buffer.from(encrypted, 'base64').toString('utf-8');
};

// 生成助记词（模拟，实际应使用 bip39）
export const generateMnemonic = (): string => {
  const words = [
    'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
    'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
    'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual'
  ];
  const selected = [];
  for (let i = 0; i < 12; i++) {
    selected.push(words[Math.floor(Math.random() * words.length)]);
  }
  return selected.join(' ');
};

// 分页参数处理
export const getPaginationParams = (query: any) => {
  const page = parseInt(query.page) || 1;
  const limit = Math.min(parseInt(query.limit) || 20, 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

// 响应格式化
export const successResponse = <T>(data: T, message: string = 'success') => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString()
});

export const errorResponse = (message: string, code?: string) => ({
  success: false,
  message,
  code,
  timestamp: new Date().toISOString()
});

// 审计日志
interface AuditLogInput {
  user_id?: string;
  action: string;
  resource: string;
  resource_id?: string;
  ip?: string | string[];
  user_agent?: string;
  details?: any;
  status: 'success' | 'failed';
  error_message?: string;
}

export const auditLog = async (log: AuditLogInput) => {
  try {
    const client = getSupabaseClient();
    const ip = Array.isArray(log.ip) ? log.ip[0] : log.ip || '';
    await client.from('audit_logs').insert({
      user_id: log.user_id,
      action: log.action,
      resource: log.resource,
      resource_id: log.resource_id,
      ip_address: ip,
      user_agent: log.user_agent || '',
      details: log.details,
      status: log.status,
      error_message: log.error_message,
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
};

// 功能禁用类型
export type DisabledFeature = 'login' | 'api' | 'asset' | 'wallet' | 'plaza' | 'referral' | 'kyc';

// 功能名称映射
const FEATURE_NAMES: Record<DisabledFeature, string> = {
  login: '登录',
  api: 'API调用',
  asset: '资产操作',
  wallet: '钱包',
  plaza: '社交广场',
  referral: '推广收益',
  kyc: 'KYC认证',
};

// 检查用户是否被禁用特定功能
export const checkFeatureDisabled = (
  user: { is_active?: boolean; disabled_features?: string[] },
  feature: DisabledFeature
): { disabled: boolean; message?: string } => {
  // 检查用户是否被完全禁用
  if (user.is_active === false) {
    return { disabled: true, message: '账号已被禁用' };
  }
  
  // 检查特定功能是否被禁用
  const disabledFeatures = user.disabled_features || [];
  if (disabledFeatures.includes(feature)) {
    return { 
      disabled: true, 
      message: `${FEATURE_NAMES[feature]}功能已被禁用` 
    };
  }
  
  return { disabled: false };
};
