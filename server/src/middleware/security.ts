import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { body, validationResult } from 'express-validator';
import { getSupabaseClient } from '../storage/database/supabase-client';

// ==================== 安全头配置 ====================

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

// ==================== CORS 配置 ====================

export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // 允许的域名列表
    const allowedOrigins = [
      'http://localhost:5000',
      'http://localhost:3000',
      'http://localhost:9091',
      'http://127.0.0.1:5000',
      'http://127.0.0.1:3000',
      // 生产环境需要替换为实际域名
    ];
    
    // 允许无 origin 的请求（如移动端 App、Postman）
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // 生产环境可以更严格，开发环境放宽
      callback(null, true); // 开发环境允许所有来源
      // 生产环境应该: callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // 预检请求缓存 24 小时
};

// ==================== 速率限制 ====================

// 通用 API 速率限制（开发环境放宽限制）
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: process.env.NODE_ENV === 'production' ? 200 : 2000, // 生产环境 200 次，开发环境 2000 次
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 登录接口速率限制（更严格）
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 5, // 每个 IP 最多 5 次登录尝试
  message: {
    success: false,
    message: '登录尝试次数过多，请 15 分钟后再试',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 敏感操作速率限制（转账、提现等）
export const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小时
  max: 10, // 每个 IP 最多 10 次敏感操作
  message: {
    success: false,
    message: '操作过于频繁，请稍后再试',
    code: 'SENSITIVE_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// C2C 交易速率限制
export const c2cLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 30, // 每个 IP 最多 30 次请求
  message: {
    success: false,
    message: '操作过于频繁，请稍后再试',
    code: 'C2C_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ==================== 输入验证中间件 ====================

// 通用输入验证错误处理
export const validateInput = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '输入参数验证失败',
      errors: errors.array().map((e: any) => ({
        field: e.path || e.param,
        message: e.msg,
      })),
    });
  }
  next();
};

// 登录输入验证
export const validateLogin = [
  body('phone')
    .optional()
    .matches(/^1[3-9]\d{9}$/)
    .withMessage('手机号格式不正确'),
  body('password')
    .isLength({ min: 6, max: 32 })
    .withMessage('密码长度必须在 6-32 位之间'),
  validateInput,
];

// 注册输入验证
export const validateRegister = [
  body('phone')
    .matches(/^1[3-9]\d{9}$/)
    .withMessage('手机号格式不正确'),
  body('password')
    .isLength({ min: 6, max: 32 })
    .withMessage('密码长度必须在 6-32 位之间')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
    .withMessage('密码必须包含字母和数字'),
  body('referral_code')
    .optional()
    .isLength({ min: 6, max: 10 })
    .withMessage('推荐码长度不正确'),
  validateInput,
];

// 转账输入验证
export const validateTransfer = [
  body('to_address')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('钱包地址格式不正确'),
  body('amount')
    .isFloat({ min: 0.00000001 })
    .withMessage('转账金额必须大于 0'),
  body('password')
    .isLength({ min: 6, max: 32 })
    .withMessage('支付密码长度不正确'),
  validateInput,
];

// XSS 过滤
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      // 移除潜在的 XSS 标签
      return obj
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  next();
};

// ==================== 审计日志 ====================

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

// 审计日志中间件
export const auditMiddleware = (action: string, resource: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 保存原始的 json 方法
    const originalJson = res.json.bind(res);
    
    // 重写 json 方法
    res.json = (body: any) => {
      // 异步记录审计日志
      const userId = (req as any).user?.id || (req as any).session?.user_id;
      const clientIp = Array.isArray(req.ip) ? req.ip[0] : (req.ip || '');
      const resourceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      auditLog({
        user_id: userId,
        action,
        resource,
        resource_id: resourceId,
        ip: clientIp,
        user_agent: req.get('user-agent') || '',
        details: {
          body: req.body,
          query: req.query,
        },
        status: body?.success ? 'success' : 'failed',
        error_message: body?.message,
      }).catch(console.error);
      
      return originalJson(body);
    };
    
    next();
  };
};

// ==================== SQL 注入防护 ====================

// 危险 SQL 关键词检测
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/gi,
  /(--)|(\/\*)|(\*\/)/g,
  /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/gi,
  /(('|")\s*(OR|AND)\s*('|"))/gi,
];

export const sqlInjectionGuard = (req: Request, res: Response, next: NextFunction) => {
  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      for (const pattern of SQL_INJECTION_PATTERNS) {
        if (pattern.test(value)) {
          return true; // 检测到潜在 SQL 注入
        }
      }
    }
    if (Array.isArray(value)) {
      return value.some(checkValue);
    }
    if (value && typeof value === 'object') {
      return Object.values(value).some(checkValue);
    }
    return false;
  };

  // 检查请求参数
  if (
    checkValue(req.body) ||
    checkValue(req.query) ||
    checkValue(req.params)
  ) {
    // 记录可疑请求
    auditLog({
      action: 'SQL_INJECTION_ATTEMPT',
      resource: req.path,
      ip: req.ip || req.connection.remoteAddress || '',
      user_agent: req.get('user-agent') || '',
      details: {
        body: req.body,
        query: req.query,
        params: req.params,
      },
      status: 'failed',
      error_message: 'Potential SQL injection detected',
    }).catch(console.error);

    return res.status(400).json({
      success: false,
      message: '请求参数包含非法字符',
      code: 'INVALID_INPUT',
    });
  }

  next();
};
