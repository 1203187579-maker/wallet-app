import 'dotenv/config';

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import {
  securityHeaders,
  corsOptions,
  generalLimiter,
  sensitiveLimiter,
  c2cLimiter,
  sanitizeInput,
  sqlInjectionGuard,
} from "./middleware/security";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 路由导入
import userRoutes from "./routes/users";
import walletRoutes from "./routes/wallets";
import assetRoutes from "./routes/assets";
import stakeRoutes from "./routes/stake";
import c2cRoutes from "./routes/c2c";
import kycRoutes from "./routes/kyc";
import referralRoutes from "./routes/referral";
import priceRoutes from "./routes/prices";
import adminRoutes from "./routes/admin";
import configRoutes from "./routes/config";
import uploadRoutes from "./routes/upload";
import paymentInfoRoutes from "./routes/payment-info";
import supportRoutes from "./routes/support";
import plazaRoutes from "./routes/plaza";
import updateRoutes from "./routes/updates";
import marketRoutes from "./routes/market";
import tradeRoutes from "./routes/trade";
import announcementRoutes from "./routes/announcements";
import { startC2CScheduler } from "./services/c2c-scheduler";
import { startStakeRewardScheduler } from "./services/stake-reward-scheduler";
import { startUnbanScheduler } from "./services/unban-scheduler";

const app = express();
const port = process.env.PORT || 9091;

// ==================== 健康检查（最优先，不受中间件影响） ====================

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== 安全中间件 ====================

// 安全头设置
app.use(securityHeaders);

// CORS 配置
app.use(cors(corsOptions));

// 信任代理（解决 X-Forwarded-For 警告）
app.set('trust proxy', true);

// 请求体解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// XSS 过滤
app.use(sanitizeInput);

// SQL 注入防护
app.use(sqlInjectionGuard);

// 通用速率限制（排除健康检查和静态资源）
app.use('/api/v1', generalLimiter);

// ==================== 静态资源 ====================

// 管理后台静态文件服务
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

// 管理后台 SPA 路由处理
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// ==================== API 路由 ====================

// 敏感操作路由添加额外速率限制（仅 C2C）
app.use('/api/v1/c2c', c2cLimiter, c2cRoutes);

// 钱包路由（限流器在路由内部对敏感操作单独应用）
app.use('/api/v1/wallets', walletRoutes);

// 普通路由
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/stake', stakeRoutes);
app.use('/api/v1/kyc', kycRoutes);
app.use('/api/v1/referral', referralRoutes);
app.use('/api/v1/prices', priceRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/payment-info', paymentInfoRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/plaza', plazaRoutes);
app.use('/api/v1/updates', updateRoutes);
app.use('/api/v1/market', marketRoutes);
app.use('/api/v1/trade', tradeRoutes);
app.use('/api/v1/announcements', announcementRoutes);

// ==================== 错误处理 ====================

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    code: 'NOT_FOUND',
  });
});

// 全局错误处理
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Error:', err.message);
  console.error('Stack:', err.stack);
  
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message,
    code: 'INTERNAL_ERROR',
  });
});

// ==================== 启动服务 ====================

app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening at http://localhost:${port}/`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // 启动C2C订单定时任务
  startC2CScheduler();
  
  // 启动质押收益自动发放定时任务
  startStakeRewardScheduler();
  
  // 启动自动解封定时任务
  startUnbanScheduler();
});