import express from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { successResponse, errorResponse, generateId, verifyPassword, auditLog } from '../utils';
import {
  derivePrivateKeyFromMnemonic,
  encryptData,
} from '../utils/wallet';
import { authLimiter, auditMiddleware } from '../middleware/security';

// ==================== 撮合引擎（机器人专用）====================

/**
 * 获取手续费率
 */
async function getTradeFeeRate(client: any): Promise<number> {
  const { data } = await client
    .from('system_config')
    .select('config_value')
    .eq('config_key', 'trade_fee_rate')
    .maybeSingle();
  return data ? parseFloat(data.config_value) / 100 : 0.003; // 默认0.3%
}

/**
 * 更新资产余额
 */
async function updateAssetBalance(
  client: any,
  userId: string,
  tokenSymbol: string,
  amount: number,
  operation: 'add' | 'subtract'
): Promise<void> {
  const { data: asset } = await client
    .from('assets')
    .select('balance')
    .eq('user_id', userId)
    .eq('token_symbol', tokenSymbol)
    .maybeSingle();

  const currentBalance = asset ? parseFloat(asset.balance) : 0;
  const newBalance = operation === 'add' 
    ? currentBalance + amount 
    : currentBalance - amount;

  if (asset) {
    await client
      .from('assets')
      .update({ balance: Math.max(0, newBalance).toFixed(8) })
      .eq('user_id', userId)
      .eq('token_symbol', tokenSymbol);
  } else {
    await client
      .from('assets')
      .insert({
        id: generateId(),
        user_id: userId,
        token_symbol: tokenSymbol,
        balance: Math.max(0, newBalance).toFixed(8),
        frozen_balance: 0,
      });
  }
}

/**
 * 记录交易历史
 */
async function recordTradeHistory(
  client: any,
  userId: string,
  tradeType: 'buy' | 'sell',
  baseCurrency: string,
  quoteCurrency: string,
  amount: number,
  price: number,
  totalValue: number,
  fee: number,
  traderType: string = 'user'
): Promise<void> {
  await client.from('trade_history').insert({
    id: generateId(),
    user_id: userId,
    trade_type: tradeType,
    base_currency: baseCurrency,
    quote_currency: quoteCurrency,
    amount: amount.toFixed(8),
    price: price.toFixed(8),
    total_value: totalValue.toFixed(8),
    fee: fee.toFixed(8),
    trader_type: traderType,
    status: 'completed',
  });
}

/**
 * 触发撮合引擎
 */
async function triggerMatching(
  client: any,
  newOrder: {
    id: string;
    user_id: string;
    order_type: 'buy' | 'sell';
    base_currency: string;
    quote_currency: string;
    amount: number;
    price: number;
  }
): Promise<{ matchedAmount: number; matchedValue: number }> {
  let totalMatchedAmount = 0;
  let totalMatchedValue = 0;

  // 获取手续费率
  const totalFeeRate = await getTradeFeeRate(client);
  const halfFeeRate = totalFeeRate / 2;

  // 查找匹配的订单
  const oppositeType = newOrder.order_type === 'buy' ? 'sell' : 'buy';
  
  const { data: matchingOrders } = await client
    .from('trade_orders')
    .select('*')
    .eq('base_currency', newOrder.base_currency)
    .eq('quote_currency', newOrder.quote_currency)
    .eq('order_type', oppositeType)
    .in('status', ['open', 'partial']);

  if (!matchingOrders || matchingOrders.length === 0) {
    return { matchedAmount: 0, matchedValue: 0 };
  }

  // 按价格排序
  const sortedOrders = matchingOrders.sort((a: any, b: any) => {
    const priceA = parseFloat(a.price);
    const priceB = parseFloat(b.price);
    // 买单匹配低价卖单（升序），卖单匹配高价买单（降序）
    return newOrder.order_type === 'buy' ? priceA - priceB : priceB - priceA;
  });

  let remainingAmount = newOrder.amount;

  for (const matchOrder of sortedOrders) {
    if (remainingAmount <= 0) break;

    const matchPrice = parseFloat(matchOrder.price);
    
    // 价格检查
    if (newOrder.order_type === 'buy' && matchPrice > newOrder.price) continue;
    if (newOrder.order_type === 'sell' && matchPrice < newOrder.price) continue;

    // 不能自己匹配自己
    if (matchOrder.user_id === newOrder.user_id) continue;

    const matchAvailable = parseFloat(matchOrder.amount) - parseFloat(matchOrder.filled_amount || 0);
    const fillAmount = Math.min(remainingAmount, matchAvailable);
    const fillValue = fillAmount * matchPrice;

    // 计算手续费
    const buyerFee = fillValue * halfFeeRate;
    const sellerFee = fillValue * halfFeeRate;
    const buyerReceiveAmount = fillAmount * (1 - halfFeeRate);
    const sellerReceiveValue = fillValue * (1 - halfFeeRate);

    // 更新匹配订单
    const newFilledAmount = parseFloat(matchOrder.filled_amount || 0) + fillAmount;
    const newStatus = newFilledAmount >= parseFloat(matchOrder.amount) ? 'filled' : 'partial';

    await client
      .from('trade_orders')
      .update({
        filled_amount: newFilledAmount.toFixed(8),
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchOrder.id);

    // 执行资产转移
    const buyerId = newOrder.order_type === 'buy' ? newOrder.user_id : matchOrder.user_id;
    const sellerId = newOrder.order_type === 'sell' ? newOrder.user_id : matchOrder.user_id;
    const buyerType = buyerId === 'bot_trading_sys_001' ? 'bot' : 'user';
    const sellerType = sellerId === 'bot_trading_sys_001' ? 'bot' : 'user';

    await updateAssetBalance(client, buyerId, newOrder.base_currency, buyerReceiveAmount, 'add');
    await updateAssetBalance(client, sellerId, newOrder.quote_currency, sellerReceiveValue, 'add');
    
    // 记录交易
    await recordTradeHistory(client, buyerId, 'buy', newOrder.base_currency, newOrder.quote_currency, fillAmount, matchPrice, fillValue, buyerFee, buyerType);
    await recordTradeHistory(client, sellerId, 'sell', newOrder.base_currency, newOrder.quote_currency, fillAmount, matchPrice, fillValue, sellerFee, sellerType);

    remainingAmount -= fillAmount;
    totalMatchedAmount += fillAmount;
    totalMatchedValue += fillValue;

    console.log(`[Matching] 成交: ${fillAmount.toFixed(2)} ${newOrder.base_currency} @ ${matchPrice.toFixed(4)}`);
  }

  // 更新新订单状态
  if (totalMatchedAmount > 0) {
    const newStatus = totalMatchedAmount >= newOrder.amount ? 'filled' : 'partial';
    await client
      .from('trade_orders')
      .update({
        filled_amount: totalMatchedAmount.toFixed(8),
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', newOrder.id);

    // === 更新最新价格 ===
    // 获取最新成交价
    const { data: latestTrade } = await client
      .from('trade_history')
      .select('price')
      .eq('base_currency', newOrder.base_currency)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestTrade) {
      const latestPrice = parseFloat(latestTrade.price);
      
      // 获取当前价格统计数据
      const { data: currentPriceData } = await client
        .from('token_prices')
        .select('high_24h, low_24h, volume_24h, open_24h')
        .eq('token_symbol', newOrder.base_currency)
        .maybeSingle();
      
      const currentHigh = currentPriceData?.high_24h ? parseFloat(currentPriceData.high_24h) : latestPrice;
      const currentLow = currentPriceData?.low_24h ? parseFloat(currentPriceData.low_24h) : latestPrice;
      const currentVolume = currentPriceData?.volume_24h ? parseFloat(currentPriceData.volume_24h) : 0;
      const openPrice = currentPriceData?.open_24h ? parseFloat(currentPriceData.open_24h) : latestPrice;
      
      // 更新24h统计数据
      const newHigh = Math.max(currentHigh, latestPrice);
      const newLow = Math.min(currentLow, latestPrice);
      const newVolume = currentVolume + totalMatchedAmount;
      
      // 计算涨跌幅
      const change24h = openPrice > 0 ? ((latestPrice - openPrice) / openPrice) * 100 : 0;
      
      // 更新 token_prices 表
      await client
        .from('token_prices')
        .update({
          price_usd: latestPrice.toFixed(8),
          high_24h: newHigh.toFixed(8),
          low_24h: newLow.toFixed(8),
          volume_24h: newVolume.toFixed(8),
          open_24h: openPrice.toFixed(8),
          change_24h: change24h.toFixed(4),
          updated_at: new Date().toISOString(),
        })
        .eq('token_symbol', newOrder.base_currency);

      console.log(`[Matching] 更新价格: ${newOrder.base_currency} = ${latestPrice.toFixed(4)}, 24h最高: ${newHigh.toFixed(4)}, 最低: ${newLow.toFixed(4)}, 成交量: ${newVolume.toFixed(2)}, 涨幅: ${change24h.toFixed(2)}%`);
    }
  }

  return { matchedAmount: totalMatchedAmount, matchedValue: totalMatchedValue };
}

const router = express.Router();

// 管理员登录（添加速率限制和审计）
router.post('/login', authLimiter, auditMiddleware('ADMIN_LOGIN', 'admin_users'), async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    // 输入验证
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }
    
    const client = getSupabaseClient();
    
    // 查询管理员账号
    const { data: adminUser } = await client
      .from('admin_users')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .maybeSingle();

    if (!adminUser) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    // 验证密码（支持 bcrypt 哈希和 SHA256 向后兼容）
    let passwordValid = false;
    
    if (adminUser.password_hash) {
      // 检查是否为 bcrypt 格式（以 $2a$ 或 $2b$ 开头）
      const isBcrypt = adminUser.password_hash.startsWith('$2a$') || 
                        adminUser.password_hash.startsWith('$2b$');
      
      if (isBcrypt) {
        // 使用 bcrypt 验证
        passwordValid = await bcrypt.compare(password, adminUser.password_hash);
      } else {
        // 兼容旧的 SHA256 格式
        const crypto = await import('crypto');
        const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
        passwordValid = sha256Hash === adminUser.password_hash;
        
        // 如果验证成功，自动升级为 bcrypt 哈希
        if (passwordValid) {
          const newHash = await bcrypt.hash(password, 10);
          await client
            .from('admin_users')
            .update({ password_hash: newHash })
            .eq('id', adminUser.id);
        }
      }
    } else {
      // 兼容明文密码（首次登录后自动升级为 bcrypt）
      if (password === 'admin123') {
        passwordValid = true;
        const newHash = await bcrypt.hash(password, 10);
        await client
          .from('admin_users')
          .update({ password_hash: newHash })
          .eq('id', adminUser.id);
      }
    }

    if (!passwordValid) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    // 生成安全的 token
    const token = `admin_${generateId()}_${Date.now()}`;
    
    // 创建 session 记录
    await client
      .from('admin_sessions')
      .insert({
        id: `session_${Date.now()}`,
        admin_id: adminUser.id,
        token: token,
        is_active: true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24小时有效期
      });
    
    res.json({
      success: true,
      data: {
        token: token,
        admin: { 
          id: adminUser.id, 
          username: adminUser.username, 
          role: adminUser.role,
          nickname: adminUser.nickname 
        }
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

// 管理员修改密码
router.post('/change-password', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: '请输入旧密码和新密码' });
    }

    if (newPassword.length < 6 || newPassword.length > 32) {
      return res.status(400).json({ success: false, message: '新密码长度必须在 6-32 位之间' });
    }

    const client = getSupabaseClient();

    // 验证 session
    const { data: session } = await client
      .from('admin_sessions')
      .select('admin_id')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      return res.status(401).json(errorResponse('无效的 token'));
    }

    // 获取管理员信息
    const { data: adminUser } = await client
      .from('admin_users')
      .select('*')
      .eq('id', session.admin_id)
      .maybeSingle();

    if (!adminUser) {
      return res.status(401).json(errorResponse('管理员不存在'));
    }

    // 验证旧密码
    let passwordValid = false;
    if (adminUser.password_hash) {
      passwordValid = await bcrypt.compare(oldPassword, adminUser.password_hash);
    } else {
      passwordValid = oldPassword === 'admin123';
    }

    if (!passwordValid) {
      return res.status(400).json({ success: false, message: '旧密码错误' });
    }

    // 更新密码
    const newHash = await bcrypt.hash(newPassword, 10);
    await client
      .from('admin_users')
      .update({ password_hash: newHash })
      .eq('id', adminUser.id);

    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: '密码修改失败' });
  }
});

// 获取统计数据
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    
    // 总用户数
    const { count: totalUsers } = await client
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    // 活跃用户
    const { count: activeUsers } = await client
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    
    // 钱包总量
    const { count: totalWallets } = await client
      .from('wallets')
      .select('*', { count: 'exact', head: true });
    
    // 总资产
    const { data: assetsData } = await client
      .from('assets')
      .select('balance')
      .eq('token_symbol', 'USDT');
    
    const totalAssets = assetsData?.reduce((sum, a) => sum + parseFloat(a.balance || '0'), 0) || 0;
    
    // 质押总额
    const { data: stakeData } = await client
      .from('stake_records')
      .select('amount')
      .eq('status', 'active');

    const totalStaked = stakeData?.reduce((sum, s) => sum + parseFloat(s.amount || '0'), 0) || 0;

    // 质押分布（按质押类型统计）
    const { data: stakeDistribution } = await client
      .from('stake_records')
      .select('stake_type, amount')
      .eq('status', 'active');

    // 获取质押配置用于显示名称
    const { data: stakeConfigs } = await client
      .from('stake_config')
      .select('stake_type, duration_days');

    const configMap = new Map((stakeConfigs || []).map((c: any) => [c.stake_type, c.duration_days]));

    // 按类型统计
    const stakeByType: Record<string, number> = {};
    (stakeDistribution || []).forEach((s: any) => {
      const amount = parseFloat(s.amount || '0');
      const days = configMap.get(s.stake_type);
      const label = days ? `${days}天期` : '灵活质押';
      stakeByType[label] = (stakeByType[label] || 0) + amount;
    });

    // 计算百分比
    const stakeDistributionData = Object.entries(stakeByType).map(([name, amount]) => ({
      name,
      amount,
      percent: totalStaked > 0 ? Math.round((amount / totalStaked) * 100) : 0,
    }));

    // C2C订单数
    const { count: c2cOrders } = await client
      .from('c2c_orders')
      .select('*', { count: 'exact', head: true });
    
    // 待审KYC
    const { count: pendingKYC } = await client
      .from('kyc_records')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    // 推广人数
    const { count: referrals } = await client
      .from('users')
      .select('*', { count: 'exact', head: true })
      .not('referred_by', 'is', null);
    
    // 最近注册用户
    const { data: recentUsers } = await client
      .from('users')
      .select('id, nickname, email, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    // 获取最近用户的钱包地址
    const recentUserIds = (recentUsers || []).map((u: any) => u.id);
    const { data: recentWallets } = recentUserIds.length > 0 ? await client
      .from('wallets')
      .select('user_id, address')
      .in('user_id', recentUserIds) : { data: [] };
    const recentWalletMap = new Map((recentWallets || []).map((w: any) => [w.user_id, w.address]));
    
    const recentUsersWithWallet = (recentUsers || []).map((u: any) => ({
      ...u,
      wallet_address: recentWalletMap.get(u.id) || null,
    }));
    
    // 最近C2C订单
    const { data: recentOrders } = await client
      .from('c2c_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    res.json({
      success: true,
      data: {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalWallets: totalWallets || 0,
        totalAssets,
        totalStaked,
        stakeDistribution: stakeDistributionData,
        c2cOrders: c2cOrders || 0,
        pendingKYC: pendingKYC || 0,
        referrals: referrals || 0,
        recentUsers: recentUsersWithWallet,
        recentOrders: recentOrders || [],
      }
    });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    res.status(500).json({ success: false, message: '获取统计数据失败' });
  }
});

// 获取趋势数据（用于图表）
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const days = Number(req.query.days) || 7;
    
    // 生成日期范围
    const dateRange: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dateRange.push(date.toISOString().split('T')[0]);
    }

    // 用户注册趋势
    const { data: userTrends } = await client
      .from('users')
      .select('created_at')
      .gte('created_at', dateRange[0]);

    const usersByDate: Record<string, number> = {};
    dateRange.forEach(d => usersByDate[d] = 0);
    (userTrends || []).forEach((u: any) => {
      const date = u.created_at?.split('T')[0];
      if (date && usersByDate.hasOwnProperty(date)) {
        usersByDate[date]++;
      }
    });

    // 质押趋势
    const { data: stakeTrends } = await client
      .from('stake_records')
      .select('amount, created_at')
      .eq('status', 'active')
      .gte('created_at', dateRange[0]);

    const stakeByDate: Record<string, number> = {};
    dateRange.forEach(d => stakeByDate[d] = 0);
    (stakeTrends || []).forEach((s: any) => {
      const date = s.created_at?.split('T')[0];
      if (date && stakeByDate.hasOwnProperty(date)) {
        stakeByDate[date] += parseFloat(s.amount || '0');
      }
    });

    // C2C交易趋势
    const { data: c2cTrends } = await client
      .from('c2c_orders')
      .select('amount, created_at, status')
      .gte('created_at', dateRange[0]);

    const c2cByDate: Record<string, { count: number; volume: number }> = {};
    dateRange.forEach(d => c2cByDate[d] = { count: 0, volume: 0 });
    (c2cTrends || []).forEach((o: any) => {
      const date = o.created_at?.split('T')[0];
      if (date && c2cByDate.hasOwnProperty(date)) {
        c2cByDate[date].count++;
        c2cByDate[date].volume += parseFloat(o.amount || '0');
      }
    });

    // 组装趋势数据
    const trends = dateRange.map(date => ({
      date,
      label: new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
      newUsers: usersByDate[date] || 0,
      stakeAmount: parseFloat((stakeByDate[date] || 0).toFixed(2)),
      c2cCount: c2cByDate[date]?.count || 0,
      c2cVolume: parseFloat((c2cByDate[date]?.volume || 0).toFixed(2)),
    }));

    // 计算环比变化
    const calcChange = (arr: number[]) => {
      if (arr.length < 2) return 0;
      const current = arr[arr.length - 1];
      const previous = arr[arr.length - 2];
      if (previous === 0) return current > 0 ? 100 : 0;
      return parseFloat((((current - previous) / previous) * 100).toFixed(1));
    };

    const userChange = calcChange(trends.map(t => t.newUsers));
    const stakeChange = calcChange(trends.map(t => t.stakeAmount));
    const c2cChange = calcChange(trends.map(t => t.c2cVolume));

    res.json({
      success: true,
      data: {
        trends,
        changes: {
          users: userChange,
          stake: stakeChange,
          c2c: c2cChange,
        }
      }
    });
  } catch (error) {
    console.error('Failed to fetch trends:', error);
    res.status(500).json({ success: false, message: '获取趋势数据失败' });
  }
});

// 用户管理 - 获取列表
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10, search, status } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);
    
    const client = getSupabaseClient();
    
    let userIdsFromWallet: string[] = [];
    
    // 如果搜索字符串看起来像钱包地址，先查找对应的用户ID
    if (search && String(search).toLowerCase().startsWith('0x')) {
      const { data: walletData } = await client
        .from('wallets')
        .select('user_id')
        .ilike('address', `%${search}%`);
      userIdsFromWallet = (walletData || []).map((w: any) => w.user_id);
    }
    
    let query = client
      .from('users')
      .select('*', { count: 'exact' });
    
    if (search) {
      const searchStr = String(search);
      if (searchStr.toLowerCase().startsWith('0x')) {
        // 钱包地址搜索：使用从 wallets 表查到的用户ID
        if (userIdsFromWallet.length > 0) {
          query = query.in('id', userIdsFromWallet);
        } else {
          // 没找到匹配的钱包地址，返回空结果
          query = query.eq('id', 'no_match_placeholder');
        }
      } else if (searchStr.length >= 8) {
        // 如果搜索字符串长度>=8，可能是ID搜索
        query = query.or(`id.eq.${searchStr},nickname.ilike.%${searchStr}%,email.ilike.%${searchStr}%,phone.ilike.%${searchStr}%`);
      } else {
        query = query.or(`nickname.ilike.%${searchStr}%,email.ilike.%${searchStr}%,phone.ilike.%${searchStr}%`);
      }
    }
    
    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'disabled') {
      query = query.eq('is_active', false);
    }
    
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(pageSize) - 1);
    
    if (error) throw error;
    
    // 获取所有用户的钱包地址
    const userIds = (data || []).map((u: any) => u.id);
    const { data: wallets } = await client
      .from('wallets')
      .select('user_id, address')
      .in('user_id', userIds);
    
    const walletMap = (wallets || []).reduce((acc: any, w: any) => {
      acc[w.user_id] = w.address;
      return acc;
    }, {});
    
    // 转换数据格式以匹配前端期望
    const formattedList = (data || []).map((user: any) => ({
      id: user.id,
      username: user.nickname || 'User',
      email: user.email || '',
      phone: user.phone || '',
      avatar: user.avatar_url,
      referralCode: user.referral_code,
      referrer: user.referred_by,
      status: user.is_active ? 'active' : 'disabled',
      isBanned: user.is_banned || false,
      bannedUntil: user.banned_until || null,
      banReason: user.ban_reason || null,
      disabledFeatures: user.disabled_features || [],
      disabledFeaturesDetail: user.disabled_features_detail || {},
      kycStatus: user.is_kyc_verified ? 'approved' : 'none',
      walletAddress: walletMap[user.id] || '',
      createdAt: user.created_at,
    }));
    
    res.json({
      success: true,
      data: {
        list: formattedList,
        total: count || 0,
      }
    });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({ success: false, message: '获取用户列表失败' });
  }
});

// 用户管理 - 更新用户
router.put('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, kycStatus, disabledFeatures, disabledFeaturesDetail } = req.body;
    
    const client = getSupabaseClient();
    
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (status !== undefined) {
      updateData.is_active = status === 'active';
      
      // 如果禁用用户，同时让该用户的所有 Session 失效（强制登出）
      if (status === 'disabled') {
        await client
          .from('user_sessions')
          .update({ is_active: false })
          .eq('user_id', id);
      }
    }
    
    if (kycStatus !== undefined) {
      updateData.is_kyc_verified = kycStatus === 'approved';
    }
    
    if (disabledFeatures !== undefined) {
      updateData.disabled_features = disabledFeatures;
    }
    
    if (disabledFeaturesDetail !== undefined) {
      updateData.disabled_features_detail = disabledFeaturesDetail;
      
      // 如果禁用了登录功能，也要让 Session 失效
      if (disabledFeatures.includes('login')) {
        await client
          .from('user_sessions')
          .update({ is_active: false })
          .eq('user_id', id);
      }
    }
    
    await client
      .from('users')
      .update(updateData)
      .eq('id', id);
    
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('Failed to update user:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

/**
 * 封禁用户（级联封禁所有下级）
 * POST /api/v1/admin/users/:id/ban
 * Body: { days?: number, reason?: string }  // days为空表示永久封禁
 */
router.post('/users/:id/ban', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { days, reason } = req.body;
    const client = getSupabaseClient();
    
    // 计算封禁到期时间
    let bannedUntil = null;
    if (days && days > 0) {
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + days);
      bannedUntil = expireDate.toISOString();
    }
    
    // 封禁当前用户
    await client
      .from('users')
      .update({ 
        is_banned: true, 
        banned_until: bannedUntil,
        ban_reason: reason || null,
        updated_at: new Date().toISOString() 
      })
      .eq('id', id);
    
    // 级联封禁所有下级（递归查找）
    await banAllDownline(id, client, bannedUntil);
    
    const message = days ? `封禁成功，将在 ${days} 天后自动解封` : '封禁成功（永久）';
    res.json({ success: true, message, bannedUntil });
  } catch (error) {
    console.error('Failed to ban user:', error);
    res.status(500).json({ success: false, message: '封禁失败' });
  }
});

/**
 * 解封用户（单独解封，不影响上级和下级）
 * POST /api/v1/admin/users/:id/unban
 */
router.post('/users/:id/unban', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const client = getSupabaseClient();
    
    // 只解封当前用户
    await client
      .from('users')
      .update({ 
        is_banned: false, 
        banned_until: null, 
        ban_reason: null,
        updated_at: new Date().toISOString() 
      })
      .eq('id', id);
    
    res.json({ success: true, message: '解封成功' });
  } catch (error) {
    console.error('Failed to unban user:', error);
    res.status(500).json({ success: false, message: '解封失败' });
  }
});

/**
 * 递归封禁所有下级
 */
async function banAllDownline(userId: string, client: any, bannedUntil: string | null = null) {
  // 查找直接下级（通过 referred_by 字段）
  const { data: directDownlines } = await client
    .from('users')
    .select('id')
    .eq('referred_by', userId);
  
  if (!directDownlines || directDownlines.length === 0) return;
  
  for (const downline of directDownlines) {
    // 封禁该下级
    await client
      .from('users')
      .update({ 
        is_banned: true, 
        banned_until: bannedUntil,
        updated_at: new Date().toISOString() 
      })
      .eq('id', downline.id);
    
    // 递归封禁该下级的下级
    await banAllDownline(downline.id, client, bannedUntil);
  }
}

// 用户管理 - 充值/扣减资产
router.post('/users/:id/adjust-asset', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { symbol, amount, remark } = req.body;
    
    if (!symbol || amount === undefined || amount === null) {
      return res.status(400).json({ success: false, message: '代币类型和数量不能为空' });
    }
    
    const client = getSupabaseClient();
    
    // 检查价格记录是否存在，如果不存在则自动创建
    const { data: priceRecord } = await client
      .from('token_prices')
      .select('token_symbol')
      .eq('token_symbol', symbol)
      .maybeSingle();
    
    if (!priceRecord) {
      // 自动创建价格记录
      await client
        .from('token_prices')
        .insert({
          id: generateId(),
          token_symbol: symbol,
          price_usd: '0',
          change_24h: 0,
          is_platform_token: true,
          price_source: 'manual',
        });
      console.log(`[Admin] Auto created price record for ${symbol}`);
    }
    
    // 查询用户当前资产
    const { data: existingAsset, error: queryError } = await client
      .from('assets')
      .select('*')
      .eq('user_id', id)
      .eq('token_symbol', symbol)
      .maybeSingle();
    
    if (queryError) throw queryError;
    
    const adjustAmount = parseFloat(amount);
    
    if (existingAsset) {
      // 更新现有资产
      const currentBalance = parseFloat(existingAsset.balance || '0');
      const newBalance = currentBalance + adjustAmount;
      
      if (newBalance < 0) {
        return res.status(400).json({ success: false, message: '扣减后余额不能为负数' });
      }
      
      await client
        .from('assets')
        .update({ 
          balance: String(newBalance),
          updated_at: new Date().toISOString() 
        })
        .eq('id', existingAsset.id);
    } else {
      // 创建新资产记录（仅充值）
      if (adjustAmount < 0) {
        return res.status(400).json({ success: false, message: '用户无该代币资产，无法扣减' });
      }
      
      await client
        .from('assets')
        .insert({
          id: `asset_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          user_id: id,
          token_symbol: symbol,
          balance: String(adjustAmount),
          frozen_balance: '0',
        });
    }
    
    // 记录交易日志
    try {
      await client
        .from('transactions')
        .insert({
          id: `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          user_id: id,
          type: adjustAmount > 0 ? 'admin_deposit' : 'admin_deduct',
          token_symbol: symbol,
          amount: Math.abs(adjustAmount),
          balance_before: existingAsset ? parseFloat(existingAsset.balance || '0') : 0,
          balance_after: existingAsset ? parseFloat(existingAsset.balance || '0') + adjustAmount : adjustAmount,
          status: 'completed',
          note: remark || (adjustAmount > 0 ? '后台充值' : '后台扣减'),
        });
    } catch (txError) {
      console.log('Transaction log error (non-critical):', txError);
    }
    
    res.json({ 
      success: true, 
      message: adjustAmount > 0 ? '充值成功' : '扣减成功',
      data: {
        symbol,
        amount: adjustAmount,
        newBalance: existingAsset ? parseFloat(existingAsset.balance || '0') + adjustAmount : adjustAmount
      }
    });
  } catch (error) {
    console.error('Failed to adjust asset:', error);
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

// 用户管理 - 获取详情
router.get('/users/:id/detail', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();
    
    const { data: user, error } = await client
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    // 获取钱包信息（包含加密的助记词和私钥）
    const { data: wallet } = await client
      .from('wallets')
      .select('id, address, wallet_type, encrypted_mnemonic, encrypted_private_key, created_at')
      .eq('user_id', id)
      .limit(1)
      .maybeSingle();
    
    // 获取资产
    const { data: userAssets } = await client
      .from('assets')
      .select('balance')
      .eq('user_id', id);
    
    const totalAssets = userAssets?.reduce((sum: number, a: any) => sum + parseFloat(a.balance || '0'), 0) || 0;
    
    // 获取质押金额
    const { data: stakeData } = await client
      .from('stake_records')
      .select('amount')
      .eq('user_id', id)
      .eq('status', 'active');
    
    const stakedAmount = stakeData?.reduce((sum: number, s: any) => sum + parseFloat(s.amount || '0'), 0) || 0;
    
    // 获取C2C订单数
    const { count: c2cOrderCount } = await client
      .from('c2c_orders')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', id);
    
    // 获取推广人数
    const { count: referralCount } = await client
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('referred_by', id);

    // 解密助记词和私钥（后台直接查看，无需密码）
    let mnemonic: string | null = null;
    let privateKey: string | null = null;
    
    if (wallet) {
      const { decryptData } = await import('../utils/wallet');
      
      // 尝试用空密码解密（兼容旧格式base64数据）
      if (wallet.encrypted_mnemonic) {
        try {
          mnemonic = decryptData(wallet.encrypted_mnemonic, '');
        } catch (e) {
          // 如果空密码解密失败，尝试用默认密码
          try {
            mnemonic = decryptData(wallet.encrypted_mnemonic, '123456');
          } catch (e2) {
            // 无法解密，保持null
          }
        }
      }
      
      if (wallet.encrypted_private_key) {
        try {
          privateKey = decryptData(wallet.encrypted_private_key, '');
        } catch (e) {
          try {
            privateKey = decryptData(wallet.encrypted_private_key, '123456');
          } catch (e2) {
            // 无法解密，保持null
          }
        }
      }
      
      // 如果有助记词但没有私钥，从助记词派生私钥
      if (mnemonic && !privateKey) {
        privateKey = derivePrivateKeyFromMnemonic(mnemonic);
      }
    }
    
    res.json({
      success: true,
      data: {
        ...user,
        username: user.nickname || user.phone || 'Unknown',
        walletAddress: wallet?.address,
        walletType: wallet?.wallet_type,
        hasMnemonic: !!wallet?.encrypted_mnemonic,
        hasPrivateKey: !!wallet?.encrypted_private_key,
        mnemonic,
        privateKey,
        totalAssets,
        stakedAmount,
        c2cOrderCount: c2cOrderCount || 0,
        referralCount: referralCount || 0,
        status: user.is_active ? 'active' : 'disabled',
        kycStatus: user.is_kyc_verified ? 'approved' : 'none',
        referralCode: user.referral_code,
        referrer: user.referred_by,
        createdAt: user.created_at,
      }
    });
  } catch (error) {
    console.error('Failed to fetch user detail:', error);
    res.status(500).json({ success: false, message: '获取用户详情失败' });
  }
});

// 用户管理 - 同步钱包助记词和私钥
// 用于修复旧数据：如果用户有助记词但没有私钥，从助记词派生私钥
router.post('/users/:id/sync-wallet', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body; // 可选：提供密码用于解密助记词
    const client = getSupabaseClient();
    
    // 获取用户钱包
    const { data: wallet, error: walletError } = await client
      .from('wallets')
      .select('*')
      .eq('user_id', id)
      .maybeSingle();
    
    if (walletError) throw walletError;
    if (!wallet) {
      return res.status(404).json({ success: false, message: '用户没有钱包' });
    }
    
    let result = {
      mnemonicSynced: false,
      privateKeySynced: false,
      message: '',
    };
    
    // 如果有助记词但没有私钥，需要从助记词派生私钥
    if (wallet.encrypted_mnemonic && !wallet.encrypted_private_key) {
      result.message = '无法自动派生私钥：需要用户提供支付密码';
    }
    
    // 如果都有，提示已同步
    if (wallet.encrypted_mnemonic && wallet.encrypted_private_key) {
      result.message = '助记词和私钥已存在，无需同步';
      result.mnemonicSynced = true;
      result.privateKeySynced = true;
    }
    
    // 如果只有私钥没有助记词（私钥导入的情况）
    if (!wallet.encrypted_mnemonic && wallet.encrypted_private_key) {
      result.message = '该钱包通过私钥导入，无助记词';
      result.privateKeySynced = true;
    }
    
    // 如果都没有
    if (!wallet.encrypted_mnemonic && !wallet.encrypted_private_key) {
      result.message = '钱包数据异常：无助记词和私钥';
    }
    
    res.json({
      success: true,
      data: {
        walletAddress: wallet.address,
        walletType: wallet.wallet_type,
        hasMnemonic: !!wallet.encrypted_mnemonic,
        hasPrivateKey: !!wallet.encrypted_private_key,
        ...result,
      }
    });
  } catch (error: any) {
    console.error('Failed to sync wallet:', error);
    res.status(500).json({ success: false, message: error.message || '同步失败' });
  }
});

// 用户管理 - 使用密码解密并同步助记词和私钥
router.post('/users/:id/decrypt-wallet', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const client = getSupabaseClient();
    
    if (!password) {
      return res.status(400).json({ success: false, message: '请提供支付密码' });
    }
    
    // 获取用户钱包
    const { data: wallet, error: walletError } = await client
      .from('wallets')
      .select('*')
      .eq('user_id', id)
      .maybeSingle();
    
    if (walletError) throw walletError;
    if (!wallet) {
      return res.status(404).json({ success: false, message: '用户没有钱包' });
    }
    
    const { decryptData } = await import('../utils/wallet');
    
    let mnemonic: string | null = null;
    let privateKey: string | null = null;
    
    // 解密助记词
    if (wallet.encrypted_mnemonic) {
      try {
        mnemonic = decryptData(wallet.encrypted_mnemonic, password);
      } catch (e) {
        return res.status(400).json({ success: false, message: '支付密码错误' });
      }
    }
    
    // 解密私钥
    if (wallet.encrypted_private_key) {
      try {
        privateKey = decryptData(wallet.encrypted_private_key, password);
      } catch (e) {
        // 如果私钥解密失败，但助记词解密成功，从助记词派生
        if (mnemonic) {
          privateKey = derivePrivateKeyFromMnemonic(mnemonic);
        } else {
          return res.status(400).json({ success: false, message: '支付密码错误' });
        }
      }
    } else if (mnemonic) {
      // 如果没有私钥但有助记词，派生私钥
      privateKey = derivePrivateKeyFromMnemonic(mnemonic);
      
      // 存储派生的私钥
      const encryptedPrivateKey = encryptData(privateKey, password);
      await client
        .from('wallets')
        .update({ encrypted_private_key: encryptedPrivateKey })
        .eq('id', wallet.id);
    }
    
    res.json({
      success: true,
      data: {
        walletAddress: wallet.address,
        walletType: wallet.wallet_type,
        mnemonic,
        privateKey,
      }
    });
  } catch (error: any) {
    console.error('Failed to decrypt wallet:', error);
    res.status(500).json({ success: false, message: error.message || '解密失败' });
  }
});

// 钱包管理
router.get('/wallets', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10, search } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);
    
    const client = getSupabaseClient();
    
    const { data, count, error } = await client
      .from('wallets')
      .select(`
        id,
        user_id,
        address,
        wallet_type,
        created_at,
        users!inner(nickname)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(pageSize) - 1);
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: {
        list: data?.map((w: any) => ({
          id: w.id,
          userId: w.user_id,
          username: w.users?.nickname,
          address: w.address,
          type: w.wallet_type,
          network: 'BSC',
          usdtBalance: '0.00',
          bnbBalance: '0.00',
          createdAt: w.created_at,
        })) || [],
        total: count || 0,
      }
    });
  } catch (error) {
    console.error('Failed to fetch wallets:', error);
    res.status(500).json({ success: false, message: '获取钱包列表失败' });
  }
});

// 资产管理 - 按用户聚合显示
router.get('/assets', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10, search, minBalance } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);
    
    const client = getSupabaseClient();
    
    // 如果搜索字符串看起来像钱包地址，先查找对应的用户ID
    let userIdsFilter: string[] | null = null;
    if (search && String(search).toLowerCase().startsWith('0x')) {
      const { data: walletData } = await client
        .from('wallets')
        .select('user_id')
        .ilike('address', `%${search}%`);
      userIdsFilter = (walletData || []).map((w: any) => w.user_id);
    }
    
    // 查询所有资产
    let query = client
      .from('assets')
      .select(`
        id,
        user_id,
        token_symbol,
        balance,
        frozen_balance,
        updated_at,
        users!inner(nickname)
      `);
    
    // 如果有钱包地址筛选
    if (userIdsFilter !== null) {
      if (userIdsFilter.length > 0) {
        query = query.in('user_id', userIdsFilter);
      } else {
        query = query.eq('user_id', 'no_match_placeholder');
      }
    }
    
    const { data, error } = await query.order('updated_at', { ascending: false });
    
    if (error) throw error;
    
    // 获取钱包地址
    const userIds = [...new Set(data?.map((a: any) => a.user_id) || [])];
    const { data: wallets } = userIds.length > 0 ? await client
      .from('wallets')
      .select('user_id, address')
      .in('user_id', userIds) : { data: [] };
    const walletMap = new Map((wallets || []).map((w: any) => [w.user_id, w.address]));
    
    // 按用户聚合资产
    const userAssetsMap = new Map<string, {
      userId: string;
      walletAddress: string;
      username: string;
      usdtBalance: number;
      aiBalance: number;
      btcBalance: number;
      ethBalance: number;
      bnbBalance: number;
      totalBalance: number;
      updatedAt: string;
    }>();
    
    data?.forEach((asset: any) => {
      const userId = asset.user_id;
      const symbol = asset.token_symbol?.toUpperCase() || '';
      const balance = parseFloat(asset.balance || '0');
      
      if (!userAssetsMap.has(userId)) {
        userAssetsMap.set(userId, {
          userId,
          walletAddress: walletMap.get(userId) || '-',
          username: asset.users?.nickname || '-',
          usdtBalance: 0,
          aiBalance: 0,
          btcBalance: 0,
          ethBalance: 0,
          bnbBalance: 0,
          totalBalance: 0,
          updatedAt: asset.updated_at || new Date().toISOString(),
        });
      }
      
      const userAsset = userAssetsMap.get(userId)!;
      
      // 按代币类型累加
      if (symbol === 'USDT') userAsset.usdtBalance += balance;
      else if (symbol === 'AI') userAsset.aiBalance += balance;
      else if (symbol === 'BTC') userAsset.btcBalance += balance;
      else if (symbol === 'ETH') userAsset.ethBalance += balance;
      else if (symbol === 'BNB') userAsset.bnbBalance += balance;
      
      // 计算总资产（USDT价值）
      userAsset.totalBalance += balance;
      
      // 更新时间
      if (asset.updated_at && asset.updated_at > userAsset.updatedAt) {
        userAsset.updatedAt = asset.updated_at;
      }
    });
    
    // 转换为数组
    let userAssetsList = Array.from(userAssetsMap.values());
    
    // 按资产大小筛选
    if (minBalance) {
      const minVal = parseFloat(minBalance as string);
      userAssetsList = userAssetsList.filter(u => u.totalBalance >= minVal);
    }
    
    // 按总资产排序
    userAssetsList.sort((a, b) => b.totalBalance - a.totalBalance);
    
    const total = userAssetsList.length;
    const pagedList = userAssetsList.slice(offset, offset + Number(pageSize));
    
    res.json({
      success: true,
      data: {
        list: pagedList,
        total,
      }
    });
  } catch (error) {
    console.error('Failed to fetch assets:', error);
    res.status(500).json({ success: false, message: '获取资产列表失败' });
  }
});

// 更新资产
router.put('/assets/:userId/:symbol', async (req: Request, res: Response) => {
  try {
    const { userId, symbol } = req.params;
    const { balance } = req.body;
    
    const client = getSupabaseClient();
    
    await client
      .from('assets')
      .update({ balance: String(balance), updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('token_symbol', symbol);
    
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('Failed to update asset:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 质押管理 - 获取记录
router.get('/stakes', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);
    
    const client = getSupabaseClient();
    
    const { data, count, error } = await client
      .from('stake_records')
      .select(`
        id,
        user_id,
        amount,
        stake_type,
        daily_rate,
        total_reward,
        status,
        start_date,
        end_date,
        token_symbol,
        users!inner(nickname)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(pageSize) - 1);
    
    if (error) throw error;
    
    // 获取钱包地址
    const userIds = [...new Set(data?.map((s: any) => s.user_id) || [])];
    const { data: wallets } = userIds.length > 0 ? await client
      .from('wallets')
      .select('user_id, address')
      .in('user_id', userIds) : { data: [] };
    const walletMap = new Map((wallets || []).map((w: any) => [w.user_id, w.address]));

    // 获取质押配置，用于获取天数
    const { data: stakeConfigs } = await client
      .from('stake_config')
      .select('stake_type, duration_days');
    const configMap = new Map((stakeConfigs || []).map((c: any) => [c.stake_type, c.duration_days]));
    
    res.json({
      success: true,
      data: {
        list: data?.map((s: any) => {
          const durationDays = s.stake_type === 'flexible' ? 0 : (configMap.get(s.stake_type) || parseInt(s.stake_type.replace('fixed_', '')) || 0);
          return {
            id: s.id,
            userId: s.user_id,
            walletAddress: walletMap.get(s.user_id) || '-',
            username: s.users?.nickname,
            amount: s.amount,
            stakeType: s.stake_type,
            duration: durationDays,
            dailyRate: s.daily_rate,
            apy: parseFloat(s.daily_rate || '0') * 365 * 100,
            expectedReward: s.total_reward,
            status: s.status,
            tokenSymbol: s.token_symbol,
            startTime: s.start_date,
            endTime: s.end_date,
          };
        }) || [],
        total: count || 0,
      }
    });
  } catch (error) {
    console.error('Failed to fetch stakes:', error);
    res.status(500).json({ success: false, message: '获取质押记录失败' });
  }
});

// 质押管理 - 获取配置
router.get('/stakes/config', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    
    const { data: configs, error } = await client
      .from('stake_config')
      .select('*')
      .order('duration_days', { ascending: true });

    if (error) throw error;

    // 获取每个配置的参与人数和总质押额
    const configWithStats = await Promise.all(
      (configs || []).map(async (config: any) => {
        const { count: participants } = await client
          .from('stake_records')
          .select('*', { count: 'exact', head: true })
          .eq('stake_type', config.stake_type)
          .eq('status', 'active');

        const { data: stakeData } = await client
          .from('stake_records')
          .select('amount')
          .eq('stake_type', config.stake_type)
          .eq('status', 'active');

        const totalStaked = stakeData?.reduce((sum: number, r: any) => sum + parseFloat(r.amount || '0'), 0) || 0;

        // 解析 daily_rate (PostgreSQL numeric 类型返回对象格式)
        let dailyRate = 0;
        if (typeof config.daily_rate === 'object' && config.daily_rate !== null) {
          dailyRate = parseFloat(String(config.daily_rate));
        } else {
          dailyRate = parseFloat(config.daily_rate || '0');
        }
        
        // 解析 min_amount
        let minAmount = 100;
        if (typeof config.min_amount === 'object' && config.min_amount !== null) {
          minAmount = parseFloat(String(config.min_amount));
        } else {
          minAmount = parseFloat(config.min_amount || '100');
        }

        const result: any = {
          id: config.id,
          stake_type: config.stake_type,
          duration: config.duration_days || 0,
          daily_rate: dailyRate,
          minAmount: minAmount,
          maxAmount: null,
          participants: participants || 0,
          totalStaked: totalStaked.toFixed(2),
          is_active: config.is_active,
        };

        // 灵活质押返回 rate_config
        if (config.stake_type === 'flexible' && config.rate_config) {
          result.rate_config = config.rate_config;
          // 计算收益范围
          const rates = config.rate_config.map((c: any) => c.rate);
          result.min_rate = Math.min(...rates);
          result.max_rate = Math.max(...rates);
        }

        return result;
      })
    );

    res.json({
      success: true,
      data: configWithStats
    });
  } catch (error) {
    console.error('Failed to fetch stake config:', error);
    res.status(500).json({ success: false, message: '获取质押配置失败' });
  }
});

// 更新质押配置
router.put('/stakes/config/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { daily_rate, minAmount, rate_config, accumulate_rewards, is_active } = req.body;
    const client = getSupabaseClient();

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (daily_rate !== undefined) {
      updateData.daily_rate = daily_rate;
    }
    if (minAmount !== undefined) {
      updateData.min_amount = minAmount;
    }
    if (rate_config !== undefined) {
      updateData.rate_config = rate_config;
    }
    if (accumulate_rewards !== undefined) {
      updateData.accumulate_rewards = accumulate_rewards;
    }
    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    const { error } = await client
      .from('stake_config')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: '配置更新成功' });
  } catch (error) {
    console.error('Failed to update stake config:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 创建质押配置
router.post('/stakes/config', async (req: Request, res: Response) => {
  try {
    const { stake_type, duration_days, daily_rate, min_amount, rate_config, accumulate_rewards } = req.body;
    const client = getSupabaseClient();

    if (!stake_type) {
      return res.status(400).json({ success: false, message: '质押类型不能为空' });
    }

    // 检查是否已存在
    const { data: existing } = await client
      .from('stake_config')
      .select('id')
      .eq('stake_type', stake_type)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ success: false, message: '该质押类型已存在' });
    }

    const { error } = await client
      .from('stake_config')
      .insert({
        id: generateId(),
        stake_type,
        duration_days: duration_days || null,
        daily_rate: daily_rate || '0.006',
        min_amount: min_amount || '100',
        rate_config: rate_config || null,
        accumulate_rewards: accumulate_rewards !== false,
        is_active: true,
      });

    if (error) throw error;

    res.json({ success: true, message: '创建成功' });
  } catch (error) {
    console.error('Failed to create stake config:', error);
    res.status(500).json({ success: false, message: '创建失败' });
  }
});

// 取消用户质押（管理员操作）
router.post('/stakes/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();

    // 获取质押记录
    const { data: stake, error: stakeError } = await client
      .from('stake_records')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (stakeError) throw stakeError;
    if (!stake) {
      return res.status(404).json({ success: false, message: '质押记录不存在' });
    }
    if (stake.status !== 'active') {
      return res.status(400).json({ success: false, message: '只能取消质押中的订单' });
    }

    // 更新质押状态为已取消
    await client
      .from('stake_records')
      .update({ 
        status: 'cancelled', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id);

    // 退还本金给用户
    const amount = parseFloat(stake.amount);
    const { data: asset } = await client
      .from('assets')
      .select('balance')
      .eq('user_id', stake.user_id)
      .eq('token_symbol', 'GPU')
      .maybeSingle();

    if (asset) {
      const newBalance = parseFloat(asset.balance) + amount;
      await client
        .from('assets')
        .update({ balance: newBalance.toFixed(8), updated_at: new Date().toISOString() })
        .eq('user_id', stake.user_id)
        .eq('token_symbol', 'GPU');
    } else {
      await client
        .from('assets')
        .insert({
          id: generateId(),
          user_id: stake.user_id,
          token_symbol: 'GPU',
          balance: amount.toFixed(8),
        });
    }

    res.json({ success: true, message: '质押已取消，本金已退还给用户' });
  } catch (error) {
    console.error('Failed to cancel stake:', error);
    res.status(500).json({ success: false, message: '取消质押失败' });
  }
});

// 查询用户质押明细
router.get('/stakes/user-detail', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.query;
    const client = getSupabaseClient();

    if (!walletAddress) {
      return res.status(400).json({ success: false, message: '请提供钱包地址' });
    }

    // 通过钱包地址查找用户
    const { data: wallet } = await client
      .from('wallets')
      .select('user_id, address')
      .ilike('address', `%${walletAddress}%`)
      .maybeSingle();

    if (!wallet) {
      return res.status(404).json({ success: false, message: '未找到该钱包地址对应的用户' });
    }

    const userId = wallet.user_id;

    // 获取用户信息
    const { data: user } = await client
      .from('users')
      .select('id, nickname, phone')
      .eq('id', userId)
      .maybeSingle();

    // 获取用户质押记录
    const { data: stakes } = await client
      .from('stake_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // 获取用户收益记录
    const { data: rewards } = await client
      .from('stake_rewards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    // 统计数据
    const totalStakes = stakes?.length || 0;
    const totalAmount = stakes?.reduce((sum: number, s: any) => sum + parseFloat(s.amount || '0'), 0) || 0;

    res.json({
      success: true,
      data: {
        user: {
          id: userId,
          walletAddress: wallet.address,
          nickname: user?.nickname,
          phone: user?.phone,
          totalStakes,
          totalAmount: totalAmount.toFixed(2),
        },
        stakes: stakes || [],
        rewards: rewards || [],
      },
    });
  } catch (error) {
    console.error('Failed to get user stake detail:', error);
    res.status(500).json({ success: false, message: '查询失败' });
  }
});

// C2C订单管理
router.get('/c2c/orders', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10, status, search } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);
    
    const client = getSupabaseClient();
    
    // 如果搜索字符串看起来像钱包地址，先查找对应的用户ID
    let userIdsFromWallet: string[] = [];
    if (search && String(search).toLowerCase().startsWith('0x')) {
      const { data: walletData } = await client
        .from('wallets')
        .select('user_id')
        .ilike('address', `%${search}%`);
      userIdsFromWallet = (walletData || []).map((w: any) => w.user_id);
    }
    
    // 简单查询，不使用JOIN
    let query = client
      .from('c2c_orders')
      .select('*', { count: 'exact' });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    // 钱包地址搜索：筛选卖家或买家
    if (userIdsFromWallet.length > 0) {
      query = query.or(`seller_id.in.(${userIdsFromWallet.join(',')}),buyer_id.in.(${userIdsFromWallet.join(',')})`);
    }
    
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(pageSize) - 1);
    
    if (error) throw error;
    
    // 获取卖家和买家信息
    const sellerIds = [...new Set(data?.map((o: any) => o.seller_id).filter(Boolean) || [])];
    const buyerIds = [...new Set(data?.map((o: any) => o.buyer_id).filter(Boolean) || [])];
    const allUserIds = [...new Set([...sellerIds, ...buyerIds])];
    
    const { data: users } = allUserIds.length > 0 ? await client
      .from('users')
      .select('id, nickname, phone')
      .in('id', allUserIds) : { data: [] };
    const userMap = new Map((users || []).map((u: any) => [u.id, u]));
    
    // 获取钱包地址
    const { data: wallets } = allUserIds.length > 0 ? await client
      .from('wallets')
      .select('user_id, address')
      .in('user_id', allUserIds) : { data: [] };
    const walletMap = new Map((wallets || []).map((w: any) => [w.user_id, w.address]));
    
    res.json({
      success: true,
      data: {
        list: data?.map((o: any) => ({
          id: o.id,
          sellerId: o.seller_id,
          buyerId: o.buyer_id,
          sellerWalletAddress: walletMap.get(o.seller_id) || '-',
          buyerWalletAddress: walletMap.get(o.buyer_id) || '-',
          sellerName: userMap.get(o.seller_id)?.nickname || userMap.get(o.seller_id)?.phone || 'Unknown',
          token: o.token_symbol,
          amount: o.amount,
          price: o.price,
          totalPrice: o.total_price,
          status: o.status,
          createdAt: o.created_at,
        })) || [],
        total: count || 0,
      }
    });
  } catch (error) {
    console.error('Failed to fetch c2c orders:', error);
    res.status(500).json({ success: false, message: '获取C2C订单失败' });
  }
});

// 购买订单
router.get('/c2c/buy-orders', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10, search } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);
    
    const client = getSupabaseClient();
    
    // 如果搜索字符串看起来像钱包地址，先查找对应的用户ID
    let userIdsFilter: string[] | null = null;
    if (search && String(search).toLowerCase().startsWith('0x')) {
      const { data: walletData } = await client
        .from('wallets')
        .select('user_id')
        .ilike('address', `%${search}%`);
      userIdsFilter = (walletData || []).map((w: any) => w.user_id);
    }
    
    let query = client
      .from('buy_orders')
      .select('*', { count: 'exact' });
    
    // 如果有钱包地址筛选
    if (userIdsFilter !== null) {
      if (userIdsFilter.length > 0) {
        query = query.in('user_id', userIdsFilter);
      } else {
        query = query.eq('user_id', 'no_match_placeholder');
      }
    }
    
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(pageSize) - 1);
    
    if (error) throw error;
    
    // 获取用户信息
    const userIds = [...new Set(data?.map((o: any) => o.user_id).filter(Boolean) || [])];
    const { data: users } = userIds.length > 0 ? await client
      .from('users')
      .select('id, nickname, phone')
      .in('id', userIds) : { data: [] };
    
    const userMap = new Map((users || []).map((u: any) => [u.id, u]));
    
    // 获取钱包地址
    const { data: wallets } = userIds.length > 0 ? await client
      .from('wallets')
      .select('user_id, address')
      .in('user_id', userIds) : { data: [] };
    const walletMap = new Map((wallets || []).map((w: any) => [w.user_id, w.address]));
    
    res.json({
      success: true,
      data: {
        list: data?.map((o: any) => ({
          id: o.id,
          userId: o.user_id,
          walletAddress: walletMap.get(o.user_id) || '-',
          userName: userMap.get(o.user_id)?.nickname || userMap.get(o.user_id)?.phone || 'Unknown',
          amount: o.amount,
          tokenSymbol: o.token_symbol,
          price: o.price,
          totalPrice: o.total_price,
          orderType: o.order_type,
          status: o.status,
          expiredAt: o.expired_at,
          createdAt: o.created_at,
        })) || [],
        total: count || 0,
      }
    });
  } catch (error) {
    console.error('Failed to fetch buy orders:', error);
    res.status(500).json({ success: false, message: '获取购买订单失败' });
  }
});

// 更新订单状态
router.put('/c2c/orders/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const client = getSupabaseClient();
    
    await client
      .from('c2c_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    res.json({ success: true, message: '状态更新成功' });
  } catch (error) {
    console.error('Failed to update order status:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 取消求购单
router.put('/c2c/buy-orders/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();
    
    // 获取求购单
    const { data: buyOrder } = await client
      .from('buy_orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (!buyOrder) {
      return res.status(404).json({ success: false, message: '求购单不存在' });
    }
    
    if (buyOrder.status !== 'pending') {
      return res.status(400).json({ success: false, message: '只能取消待匹配的求购单' });
    }
    
    // 更新状态为已取消
    await client
      .from('buy_orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);
    
    res.json({ success: true, message: '求购单已取消' });
  } catch (error) {
    console.error('Failed to cancel buy order:', error);
    res.status(500).json({ success: false, message: '取消失败' });
  }
});

// KYC管理
router.get('/kyc', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10, status } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);
    
    const client = getSupabaseClient();
    
    let query = client
      .from('kyc_records')
      .select(`
        id,
        user_id,
        face_hash,
        face_image,
        liveness_actions,
        status,
        reject_reason,
        created_at,
        users!inner(nickname, phone)
      `, { count: 'exact' });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(pageSize) - 1);
    
    if (error) throw error;
    
    // 获取钱包地址
    const userIds = [...new Set(data?.map((k: any) => k.user_id) || [])];
    const { data: wallets } = userIds.length > 0 ? await client
      .from('wallets')
      .select('user_id, address')
      .in('user_id', userIds) : { data: [] };
    const walletMap = new Map((wallets || []).map((w: any) => [w.user_id, w.address]));
    
    // 解码HTML实体的函数
    const decodeHtmlEntities = (str: string) => {
      if (!str) return str;
      return str
        .replace(/&#x2F;/g, '/')
        .replace(/&#x3D;/g, '=')
        .replace(/&#x2B;/g, '+')
        .replace(/&amp;/g, '&')
        .replace(/&#x3A;/g, ':')
        .replace(/&#x3B;/g, ';')
        .replace(/&#x2C;/g, ',');
    };
    
    res.json({
      success: true,
      data: {
        list: data?.map((k: any) => ({
          id: k.id,
          userId: k.user_id,
          walletAddress: walletMap.get(k.user_id) || '-',
          username: k.users?.nickname || k.users?.phone || 'Unknown',
          faceImage: k.face_image ? decodeHtmlEntities(k.face_image) : null,
          livenessActions: k.liveness_actions,
          status: k.status,
          rejectReason: k.reject_reason,
          createdAt: k.created_at,
        })) || [],
        total: count || 0,
      }
    });
  } catch (error) {
    console.error('Failed to fetch kyc list:', error);
    res.status(500).json({ success: false, message: '获取KYC列表失败' });
  }
});

// 批准KYC
router.put('/kyc/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();
    
    // 获取KYC记录
    const { data: kycRecord } = await client
      .from('kyc_records')
      .select('user_id')
      .eq('id', id)
      .single();
    
    if (kycRecord) {
      // 更新KYC状态
      await client
        .from('kyc_records')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', id);
      
      // 更新用户KYC状态
      await client
        .from('users')
        .update({ is_kyc_verified: true, updated_at: new Date().toISOString() })
        .eq('id', kycRecord.user_id);
    }
    
    res.json({ success: true, message: 'KYC已批准' });
  } catch (error) {
    console.error('Failed to approve kyc:', error);
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

// 拒绝KYC
router.put('/kyc/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const client = getSupabaseClient();
    
    await client
      .from('kyc_records')
      .update({ status: 'rejected', reject_reason: reason, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    res.json({ success: true, message: 'KYC已拒绝' });
  } catch (error) {
    console.error('Failed to reject kyc:', error);
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

// 推广管理
router.get('/referrals', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);
    
    const client = getSupabaseClient();
    
    const { data, count, error } = await client
      .from('users')
      .select('id, nickname, referral_code, created_at', { count: 'exact' })
      .not('referral_code', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(pageSize) - 1);
    
    if (error) throw error;
    
    // 获取钱包地址
    const userIds = [...new Set(data?.map((u: any) => u.id) || [])];
    const { data: wallets } = userIds.length > 0 ? await client
      .from('wallets')
      .select('user_id, address')
      .in('user_id', userIds) : { data: [] };
    const walletMap = new Map((wallets || []).map((w: any) => [w.user_id, w.address]));
    
    // 计算推广数据
    const listWithStats = await Promise.all(
      (data || []).map(async (user: any) => {
        const { count: level1Count } = await client
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('referred_by', user.id);
        
        return {
          ...user,
          walletAddress: walletMap.get(user.id) || '-',
          username: user.nickname,
          referralCode: user.referral_code,
          level1Count: level1Count || 0,
          level2Count: 0,
          level3Count: 0,
          totalReferrals: level1Count || 0,
          totalReward: '0.00',
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        list: listWithStats,
        total: count || 0,
        stats: {
          totalPromoters: count || 0,
          totalReferrals: 0,
          totalRewards: 0,
          avgReferrals: 0,
          topPromoters: [],
        }
      }
    });
  } catch (error) {
    console.error('Failed to fetch referrals:', error);
    res.status(500).json({ success: false, message: '获取推广数据失败' });
  }
});

// 系统配置
router.get('/config', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('system_config')
      .select('*');
    
    if (error) throw error;
    
    const configMap = (data || []).reduce((acc: any, config: any) => {
      acc[config.config_key] = config.config_value;
      return acc;
    }, {});
    
    res.json({
      success: true,
      data: configMap
    });
  } catch (error) {
    console.error('Failed to fetch config:', error);
    res.status(500).json({ success: false, message: '获取配置失败' });
  }
});

// 更新系统配置
router.put('/config/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    const client = getSupabaseClient();
    
    const { data: existing } = await client
      .from('system_config')
      .select('id')
      .eq('config_key', key)
      .maybeSingle();
    
    if (existing) {
      await client
        .from('system_config')
        .update({ config_value: String(value), updated_at: new Date().toISOString() })
        .eq('config_key', key);
    } else {
      await client
        .from('system_config')
        .insert({ config_key: key, config_value: String(value) });
    }
    
    res.json({ success: true, message: '配置更新成功' });
  } catch (error) {
    console.error('Failed to update config:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 代币价格
router.get('/prices', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('token_prices')
      .select('*');
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: (data || []).map(p => ({
        symbol: p.token_symbol,
        name: p.token_symbol,
        price: p.price_usd,
        change24h: p.change_24h || 0,
        updatedAt: p.updated_at,
      }))
    });
  } catch (error) {
    console.error('Failed to fetch prices:', error);
    res.status(500).json({ success: false, message: '获取价格失败' });
  }
});

// 更新代币价格
router.put('/prices/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { price, change24h } = req.body;
    
    const client = getSupabaseClient();
    
    // 获取当前价格和开盘价
    const { data: priceData } = await client
      .from('token_prices')
      .select('price_usd, open_24h')
      .eq('token_symbol', symbol)
      .maybeSingle();
    
    const newPrice = parseFloat(price);
    const openPrice = priceData?.open_24h ? parseFloat(priceData.open_24h) : newPrice;
    
    // 计算涨跌幅（如果未提供）
    const calculatedChange24h = change24h !== undefined 
      ? parseFloat(change24h) 
      : (openPrice > 0 ? ((newPrice - openPrice) / openPrice) * 100 : 0);
    
    await client
      .from('token_prices')
      .update({ 
        price_usd: String(price), 
        change_24h: String(calculatedChange24h.toFixed(4)),
        updated_at: new Date().toISOString() 
      })
      .eq('token_symbol', symbol);
    
    res.json({ success: true, message: '价格更新成功', data: { change24h: calculatedChange24h } });
  } catch (error) {
    console.error('Failed to update price:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 获取收款信息列表
router.get('/payment-info', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10, userId, paymentType } = req.query;
    const client = getSupabaseClient();
    
    // 如果userId参数看起来像钱包地址，先查找对应的用户ID
    let actualUserId = userId;
    if (userId && String(userId).toLowerCase().startsWith('0x')) {
      const { data: walletData } = await client
        .from('wallets')
        .select('user_id')
        .ilike('address', `%${userId}%`)
        .limit(1)
        .maybeSingle();
      actualUserId = walletData?.user_id || null;
    }
    
    let query = client
      .from('payment_info')
      .select('*', { count: 'exact' });
    
    if (actualUserId) {
      query = query.eq('user_id', actualUserId);
    }
    if (paymentType) {
      query = query.eq('payment_type', paymentType);
    }
    
    const offset = (Number(page) - 1) * Number(pageSize);
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(pageSize) - 1);
    
    if (error) throw error;
    
    // 获取钱包地址
    const userIds = [...new Set(data?.map((p: any) => p.user_id) || [])];
    const { data: wallets } = userIds.length > 0 ? await client
      .from('wallets')
      .select('user_id, address')
      .in('user_id', userIds) : { data: [] };
    const walletMap = new Map((wallets || []).map((w: any) => [w.user_id, w.address]));
    
    res.json({
      success: true,
      data: {
        list: data?.map((p: any) => ({
          ...p,
          walletAddress: walletMap.get(p.user_id) || '-',
        })) || [],
        total: count || 0,
        page: Number(page),
        pageSize: Number(pageSize),
      }
    });
  } catch (error) {
    console.error('Failed to fetch payment info:', error);
    res.status(500).json({ success: false, message: '获取收款信息失败' });
  }
});

// ==================== 客服管理 ====================

/**
 * GET /api/v1/admin/support/conversations
 * 获取客服对话列表（按用户分组）
 */
router.get('/support/conversations', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 20, search } = req.query;
    const client = getSupabaseClient();

    // 使用原始SQL查询来避免schema缓存问题
    const { data, error } = await client.rpc('get_support_conversations', {
      search_text: search || '',
      page_num: Number(page),
      page_size_num: Number(pageSize),
    });

    // 如果rpc不存在，使用fallback方式查询
    if (error) {
      console.log('RPC not available, using fallback query:', error.message);
      
      // 直接查询support_messages表
      const { data: messages, error: msgError } = await client
        .from('support_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (msgError) {
        // 如果表还不存在，返回空列表
        if (msgError.message?.includes('Could not find')) {
          return res.json({
            success: true,
            data: {
              list: [],
              total: 0,
              page: Number(page),
              pageSize: Number(pageSize),
            },
          });
        }
        throw msgError;
      }

      // 按用户分组
      const userMap = new Map();
      for (const msg of messages || []) {
        const userId = msg.user_id;
        if (!userMap.has(userId)) {
          userMap.set(userId, {
            userId,
            user: null,
            lastMessage: msg.message,
            lastMessageType: msg.sender_type,
            lastMessageTime: msg.created_at,
            unreadCount: 0,
          });
        }
        if (msg.sender_type === 'user' && !msg.is_read) {
          userMap.get(userId).unreadCount++;
        }
      }

      let conversations = Array.from(userMap.values());
      
      // 获取用户信息
      if (conversations.length > 0) {
        const userIds = conversations.map(c => c.userId);
        const { data: users } = await client
          .from('users')
          .select('id, nickname, phone')
          .in('id', userIds);
        
        const userMap2 = new Map((users || []).map((u: any) => [u.id, u]));
        
        // 获取钱包地址
        const { data: wallets } = await client
          .from('wallets')
          .select('user_id, address')
          .in('user_id', userIds);
        const walletMap = new Map((wallets || []).map((w: any) => [w.user_id, w.address]));
        
        conversations = conversations.map(c => ({
          ...c,
          user: userMap2.get(c.userId),
          walletAddress: walletMap.get(c.userId) || null,
        }));
        
        // 搜索过滤（支持钱包地址、昵称、手机号）
        if (search) {
          const searchStr = String(search).toLowerCase();
          conversations = conversations.filter(c => {
            const walletMatch = c.walletAddress?.toLowerCase().includes(searchStr);
            const nicknameMatch = c.user?.nickname?.toLowerCase().includes(searchStr);
            const phoneMatch = c.user?.phone?.includes(searchStr);
            return walletMatch || nicknameMatch || phoneMatch;
          });
        }
      }

      const total = conversations.length;
      const offset = (Number(page) - 1) * Number(pageSize);
      const pagedConversations = conversations.slice(offset, offset + Number(pageSize));

      return res.json({
        success: true,
        data: {
          list: pagedConversations,
          total,
          page: Number(page),
          pageSize: Number(pageSize),
        },
      });
    }

    res.json({
      success: true,
      data: {
        list: data?.conversations || [],
        total: data?.total || 0,
        page: Number(page),
        pageSize: Number(pageSize),
      },
    });
  } catch (error) {
    console.error('Get support conversations error:', error);
    res.status(500).json({ success: false, message: '获取对话列表失败' });
  }
});

/**
 * GET /api/v1/admin/support/messages/:userId
 * 获取与指定用户的聊天记录
 */
router.get('/support/messages/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('support_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // 标记用户消息为已读
    await client
      .from('support_messages')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('sender_type', 'user');

    res.json({
      success: true,
      data: data?.map((msg: any) => ({
        id: msg.id,
        senderType: msg.sender_type,
        senderId: msg.sender_id,
        message: msg.message,
        messageType: msg.message_type,
        isRead: msg.is_read,
        createdAt: msg.created_at,
      })) || [],
    });
  } catch (error) {
    console.error('Get support messages error:', error);
    res.status(500).json({ success: false, message: '获取消息失败' });
  }
});

/**
 * POST /api/v1/admin/support/messages
 * 管理员回复消息
 */
router.post('/support/messages', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).admin?.id;
    const { userId, message } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ success: false, message: '参数错误' });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('support_messages')
      .insert({
        user_id: userId,
        sender_type: 'admin',
        sender_id: adminId,
        message,
        message_type: 'text',
        is_read: false,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: {
        id: data.id,
        senderType: 'admin',
        senderId: adminId,
        message,
        createdAt: data.created_at,
      },
    });
  } catch (error) {
    console.error('Send admin message error:', error);
    res.status(500).json({ success: false, message: '发送消息失败' });
  }
});

/**
 * GET /api/v1/admin/support/settings
 * 获取客服设置（AI自动回复开关）
 */
router.get('/support/settings', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('system_config')
      .select('*')
      .eq('config_key', 'support_ai_auto_reply')
      .maybeSingle();

    if (error) throw error;

    res.json({
      success: true,
      data: {
        aiAutoReply: data?.config_value === 'true',
      },
    });
  } catch (error) {
    console.error('Get support settings error:', error);
    res.status(500).json({ success: false, message: '获取设置失败' });
  }
});

/**
 * POST /api/v1/admin/support/settings
 * 更新客服设置
 */
router.post('/support/settings', async (req: Request, res: Response) => {
  try {
    const { aiAutoReply } = req.body;
    const client = getSupabaseClient();

    // 查询是否存在
    const { data: existing } = await client
      .from('system_config')
      .select('id')
      .eq('config_key', 'support_ai_auto_reply')
      .maybeSingle();

    let error;
    if (existing) {
      // 更新
      const result = await client
        .from('system_config')
        .update({ 
          config_value: aiAutoReply ? 'true' : 'false',
          updated_at: new Date().toISOString(),
        })
        .eq('config_key', 'support_ai_auto_reply');
      error = result.error;
    } else {
      // 插入
      const result = await client
        .from('system_config')
        .insert({
          config_key: 'support_ai_auto_reply',
          config_value: aiAutoReply ? 'true' : 'false',
          description: '客服AI自动回复开关',
        });
      error = result.error;
    }

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Update support settings error:', error);
    res.status(500).json({ success: false, message: '更新设置失败' });
  }
});

// ==================== AI机器人管理 ====================

/**
 * GET /api/v1/admin/ai-bots
 * 获取AI机器人列表
 */
router.get('/ai-bots', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('ai_bots')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: (data || []).map((bot: any) => ({
        id: bot.id,
        name: bot.name,
        avatarUrl: bot.avatar_url,
        description: bot.description,
        systemPrompt: bot.system_prompt,
        model: bot.model,
        triggerKeywords: bot.trigger_keywords || [],
        isActive: bot.is_active,
        createdAt: bot.created_at,
      })),
    });
  } catch (error) {
    console.error('Get AI bots error:', error);
    res.status(500).json({ success: false, message: '获取AI机器人列表失败' });
  }
});

/**
 * POST /api/v1/admin/ai-bots
 * 创建AI机器人
 */
router.post('/ai-bots', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).admin?.id;
    const { name, avatarUrl, description, systemPrompt, model, triggerKeywords } = req.body;

    if (!name || !systemPrompt) {
      return res.status(400).json({ success: false, message: '名称和系统提示词不能为空' });
    }

    const client = getSupabaseClient();

    // 处理触发关键词：将逗号分隔的字符串转为数组
    let keywordsArray: string[] = [];
    if (triggerKeywords) {
      if (typeof triggerKeywords === 'string') {
        keywordsArray = triggerKeywords.split(',').map((k: string) => k.trim()).filter((k: string) => k);
      } else if (Array.isArray(triggerKeywords)) {
        keywordsArray = triggerKeywords.filter((k: string) => k && k.trim());
      }
    }

    const { data, error } = await client
      .from('ai_bots')
      .insert({
        name,
        avatar_url: avatarUrl,
        description,
        system_prompt: systemPrompt,
        model: model || 'doubao-seed-1-6-lite-251015',
        trigger_keywords: keywordsArray,
        created_by: adminId,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data: { id: data.id } });
  } catch (error) {
    console.error('Create AI bot error:', error);
    res.status(500).json({ success: false, message: '创建AI机器人失败' });
  }
});

/**
 * PUT /api/v1/admin/ai-bots/:id
 * 更新AI机器人
 */
router.put('/ai-bots/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, avatarUrl, description, systemPrompt, model, isActive, triggerKeywords } = req.body;

    const client = getSupabaseClient();

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl;
    if (description !== undefined) updateData.description = description;
    if (systemPrompt !== undefined) updateData.system_prompt = systemPrompt;
    if (model !== undefined) updateData.model = model;
    if (isActive !== undefined) updateData.is_active = isActive;
    
    // 处理触发关键词
    if (triggerKeywords !== undefined) {
      let keywordsArray: string[] = [];
      if (typeof triggerKeywords === 'string') {
        keywordsArray = triggerKeywords.split(',').map((k: string) => k.trim()).filter((k: string) => k);
      } else if (Array.isArray(triggerKeywords)) {
        keywordsArray = triggerKeywords.filter((k: string) => k && k.trim());
      }
      updateData.trigger_keywords = keywordsArray;
    }

    const { error } = await client
      .from('ai_bots')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Update AI bot error:', error);
    res.status(500).json({ success: false, message: '更新AI机器人失败' });
  }
});

/**
 * DELETE /api/v1/admin/ai-bots/:id
 * 删除AI机器人
 */
router.delete('/ai-bots/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();

    const { error } = await client
      .from('ai_bots')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Delete AI bot error:', error);
    res.status(500).json({ success: false, message: '删除AI机器人失败' });
  }
});

// ==================== 群组管理 ====================

/**
 * GET /api/v1/admin/chat-groups
 * 获取群组列表
 */
router.get('/chat-groups', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10, search } = req.query;
    const client = getSupabaseClient();

    let query = client
      .from('chat_groups')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const offset = (Number(page) - 1) * Number(pageSize);
    
    const { data: groups, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(pageSize) - 1);

    if (error) throw error;

    // 获取群主信息
    const ownerIds = [...new Set((groups || []).map((g: any) => g.owner_id))];
    let ownerMap: Record<string, any> = {};
    if (ownerIds.length > 0) {
      const { data: owners } = await client
        .from('users')
        .select('id, nickname, phone')
        .in('id', ownerIds);
      (owners || []).forEach((o: any) => {
        ownerMap[o.id] = o;
      });
    }

    const result = (groups || []).map((g: any) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      avatarUrl: g.avatar_url,
      ownerId: g.owner_id,
      owner: ownerMap[g.owner_id],
      memberCount: g.member_count,
      isPublic: g.is_public,
      createdAt: g.created_at,
    }));

    res.json({
      success: true,
      data: {
        groups: result,
        total: count || 0,
      },
    });
  } catch (error) {
    console.error('Get chat groups error:', error);
    res.status(500).json({ success: false, message: '获取群组列表失败' });
  }
});

/**
 * DELETE /api/v1/admin/chat-groups/:id
 * 解散群组
 */
router.delete('/chat-groups/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();

    // 删除所有成员
    await client
      .from('chat_group_members')
      .delete()
      .eq('group_id', id);

    // 删除所有消息
    await client
      .from('chat_messages')
      .delete()
      .eq('group_id', id);

    // 删除群组
    const { error } = await client
      .from('chat_groups')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: '群组已解散' });
  } catch (error) {
    console.error('Delete chat group error:', error);
    res.status(500).json({ success: false, message: '解散群组失败' });
  }
});

/**
 * GET /api/v1/admin/chat-groups/:id/expand-logs
 * 获取群扩容日志
 */
router.get('/chat-groups/:id/expand-logs', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = 1, pageSize = 10 } = req.query;
    const client = getSupabaseClient();

    const offset = (Number(page) - 1) * Number(pageSize);

    const { data: logs, count, error } = await client
      .from('capacity_expand_logs')
      .select('*', { count: 'exact' })
      .eq('group_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(pageSize) - 1);

    if (error) throw error;

    // 获取用户信息
    const userIds = [...new Set((logs || []).map((l: any) => l.user_id))];
    let userMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: users } = await client
        .from('users')
        .select('id, nickname, phone')
        .in('id', userIds);
      (users || []).forEach((u: any) => {
        userMap[u.id] = u;
      });
    }

    const result = (logs || []).map((l: any) => ({
      id: l.id,
      groupId: l.group_id,
      userId: l.user_id,
      user: userMap[l.user_id],
      expandCount: l.amount,
      aiCost: l.cost,
      currency: l.currency,
      createdAt: l.created_at,
    }));

    res.json({
      success: true,
      data: {
        logs: result,
        total: count || 0,
      },
    });
  } catch (error) {
    console.error('Get group expand logs error:', error);
    res.status(500).json({ success: false, message: '获取扩容日志失败' });
  }
});

/**
 * GET /api/v1/admin/expand-logs
 * 获取所有扩容日志（统计用）
 */
router.get('/expand-logs', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10, groupId } = req.query;
    const client = getSupabaseClient();

    const offset = (Number(page) - 1) * Number(pageSize);

    let query = client
      .from('capacity_expand_logs')
      .select('*', { count: 'exact' });

    if (groupId) {
      query = query.eq('group_id', groupId);
    }

    const { data: logs, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(pageSize) - 1);

    if (error) throw error;

    // 获取用户和群组信息
    const userIds = [...new Set((logs || []).map((l: any) => l.user_id))];
    const groupIds = [...new Set((logs || []).map((l: any) => l.group_id))];
    
    let userMap: Record<string, any> = {};
    let groupMap: Record<string, any> = {};
    
    if (userIds.length > 0) {
      const { data: users } = await client
        .from('users')
        .select('id, nickname, phone')
        .in('id', userIds);
      (users || []).forEach((u: any) => {
        userMap[u.id] = u;
      });
    }
    
    if (groupIds.length > 0) {
      const { data: groups } = await client
        .from('chat_groups')
        .select('id, name')
        .in('id', groupIds);
      (groups || []).forEach((g: any) => {
        groupMap[g.id] = g;
      });
    }

    const result = (logs || []).map((l: any) => ({
      id: l.id,
      groupId: l.group_id,
      groupName: groupMap[l.group_id]?.name || '未知群组',
      userId: l.user_id,
      user: userMap[l.user_id],
      expandCount: l.amount,
      aiCost: l.cost,
      currency: l.currency,
      createdAt: l.created_at,
    }));

    res.json({
      success: true,
      data: {
        logs: result,
        total: count || 0,
      },
    });
  } catch (error) {
    console.error('Get expand logs error:', error);
    res.status(500).json({ success: false, message: '获取扩容日志失败' });
  }
});

/**
 * GET /api/v1/admin/chat-groups/stats
 * 获取群组统计信息
 */
router.get('/chat-groups/stats', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();

    // 总群数
    const { count: totalGroups } = await client
      .from('chat_groups')
      .select('*', { count: 'exact', head: true });

    // 总成员数（去重）
    const { data: memberData } = await client
      .from('chat_group_members')
      .select('user_id');
    const uniqueMembers = new Set((memberData || []).map((m: any) => m.user_id)).size;

    // 扩容总次数和总花费
    const { data: expandData } = await client
      .from('capacity_expand_logs')
      .select('cost');
    const totalExpandCount = (expandData || []).length;
    const totalAiSpent = (expandData || []).reduce((sum: number, e: any) => sum + parseFloat(e.cost || '0'), 0);

    // 今日新建群数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayGroups } = await client
      .from('chat_groups')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    res.json({
      success: true,
      data: {
        totalGroups: totalGroups || 0,
        totalMembers: uniqueMembers,
        totalExpandCount,
        totalAiSpent: totalAiSpent.toFixed(2),
        todayGroups: todayGroups || 0,
      },
    });
  } catch (error) {
    console.error('Get chat groups stats error:', error);
    res.status(500).json({ success: false, message: '获取群组统计失败' });
  }
});

// ==================== 违禁词管理 ====================

/**
 * GET /api/v1/admin/banned-words
 * 获取违禁词列表
 */
router.get('/banned-words', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('banned_words')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: (data || []).map((item: any) => ({
        id: item.id,
        word: item.word,
        type: item.type,
        replaceText: item.replace_text,
        createdAt: item.created_at,
      })),
    });
  } catch (error) {
    console.error('Get banned words error:', error);
    res.status(500).json({ success: false, message: '获取违禁词列表失败' });
  }
});

/**
 * POST /api/v1/admin/banned-words
 * 添加违禁词
 */
router.post('/banned-words', async (req: Request, res: Response) => {
  try {
    const { word, type = 'keyword', replaceText } = req.body;

    if (!word) {
      return res.status(400).json({ success: false, message: '违禁词不能为空' });
    }

    const client = getSupabaseClient();

    // 检查是否已存在
    const { data: existing } = await client
      .from('banned_words')
      .select('id')
      .eq('word', word)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ success: false, message: '该违禁词已存在' });
    }

    const { data, error } = await client
      .from('banned_words')
      .insert({
        word,
        type,
        replace_text: replaceText || null,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: {
        id: data.id,
        word: data.word,
        type: data.type,
        replaceText: data.replace_text,
        createdAt: data.created_at,
      },
    });
  } catch (error) {
    console.error('Add banned word error:', error);
    res.status(500).json({ success: false, message: '添加违禁词失败' });
  }
});

/**
 * DELETE /api/v1/admin/banned-words/:id
 * 删除违禁词
 */
router.delete('/banned-words/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();

    const { error } = await client
      .from('banned_words')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Delete banned word error:', error);
    res.status(500).json({ success: false, message: '删除违禁词失败' });
  }
});

// ==================== AI市值管理 ====================

/**
 * GET /api/v1/admin/market-cap/config
 * 获取AI市值调控配置（包含所有管理的代币）
 */
router.get('/market-cap/config', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    
    // 获取所有代币价格
    const { data: prices, error: pricesError } = await client
      .from('token_prices')
      .select('*');

    if (pricesError) throw pricesError;

    // 从system_config获取已配置的代币列表
    const { data: tokensConfig, error } = await client
      .from('system_config')
      .select('*')
      .eq('config_key', 'market_cap_tokens')
      .maybeSingle();

    let tokens: any[] = [];
    
    if (tokensConfig?.config_value) {
      try {
        tokens = JSON.parse(tokensConfig.config_value);
      } catch (e) {
        console.log('解析代币配置失败:', e);
      }
    }

    // 更新代币当前价格
    tokens = tokens.map(token => {
      const priceInfo = prices?.find(p => p.token_symbol === token.symbol);
      return {
        ...token,
        currentPrice: priceInfo ? parseFloat(priceInfo.price_usd || '0') : token.currentPrice || 0,
      };
    });

    res.json({
      success: true,
      data: {
        tokens,
        globalConfig: {
          enabled: true,
        },
      },
    });
  } catch (error) {
    console.error('Get market cap config error:', error);
    res.status(500).json({ success: false, message: '获取市值配置失败' });
  }
});

/**
 * POST /api/v1/admin/market-cap/tokens
 * 添加代币到市值管理
 */
router.post('/market-cap/tokens', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const {
      symbol, name, circulatingSupply, targetMarketCap,
      minPrice, maxPrice, adjustFrequency, maxAdjustPercent,
      stopLossPercent, takeProfitPercent, strategy
    } = req.body;

    if (!symbol) {
      return res.status(400).json({ success: false, message: '代币符号不能为空' });
    }

    // 获取当前价格
    const { data: priceInfo } = await client
      .from('token_prices')
      .select('price_usd')
      .eq('token_symbol', symbol)
      .maybeSingle();

    const currentPrice = priceInfo ? parseFloat(priceInfo.price_usd || '0') : 0;

    // 获取现有配置
    const { data: existingConfig } = await client
      .from('system_config')
      .select('*')
      .eq('config_key', 'market_cap_tokens')
      .maybeSingle();

    let tokens: any[] = [];
    if (existingConfig?.config_value) {
      try {
        tokens = JSON.parse(existingConfig.config_value);
      } catch (e) {}
    }

    // 检查是否已存在
    if (tokens.find(t => t.symbol === symbol)) {
      return res.status(400).json({ success: false, message: '该代币已在管理列表中' });
    }

    // 添加新代币
    const newToken = {
      symbol,
      name: name || symbol,
      currentPrice,
      circulatingSupply: circulatingSupply || 1000000000,
      targetMarketCap: targetMarketCap || 1000000,
      minPrice: minPrice || 0.001,
      maxPrice: maxPrice || 1,
      enabled: false,
      autoAdjust: true,
      adjustFrequency: adjustFrequency || 'hourly',
      maxAdjustPercent: maxAdjustPercent || 5,
      stopLossPercent: stopLossPercent || 10,
      takeProfitPercent: takeProfitPercent || 50,
      strategy: strategy || 'gradual',
      createdAt: new Date().toISOString(),
    };

    tokens.push(newToken);

    // 保存配置
    if (existingConfig) {
      await client
        .from('system_config')
        .update({ config_value: JSON.stringify(tokens), updated_at: new Date().toISOString() })
        .eq('config_key', 'market_cap_tokens');
    } else {
      await client
        .from('system_config')
        .insert({ config_key: 'market_cap_tokens', config_value: JSON.stringify(tokens) });
    }

    res.json({ success: true, data: newToken });
  } catch (error) {
    console.error('Add market cap token error:', error);
    res.status(500).json({ success: false, message: '添加代币失败' });
  }
});

/**
 * PUT /api/v1/admin/market-cap/tokens/:symbol
 * 更新代币市值管理配置
 */
router.put('/market-cap/tokens/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const client = getSupabaseClient();

    // 获取现有配置
    const { data: existingConfig } = await client
      .from('system_config')
      .select('*')
      .eq('config_key', 'market_cap_tokens')
      .maybeSingle();

    if (!existingConfig?.config_value) {
      return res.status(404).json({ success: false, message: '配置不存在' });
    }

    let tokens: any[] = [];
    try {
      tokens = JSON.parse(existingConfig.config_value);
    } catch (e) {}

    const tokenIndex = tokens.findIndex(t => t.symbol === symbol);
    if (tokenIndex === -1) {
      return res.status(404).json({ success: false, message: '代币不存在' });
    }

    // 更新代币配置
    tokens[tokenIndex] = {
      ...tokens[tokenIndex],
      ...req.body,
      symbol, // 确保symbol不被修改
      updatedAt: new Date().toISOString(),
    };

    // 保存配置
    await client
      .from('system_config')
      .update({ config_value: JSON.stringify(tokens), updated_at: new Date().toISOString() })
      .eq('config_key', 'market_cap_tokens');

    res.json({ success: true, data: tokens[tokenIndex] });
  } catch (error) {
    console.error('Update market cap token error:', error);
    res.status(500).json({ success: false, message: '更新配置失败' });
  }
});

/**
 * DELETE /api/v1/admin/market-cap/tokens/:symbol
 * 从市值管理中移除代币
 */
router.delete('/market-cap/tokens/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const client = getSupabaseClient();

    // 获取现有配置
    const { data: existingConfig } = await client
      .from('system_config')
      .select('*')
      .eq('config_key', 'market_cap_tokens')
      .maybeSingle();

    if (!existingConfig?.config_value) {
      return res.status(404).json({ success: false, message: '配置不存在' });
    }

    let tokens: any[] = [];
    try {
      tokens = JSON.parse(existingConfig.config_value);
    } catch (e) {}

    const filteredTokens = tokens.filter(t => t.symbol !== symbol);
    
    if (filteredTokens.length === tokens.length) {
      return res.status(404).json({ success: false, message: '代币不存在' });
    }

    // 保存配置
    await client
      .from('system_config')
      .update({ config_value: JSON.stringify(filteredTokens), updated_at: new Date().toISOString() })
      .eq('config_key', 'market_cap_tokens');

    res.json({ success: true });
  } catch (error) {
    console.error('Remove market cap token error:', error);
    res.status(500).json({ success: false, message: '移除代币失败' });
  }
});

/**
 * GET /api/v1/admin/market-cap/history
 * 获取市值调控历史
 */
router.get('/market-cap/history', async (req: Request, res: Response) => {
  try {
    const { limit = 50, symbol } = req.query;
    const client = getSupabaseClient();

    // 查询价格调整历史
    let query = client
      .from('ara_price_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (symbol) {
      query = query.eq('token_symbol', symbol);
    }

    const { data: history, error } = await query;

    if (error) {
      if (error.message?.includes('Could not find')) {
        return res.json({ success: true, data: [] });
      }
      throw error;
    }

    res.json({
      success: true,
      data: (history || []).map((h: any) => ({
        id: h.id,
        symbol: h.token_symbol || 'AI',
        created_at: h.created_at,
        old_price: h.old_price,
        new_price: h.new_price,
        price_change_percent: h.price_change_percent,
        action_type: h.adjustment_type === 'ai_auto' ? 'price_up' : 'price_up',
        trigger_type: h.adjustment_type || 'manual',
        remark: h.reason,
      })),
    });
  } catch (error) {
    console.error('Get market cap history error:', error);
    res.status(500).json({ success: false, message: '获取调控历史失败' });
  }
});

/**
 * POST /api/v1/admin/market-cap/adjust
 * 手动执行市值调整
 */
router.post('/market-cap/adjust', async (req: Request, res: Response) => {
  try {
    const { symbol, action_type, adjust_percent, remark } = req.body;
    const client = getSupabaseClient();

    if (!action_type || !adjust_percent) {
      return res.status(400).json({ success: false, message: '操作类型和调整幅度不能为空' });
    }

    const tokenSymbol = symbol || 'AI';

    // 获取当前价格
    const { data: tokenPrice } = await client
      .from('token_prices')
      .select('*')
      .eq('token_symbol', tokenSymbol)
      .maybeSingle();

    if (!tokenPrice) {
      return res.status(404).json({ success: false, message: '代币价格不存在' });
    }

    const currentPrice = parseFloat(tokenPrice.price_usd || '0');
    const openPrice = tokenPrice.open_24h ? parseFloat(tokenPrice.open_24h) : currentPrice;
    let newPrice = currentPrice;
    
    // 根据操作类型计算新价格
    if (action_type === 'price_up') {
      newPrice = currentPrice * (1 + parseFloat(adjust_percent) / 100);
    } else if (action_type === 'price_down') {
      newPrice = currentPrice * (1 - parseFloat(adjust_percent) / 100);
    } else if (action_type === 'buy_wall') {
      newPrice = currentPrice * (1 + parseFloat(adjust_percent) / 100 * 0.5);
    }

    // 计算涨跌幅
    const change24h = openPrice > 0 ? ((newPrice - openPrice) / openPrice) * 100 : 0;

    // 更新价格
    await client
      .from('token_prices')
      .update({
        price_usd: String(newPrice.toFixed(8)),
        open_24h: openPrice.toFixed(8),
        change_24h: change24h.toFixed(4),
        updated_at: new Date().toISOString(),
      })
      .eq('token_symbol', tokenSymbol);

    // 记录历史
    try {
      await client
        .from('ara_price_history')
        .insert({
          id: `mch_${Date.now()}`,
          token_symbol: tokenSymbol,
          old_price: String(currentPrice),
          new_price: String(newPrice.toFixed(8)),
          price_change_percent: String(((newPrice - currentPrice) / currentPrice * 100).toFixed(4)),
          adjustment_type: 'manual',
          reason: remark || `手动${action_type === 'price_up' ? '拉升' : action_type === 'price_down' ? '下调' : '调整'} ${adjust_percent}%`,
        });
    } catch (e) {
      console.log('记录历史失败（非关键）:', e);
    }

    res.json({
      success: true,
      message: '调整成功',
      data: {
        symbol: tokenSymbol,
        oldPrice: currentPrice,
        newPrice: newPrice.toFixed(8),
        changePercent: ((newPrice - currentPrice) / currentPrice * 100).toFixed(4),
        change24h: change24h.toFixed(2),
      },
    });
  } catch (error) {
    console.error('Manual market cap adjust error:', error);
    res.status(500).json({ success: false, message: '调整失败' });
  }
});

// ==================== 机器人交易管理 ====================

/**
 * GET /api/v1/admin/bot-trading/stats
 * 获取交易统计（区分用户和机器人）
 * Query: symbol, period (24h/7d/30d)
 */
router.get('/bot-trading/stats', async (req: Request, res: Response) => {
  try {
    const { symbol = 'AI', period = '24h' } = req.query;
    const client = getSupabaseClient();

    // 计算时间范围
    const now = new Date();
    let startTime = new Date();
    switch (period) {
      case '7d':
        startTime.setDate(now.getDate() - 7);
        break;
      case '30d':
        startTime.setDate(now.getDate() - 30);
        break;
      default: // 24h
        startTime.setDate(now.getDate() - 1);
    }

    // 查询交易历史统计
    const { data: trades, error } = await client
      .from('trade_history')
      .select('*')
      .eq('base_currency', symbol)
      .gte('created_at', startTime.toISOString());

    if (error) throw error;

    // 统计用户交易
    const userTrades = trades?.filter(t => t.trader_type === 'user') || [];
    const userBuyTrades = userTrades.filter(t => t.trade_type === 'buy');
    const userSellTrades = userTrades.filter(t => t.trade_type === 'sell');

    // 统计机器人交易
    const botTrades = trades?.filter(t => t.trader_type === 'bot') || [];
    const botBuyTrades = botTrades.filter(t => t.trade_type === 'buy');
    const botSellTrades = botTrades.filter(t => t.trade_type === 'sell');

    // 获取当前价格
    const { data: priceInfo } = await client
      .from('token_prices')
      .select('price_usd')
      .eq('token_symbol', symbol)
      .maybeSingle();

    const currentPrice = priceInfo ? parseFloat(priceInfo.price_usd || '0') : 0;

    // 获取挂单统计
    const { data: openOrders } = await client
      .from('trade_orders')
      .select('*')
      .eq('base_currency', symbol)
      .eq('status', 'open');

    const userOpenOrders = openOrders?.filter(o => o.trader_type === 'user') || [];
    const botOpenOrders = openOrders?.filter(o => o.trader_type === 'bot') || [];

    const userBuyOrders = userOpenOrders.filter(o => o.order_type === 'buy');
    const userSellOrders = userOpenOrders.filter(o => o.order_type === 'sell');
    const botBuyOrders = botOpenOrders.filter(o => o.order_type === 'buy');
    const botSellOrders = botOpenOrders.filter(o => o.order_type === 'sell');

    res.json({
      success: true,
      data: {
        symbol,
        currentPrice,
        period,
        user: {
          buyCount: userBuyTrades.length,
          buyAmount: userBuyTrades.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0),
          buyValue: userBuyTrades.reduce((sum, t) => sum + parseFloat(t.total_value || '0'), 0),
          sellCount: userSellTrades.length,
          sellAmount: userSellTrades.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0),
          sellValue: userSellTrades.reduce((sum, t) => sum + parseFloat(t.total_value || '0'), 0),
          openOrders: {
            buyCount: userBuyOrders.length,
            buyAmount: userBuyOrders.reduce((sum, o) => sum + parseFloat(o.amount || '0') - parseFloat(o.filled_amount || '0'), 0),
            sellCount: userSellOrders.length,
            sellAmount: userSellOrders.reduce((sum, o) => sum + parseFloat(o.amount || '0') - parseFloat(o.filled_amount || '0'), 0),
          },
        },
        bot: {
          buyCount: botBuyTrades.length,
          buyAmount: botBuyTrades.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0),
          buyValue: botBuyTrades.reduce((sum, t) => sum + parseFloat(t.total_value || '0'), 0),
          sellCount: botSellTrades.length,
          sellAmount: botSellTrades.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0),
          sellValue: botSellTrades.reduce((sum, t) => sum + parseFloat(t.total_value || '0'), 0),
          openOrders: {
            buyCount: botBuyOrders.length,
            buyAmount: botBuyOrders.reduce((sum, o) => sum + parseFloat(o.amount || '0') - parseFloat(o.filled_amount || '0'), 0),
            sellCount: botSellOrders.length,
            sellAmount: botSellOrders.reduce((sum, o) => sum + parseFloat(o.amount || '0') - parseFloat(o.filled_amount || '0'), 0),
          },
        },
        total: {
          buyCount: userBuyTrades.length + botBuyTrades.length,
          sellCount: userSellTrades.length + botSellTrades.length,
          buyAmount: userBuyTrades.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0) + botBuyTrades.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0),
          sellAmount: userSellTrades.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0) + botSellTrades.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0),
        },
      },
    });
  } catch (error) {
    console.error('Get bot trading stats error:', error);
    res.status(500).json({ success: false, message: '获取统计失败' });
  }
});

/**
 * GET /api/v1/admin/bot-trading/trade-history
 * 获取交易记录列表（区分用户和机器人）
 * Query: symbol, traderType, page, pageSize
 */
router.get('/bot-trading/trade-history', async (req: Request, res: Response) => {
  try {
    const { symbol = 'AI', traderType, page = 1, pageSize = 20 } = req.query;
    const client = getSupabaseClient();
    const offset = (Number(page) - 1) * Number(pageSize);
    
    let query = client
      .from('trade_history')
      .select('*', { count: 'exact' })
      .eq('base_currency', symbol);
    
    // 按交易者类型筛选（通过 user_id 判断）
    if (traderType === 'bot') {
      query = query.eq('user_id', 'bot_trading_sys_001');
    } else if (traderType === 'user') {
      query = query.neq('user_id', 'bot_trading_sys_001');
    }
    
    const { data: trades, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(pageSize) - 1);
    
    if (error) throw error;
    
    // 获取用户信息（包含钱包地址）
    const userIds = [...new Set(trades?.map(t => t.user_id) || [])];
    const { data: users } = await client
      .from('users')
      .select('id, nickname, phone')
      .in('id', userIds);
    
    // 获取钱包地址
    const { data: wallets } = await client
      .from('wallets')
      .select('user_id, address')
      .in('user_id', userIds);
    
    const userMap = new Map(users?.map(u => [u.id, u]) || []);
    const walletMap = new Map(wallets?.map(w => [w.user_id, w.address]) || []);
    
    // 格式化数据
    const formattedTrades = trades?.map(trade => {
      const isBot = trade.user_id === 'bot_trading_sys_001';
      return {
        id: trade.id,
        userId: trade.user_id,
        walletAddress: walletMap.get(trade.user_id) || '-',
        userNickname: userMap.get(trade.user_id)?.nickname || (isBot ? 'Trading Bot' : '-'),
        userPhone: userMap.get(trade.user_id)?.phone || '-',
        tradeType: trade.trade_type,
        baseCurrency: trade.base_currency,
        quoteCurrency: trade.quote_currency,
        amount: parseFloat(trade.amount || '0'),
        price: parseFloat(trade.price || '0'),
        totalValue: parseFloat(trade.total_value || '0'),
        fee: parseFloat(trade.fee || '0'),
        status: trade.status,
        traderType: isBot ? 'bot' : 'user',
        createdAt: trade.created_at,
      };
    }) || [];
    
    res.json({
      success: true,
      data: {
        list: formattedTrades,
        total: count || 0,
        page: Number(page),
        pageSize: Number(pageSize),
      },
    });
  } catch (error) {
    console.error('Get trade history error:', error);
    res.status(500).json({ success: false, message: '获取交易记录失败' });
  }
});

/**
 * GET /api/v1/admin/bot-trading/user-stats
 * 获取用户交易汇总统计
 * Query: symbol, period (24h/7d/30d/custom), startTime, endTime
 */
router.get('/bot-trading/user-stats', async (req: Request, res: Response) => {
  try {
    const { symbol = 'AI', period = '24h', startTime, endTime } = req.query;
    const client = getSupabaseClient();
    
    // 计算时间范围
    const now = new Date();
    let queryStartTime: Date;
    let queryEndTime: Date = now;
    
    if (startTime && endTime) {
      queryStartTime = new Date(startTime as string);
      queryEndTime = new Date(endTime as string);
    } else {
      queryStartTime = new Date();
      switch (period) {
        case '7d':
          queryStartTime.setDate(now.getDate() - 7);
          break;
        case '30d':
          queryStartTime.setDate(now.getDate() - 30);
          break;
        case '90d':
          queryStartTime.setDate(now.getDate() - 90);
          break;
        default: // 24h
          queryStartTime.setDate(now.getDate() - 1);
      }
    }
    
    // 查询交易历史
    const { data: trades, error } = await client
      .from('trade_history')
      .select('*')
      .eq('base_currency', symbol)
      .gte('created_at', queryStartTime.toISOString())
      .lte('created_at', queryEndTime.toISOString());

    if (error) throw error;
    
    // 获取用户信息（包含钱包地址）
    const userIds = [...new Set(trades?.map(t => t.user_id) || [])];
    const { data: users } = await client
      .from('users')
      .select('id, nickname, phone')
      .in('id', userIds);
    
    // 获取钱包地址
    const { data: wallets } = await client
      .from('wallets')
      .select('user_id, address')
      .in('user_id', userIds);
    
    const userMap = new Map(users?.map(u => [u.id, u]) || []);
    const walletMap = new Map(wallets?.map(w => [w.user_id, w.address]) || []);
    
    // 按用户分组统计
    const userStatsMap = new Map<string, {
      userId: string;
      walletAddress: string;
      userNickname: string;
      userPhone: string;
      traderType: string;
      buyCount: number;
      buyAmount: number;
      buyValue: number;
      sellCount: number;
      sellAmount: number;
      sellValue: number;
      feeTotal: number;
      firstTradeAt: string;
      lastTradeAt: string;
    }>();
    
    trades?.forEach(trade => {
      const userId = trade.user_id;
      const isBot = userId === 'bot_trading_sys_001';
      
      if (!userStatsMap.has(userId)) {
        userStatsMap.set(userId, {
          userId,
          walletAddress: walletMap.get(userId) || '-',
          userNickname: userMap.get(userId)?.nickname || (isBot ? 'Trading Bot' : '-'),
          userPhone: userMap.get(userId)?.phone || '-',
          traderType: isBot ? 'bot' : 'user',
          buyCount: 0,
          buyAmount: 0,
          buyValue: 0,
          sellCount: 0,
          sellAmount: 0,
          sellValue: 0,
          feeTotal: 0,
          firstTradeAt: trade.created_at,
          lastTradeAt: trade.created_at,
        });
      }
      
      const stats = userStatsMap.get(userId)!;
      const amount = parseFloat(trade.amount || '0');
      const value = parseFloat(trade.total_value || '0');
      const fee = parseFloat(trade.fee || '0');
      
      if (trade.trade_type === 'buy') {
        stats.buyCount++;
        stats.buyAmount += amount;
        stats.buyValue += value;
      } else {
        stats.sellCount++;
        stats.sellAmount += amount;
        stats.sellValue += value;
      }
      stats.feeTotal += fee;
      
      // 更新时间范围
      if (trade.created_at < stats.firstTradeAt) {
        stats.firstTradeAt = trade.created_at;
      }
      if (trade.created_at > stats.lastTradeAt) {
        stats.lastTradeAt = trade.created_at;
      }
    });
    
    // 转换为数组并排序
    const userStatsList = Array.from(userStatsMap.values())
      .sort((a, b) => (b.buyAmount + b.sellAmount) - (a.buyAmount + a.sellAmount));
    
    res.json({
      success: true,
      data: {
        list: userStatsList,
        total: userStatsList.length,
        period,
        startTime: queryStartTime.toISOString(),
        endTime: queryEndTime.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ success: false, message: '获取用户统计失败' });
  }
});

/**
 * GET /api/v1/admin/bot-trading/config
 * 获取机器人交易配置列表
 */
router.get('/bot-trading/config', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data: configs, error } = await client
      .from('bot_trading_config')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: configs || [] });
  } catch (error) {
    console.error('Get bot config error:', error);
    res.status(500).json({ success: false, message: '获取配置失败' });
  }
});

/**
 * POST /api/v1/admin/bot-trading/config
 * 创建机器人交易配置
 */
router.post('/bot-trading/config', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const {
      token_symbol, enabled, strategy, buy_enabled, sell_enabled,
      target_price, price_floor, price_ceiling, max_price_change_percent,
      daily_buy_limit, daily_sell_limit, min_order_amount, max_order_amount,
      order_interval_seconds, max_open_orders
    } = req.body;

    if (!token_symbol || !price_floor || !price_ceiling) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    // 检查是否已存在
    const { data: existing } = await client
      .from('bot_trading_config')
      .select('id')
      .eq('token_symbol', token_symbol)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ success: false, message: '该代币已存在配置' });
    }

    const { data, error } = await client
      .from('bot_trading_config')
      .insert({
        token_symbol,
        enabled: enabled ?? false,
        strategy: strategy || 'market_making',
        buy_enabled: buy_enabled ?? true,
        sell_enabled: sell_enabled ?? true,
        target_price,
        price_floor,
        price_ceiling,
        max_price_change_percent: max_price_change_percent || 5,
        daily_buy_limit: daily_buy_limit || 10000,
        daily_sell_limit: daily_sell_limit || 10000,
        min_order_amount: min_order_amount || 10,
        max_order_amount: max_order_amount || 100,
        order_interval_seconds: order_interval_seconds || 60,
        max_open_orders: max_open_orders || 5,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    console.error('Create bot config error:', error);
    res.status(500).json({ success: false, message: '创建配置失败' });
  }
});

/**
 * PUT /api/v1/admin/bot-trading/config/:id
 * 更新机器人交易配置
 */
router.put('/bot-trading/config/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();

    const updateData = {
      ...req.body,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('bot_trading_config')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    console.error('Update bot config error:', error);
    res.status(500).json({ success: false, message: '更新配置失败' });
  }
});

/**
 * DELETE /api/v1/admin/bot-trading/config/:id
 * 删除机器人交易配置
 */
router.delete('/bot-trading/config/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();

    const { error } = await client
      .from('bot_trading_config')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Delete bot config error:', error);
    res.status(500).json({ success: false, message: '删除配置失败' });
  }
});

/**
 * POST /api/v1/admin/bot-trading/execute
 * 手动触发机器人执行交易
 */
router.post('/bot-trading/execute', async (req: Request, res: Response) => {
  try {
    const { symbol, action, amount, price } = req.body;
    const client = getSupabaseClient();

    if (!symbol || !action) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    // 获取机器人配置
    const { data: config } = await client
      .from('bot_trading_config')
      .select('*')
      .eq('token_symbol', symbol)
      .single();

    if (!config) {
      return res.status(404).json({ success: false, message: '机器人配置不存在' });
    }

    // 获取系统机器人用户ID
    const { data: botUser } = await client
      .from('users')
      .select('id')
      .eq('is_bot', true)
      .maybeSingle();

    let botUserId = botUser?.id;

    // 如果不存在系统机器人用户，创建一个
    if (!botUserId) {
      const botId = `bot_${Date.now()}`;
      const { error: createUserError } = await client
        .rpc('create_bot_user', { bot_id: botId })
        .maybeSingle();

      // 如果RPC不存在，使用直接插入
      if (createUserError) {
        console.log('RPC创建失败，尝试直接创建:', createUserError);
        
        // 使用最小字段集
        const { error: insertError } = await client
          .from('users')
          .insert({
            id: botId,
            nickname: '交易机器人',
            is_kyc_verified: false,
            is_active: true,
          });
        
        if (insertError) {
          console.error('创建机器人用户失败:', insertError);
          return res.status(500).json({ success: false, message: '创建机器人用户失败' });
        }
        botUserId = botId;
      } else {
        botUserId = botId;
      }

      // 给机器人创建钱包和资产
      await client.from('wallets').insert({
        id: `bot_wallet_${Date.now()}`,
        user_id: botUserId,
        wallet_type: 'system',
        address: `0x${Date.now().toString(16)}`,
        is_primary: true,
      });

      // 给机器人充足的测试资金
      await client.from('assets').insert([
        { id: `bot_ai_${Date.now()}`, user_id: botUserId, token_symbol: 'AI', balance: 1000000 },
        { id: `bot_usdt_${Date.now() + 1}`, user_id: botUserId, token_symbol: 'USDT', balance: 1000000 },
      ]);
    }

    // 获取当前价格
    const { data: priceInfo } = await client
      .from('token_prices')
      .select('price_usd')
      .eq('token_symbol', symbol)
      .maybeSingle();

    const currentPrice = priceInfo ? parseFloat(priceInfo.price_usd || '0') : 0;
    const orderPrice = price || currentPrice;
    const orderAmount = amount || (config.min_order_amount + config.max_order_amount) / 2;

    // 检查是否超出限制
    if (action === 'buy' && !config.buy_enabled) {
      return res.status(400).json({ success: false, message: '机器人买入功能已禁用' });
    }
    if (action === 'sell' && !config.sell_enabled) {
      return res.status(400).json({ success: false, message: '机器人卖出功能已禁用' });
    }

    // 检查价格范围
    if (orderPrice < parseFloat(config.price_floor) || orderPrice > parseFloat(config.price_ceiling)) {
      return res.status(400).json({ success: false, message: '价格超出允许范围' });
    }

    // 检查每日限额
    if (action === 'buy' && parseFloat(config.today_buy_amount) + orderAmount > parseFloat(config.daily_buy_limit)) {
      return res.status(400).json({ success: false, message: '已达到每日买入限额' });
    }
    if (action === 'sell' && parseFloat(config.today_sell_amount) + orderAmount > parseFloat(config.daily_sell_limit)) {
      return res.status(400).json({ success: false, message: '已达到每日卖出限额' });
    }

    // 创建机器人挂单
    const orderId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { error: orderError } = await client
      .from('trade_orders')
      .insert({
        id: orderId,
        user_id: botUserId,
        order_type: action,
        base_currency: symbol,
        quote_currency: 'USDT',
        amount: orderAmount,
        price: orderPrice,
        filled_amount: 0,
        status: 'open',
        trader_type: 'bot',
        bot_id: config.id,
      });

    if (orderError) throw orderError;

    // === 触发撮合引擎 ===
    await triggerMatching(client, {
      id: orderId,
      user_id: botUserId,
      order_type: action,
      base_currency: symbol,
      quote_currency: 'USDT',
      amount: orderAmount,
      price: orderPrice,
    });

    // 更新机器人统计
    if (action === 'buy') {
      await client
        .from('bot_trading_config')
        .update({
          today_buy_amount: parseFloat(config.today_buy_amount) + orderAmount,
          last_order_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id);
    } else {
      await client
        .from('bot_trading_config')
        .update({
          today_sell_amount: parseFloat(config.today_sell_amount) + orderAmount,
          last_order_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id);
    }

    res.json({
      success: true,
      message: '机器人挂单成功',
      data: {
        orderId,
        action,
        amount: orderAmount,
        price: orderPrice,
      },
    });
  } catch (error) {
    console.error('Bot execute error:', error);
    res.status(500).json({ success: false, message: '执行失败' });
  }
});

/**
 * POST /api/v1/admin/bot-trading/reset-daily
 * 重置机器人每日统计
 */
router.post('/bot-trading/reset-daily', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();

    const { error } = await client
      .from('bot_trading_config')
      .update({
        today_buy_amount: 0,
        today_sell_amount: 0,
        updated_at: new Date().toISOString(),
      })
      .neq('id', ''); // 更新所有记录

    if (error) throw error;

    res.json({ success: true, message: '重置成功' });
  } catch (error) {
    console.error('Reset daily stats error:', error);
    res.status(500).json({ success: false, message: '重置失败' });
  }
});

/**
 * GET /api/v1/admin/bot-trading/orders
 * 获取机器人挂单列表
 */
router.get('/bot-trading/orders', async (req: Request, res: Response) => {
  try {
    const { symbol, status, limit = 50 } = req.query;
    const client = getSupabaseClient();

    let query = client
      .from('trade_orders')
      .select('*')
      .eq('trader_type', 'bot')
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (symbol) {
      query = query.eq('base_currency', symbol);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: orders, error } = await query;

    if (error) throw error;

    res.json({ success: true, data: orders || [] });
  } catch (error) {
    console.error('Get bot orders error:', error);
    res.status(500).json({ success: false, message: '获取挂单失败' });
  }
});

/**
 * POST /api/v1/admin/bot-trading/run-strategy
 * 手动触发机器人策略执行
 */
router.post('/bot-trading/run-strategy', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.body;
    
    // 动态导入机器人交易服务
    const { runAllBotStrategies, executeBotStrategy, getActiveBotConfigs } = await import('../services/bot-trading-service');
    
    if (symbol) {
      // 执行指定代币的策略
      const configs = await getActiveBotConfigs();
      const config = configs.find(c => c.token_symbol === symbol);
      if (!config) {
        return res.status(404).json({ success: false, message: '未找到该代币的机器人配置' });
      }
      await executeBotStrategy(config);
      res.json({ success: true, message: `已执行 ${symbol} 策略` });
    } else {
      // 执行所有活跃策略
      const result = await runAllBotStrategies();
      res.json({ 
        success: true, 
        message: `策略执行完成`,
        data: result 
      });
    }
  } catch (error) {
    console.error('Run strategy error:', error);
    res.status(500).json({ success: false, message: '策略执行失败' });
  }
});

/**
 * GET /api/v1/admin/bot-trading/dashboard
 * 获取市值管理仪表盘数据
 */
router.get('/bot-trading/dashboard', async (req: Request, res: Response) => {
  try {
    const { symbol = 'AI' } = req.query;
    const client = getSupabaseClient();

    // 获取当前价格
    const { data: priceInfo } = await client
      .from('token_prices')
      .select('*')
      .eq('token_symbol', symbol)
      .maybeSingle();

    const currentPrice = priceInfo ? parseFloat(priceInfo.price_usd || '0') : 0;

    // 获取机器人配置
    const { data: botConfig } = await client
      .from('bot_trading_config')
      .select('*')
      .eq('token_symbol', symbol)
      .maybeSingle();

    // 获取今日交易统计
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const { data: todayTrades } = await client
      .from('trade_history')
      .select('*')
      .eq('base_currency', symbol)
      .gte('created_at', todayStart.toISOString());

    // 统计用户交易
    const userTrades = todayTrades?.filter(t => t.trader_type === 'user') || [];
    const userBuyTrades = userTrades.filter(t => t.trade_type === 'buy');
    const userSellTrades = userTrades.filter(t => t.trade_type === 'sell');

    // 统计机器人交易
    const botTrades = todayTrades?.filter(t => t.trader_type === 'bot') || [];
    const botBuyTrades = botTrades.filter(t => t.trade_type === 'buy');
    const botSellTrades = botTrades.filter(t => t.trade_type === 'sell');

    // 获取订单簿深度
    const { data: openOrders } = await client
      .from('trade_orders')
      .select('*')
      .eq('base_currency', symbol)
      .eq('status', 'open');

    const buyOrders = openOrders?.filter(o => o.order_type === 'buy') || [];
    const sellOrders = openOrders?.filter(o => o.order_type === 'sell') || [];

    // 计算买卖压力
    const totalBuyAmount = buyOrders.reduce((sum, o) => sum + parseFloat(o.amount || '0') - parseFloat(o.filled_amount || '0'), 0);
    const totalSellAmount = sellOrders.reduce((sum, o) => sum + parseFloat(o.amount || '0') - parseFloat(o.filled_amount || '0'), 0);
    const buyPressure = totalBuyAmount / (totalBuyAmount + totalSellAmount + 0.001) * 100;

    // 获取最近价格历史（24小时）
    const { data: priceHistory } = await client
      .from('trade_history')
      .select('price, created_at')
      .eq('base_currency', symbol)
      .order('created_at', { ascending: false })
      .limit(100);

    // 计算价格统计
    const prices = priceHistory?.map(h => parseFloat(h.price)) || [];
    const highPrice = prices.length > 0 ? Math.max(...prices) : currentPrice;
    const lowPrice = prices.length > 0 ? Math.min(...prices) : currentPrice;
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b) / prices.length : currentPrice;

    // 获取机器人挂单
    const { data: botOpenOrders } = await client
      .from('trade_orders')
      .select('*')
      .eq('base_currency', symbol)
      .eq('trader_type', 'bot')
      .eq('status', 'open');

    res.json({
      success: true,
      data: {
        symbol,
        currentPrice,
        priceStats: {
          high: highPrice,
          low: lowPrice,
          avg: avgPrice,
        },
        botConfig: botConfig ? {
          enabled: botConfig.enabled,
          strategy: botConfig.strategy,
          todayBuyAmount: parseFloat(botConfig.today_buy_amount || '0'),
          todaySellAmount: parseFloat(botConfig.today_sell_amount || '0'),
          dailyBuyLimit: parseFloat(botConfig.daily_buy_limit || '0'),
          dailySellLimit: parseFloat(botConfig.daily_sell_limit || '0'),
          openOrders: botOpenOrders?.length || 0,
        } : null,
        tradingStats: {
          user: {
            buyCount: userBuyTrades.length,
            buyAmount: userBuyTrades.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0),
            buyValue: userBuyTrades.reduce((sum, t) => sum + parseFloat(t.total_value || '0'), 0),
            sellCount: userSellTrades.length,
            sellAmount: userSellTrades.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0),
            sellValue: userSellTrades.reduce((sum, t) => sum + parseFloat(t.total_value || '0'), 0),
          },
          bot: {
            buyCount: botBuyTrades.length,
            buyAmount: botBuyTrades.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0),
            buyValue: botBuyTrades.reduce((sum, t) => sum + parseFloat(t.total_value || '0'), 0),
            sellCount: botSellTrades.length,
            sellAmount: botSellTrades.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0),
            sellValue: botSellTrades.reduce((sum, t) => sum + parseFloat(t.total_value || '0'), 0),
          },
        },
        orderbook: {
          buyOrders: buyOrders.length,
          sellOrders: sellOrders.length,
          totalBuyAmount,
          totalSellAmount,
          buyPressure: buyPressure.toFixed(1),
        },
      },
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ success: false, message: '获取仪表盘数据失败' });
  }
});

// ==================== 机器人交易触发 ====================

/**
 * POST /api/v1/admin/bot/trigger
 * 手动触发机器人交易策略执行
 */
router.post('/bot/trigger', async (req: Request, res: Response) => {
  try {
    // 动态导入机器人交易服务
    const { runAllBotStrategies } = await import('../services/bot-trading-service');
    const result = await runAllBotStrategies();
    
    res.json({
      success: true,
      message: `机器人交易执行完成：${result.success} 个成功，${result.failed} 个失败`,
      data: result,
    });
  } catch (error) {
    console.error('触发机器人交易失败:', error);
    res.status(500).json({ success: false, message: '触发机器人交易失败' });
  }
});

// ==================== 交易对管理 ====================

/**
 * GET /api/v1/admin/trading-pairs
 * 获取所有交易对配置
 */
router.get('/trading-pairs', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('trading_pairs')
      .select('*')
      .order('display_order');

    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('获取交易对失败:', error);
    res.status(500).json({ success: false, message: '获取交易对失败' });
  }
});

/**
 * PUT /api/v1/admin/trading-pairs/:id
 * 更新交易对配置
 */
router.put('/trading-pairs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_viewable, is_trading_enabled, min_trade_amount } = req.body;
    
    const client = getSupabaseClient();
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    
    if (is_viewable !== undefined) updateData.is_viewable = is_viewable;
    if (is_trading_enabled !== undefined) updateData.is_trading_enabled = is_trading_enabled;
    if (min_trade_amount !== undefined) updateData.min_trade_amount = min_trade_amount;

    const { error } = await client
      .from('trading_pairs')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新交易对失败:', error);
    res.status(500).json({ success: false, message: '更新交易对失败' });
  }
});

// ==================== 代币管理 ====================

/**
 * GET /api/v1/admin/tokens
 * 获取所有代币信息（整合 token_prices + trading_pairs + token_info）
 */
router.get('/tokens', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    
    // 获取价格
    const { data: prices } = await client
      .from('token_prices')
      .select('*')
      .order('token_symbol');
    
    // 获取交易对
    const { data: pairs } = await client
      .from('trading_pairs')
      .select('*');
    
    // 获取代币信息
    const { data: tokenInfo } = await client
      .from('token_info')
      .select('*');
    
    // 整合数据
    const tokenMap = new Map();
    
    for (const p of prices || []) {
      tokenMap.set(p.token_symbol, {
        symbol: p.token_symbol,
        price: p.price_usd,
        change24h: p.change_24h,
        isPlatformToken: p.is_platform_token,
        priceSource: p.price_source,
        updatedAt: p.updated_at,
      });
    }
    
    for (const pair of pairs || []) {
      const existing = tokenMap.get(pair.base_currency) || { symbol: pair.base_currency };
      tokenMap.set(pair.base_currency, {
        ...existing,
        pairId: pair.id,
        pairSymbol: pair.pair_symbol,
        isViewable: pair.is_viewable,
        isTradingEnabled: pair.is_trading_enabled,
        minTradeAmount: pair.min_trade_amount,
        isActive: pair.is_active,
      });
    }
    
    for (const info of tokenInfo || []) {
      const existing = tokenMap.get(info.token_symbol) || { symbol: info.token_symbol };
      tokenMap.set(info.token_symbol, {
        ...existing,
        name: info.name,
        description: info.description,
        tokenInfoId: info.id,
      });
    }
    
    const tokens = Array.from(tokenMap.values());
    
    res.json({ success: true, data: tokens });
  } catch (error) {
    console.error('获取代币列表失败:', error);
    res.status(500).json({ success: false, message: '获取代币列表失败' });
  }
});

/**
 * POST /api/v1/admin/tokens
 * 一键添加新代币（创建 token_prices + trading_pairs + token_info）
 */
router.post('/tokens', async (req: Request, res: Response) => {
  try {
    const { symbol, name, price, isViewable, isTradingEnabled, description } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ success: false, message: '代币符号不能为空' });
    }
    
    const upperSymbol = symbol.toUpperCase();
    const client = getSupabaseClient();
    
    // 检查是否已存在
    const { data: existing } = await client
      .from('token_prices')
      .select('token_symbol')
      .eq('token_symbol', upperSymbol)
      .maybeSingle();
    
    if (existing) {
      return res.status(400).json({ success: false, message: '该代币已存在' });
    }
    
    // 1. 创建价格记录
    await client
      .from('token_prices')
      .insert({
        id: generateId(),
        token_symbol: upperSymbol,
        price_usd: price || '0',
        change_24h: 0,
        is_platform_token: true,
        price_source: 'manual',
        created_at: new Date().toISOString(),
      });
    
    // 2. 创建交易对
    await client
      .from('trading_pairs')
      .insert({
        id: generateId(),
        base_currency: upperSymbol,
        quote_currency: 'USDT',
        pair_symbol: `${upperSymbol}USDT`,
        is_active: true,
        is_trading_enabled: isTradingEnabled !== false,
        is_viewable: isViewable !== false,
        min_trade_amount: 1,
        display_order: 99,
        created_at: new Date().toISOString(),
      });
    
    // 3. 创建代币信息
    await client
      .from('token_info')
      .insert({
        id: generateId(),
        token_symbol: upperSymbol,
        name: name || upperSymbol,
        description: description || '',
        features: [],
        created_at: new Date().toISOString(),
      });
    
    res.json({ 
      success: true, 
      message: `代币 ${upperSymbol} 创建成功`,
      data: { symbol: upperSymbol }
    });
  } catch (error) {
    console.error('创建代币失败:', error);
    res.status(500).json({ success: false, message: '创建代币失败' });
  }
});

/**
 * DELETE /api/v1/admin/tokens/:symbol
 * 一键删除代币（清理所有关联数据）
 */
router.delete('/tokens/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const upperSymbol = (Array.isArray(symbol) ? symbol[0] : symbol).toUpperCase();
    const client = getSupabaseClient();
    
    // 保护核心代币
    const protectedTokens = ['USDT', 'BTC', 'ETH'];
    if (protectedTokens.includes(upperSymbol)) {
      return res.status(400).json({ 
        success: false, 
        message: `${upperSymbol} 是核心代币，无法删除` 
      });
    }
    
    // 1. 删除用户资产
    await client
      .from('assets')
      .delete()
      .eq('token_symbol', upperSymbol);
    
    // 2. 删除交易订单
    await client
      .from('trade_orders')
      .delete()
      .eq('base_currency', upperSymbol);
    
    // 3. 删除交易历史
    await client
      .from('trade_history')
      .delete()
      .eq('base_currency', upperSymbol);
    
    // 4. 删除 C2C 订单
    await client
      .from('c2c_orders')
      .delete()
      .eq('token_symbol', upperSymbol);
    
    // 5. 删除 K线数据
    await client
      .from('klines')
      .delete()
      .eq('pair_symbol', `${upperSymbol}USDT`);
    
    // 6. 删除交易对
    await client
      .from('trading_pairs')
      .delete()
      .eq('base_currency', upperSymbol);
    
    // 7. 删除代币信息
    await client
      .from('token_info')
      .delete()
      .eq('token_symbol', upperSymbol);
    
    // 8. 删除价格记录
    await client
      .from('token_prices')
      .delete()
      .eq('token_symbol', upperSymbol);
    
    res.json({ 
      success: true, 
      message: `代币 ${upperSymbol} 及所有关联数据已删除` 
    });
  } catch (error) {
    console.error('删除代币失败:', error);
    res.status(500).json({ success: false, message: '删除代币失败' });
  }
});

/**
 * PUT /api/v1/admin/tokens/:symbol
 * 更新代币信息
 */
router.put('/tokens/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { price, name, description, isViewable, isTradingEnabled, minTradeAmount } = req.body;
    const upperSymbol = (Array.isArray(symbol) ? symbol[0] : symbol).toUpperCase();
    const client = getSupabaseClient();
    
    // 更新价格
    if (price !== undefined) {
      await client
        .from('token_prices')
        .update({ 
          price_usd: price,
          updated_at: new Date().toISOString() 
        })
        .eq('token_symbol', upperSymbol);
    }
    
    // 更新代币信息
    if (name !== undefined || description !== undefined) {
      await client
        .from('token_info')
        .update({
          name,
          description,
          updated_at: new Date().toISOString(),
        })
        .eq('token_symbol', upperSymbol);
    }
    
    // 更新交易对配置
    if (isViewable !== undefined || isTradingEnabled !== undefined || minTradeAmount !== undefined) {
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (isViewable !== undefined) updateData.is_viewable = isViewable;
      if (isTradingEnabled !== undefined) updateData.is_trading_enabled = isTradingEnabled;
      if (minTradeAmount !== undefined) updateData.min_trade_amount = minTradeAmount;
      
      await client
        .from('trading_pairs')
        .update(updateData)
        .eq('base_currency', upperSymbol);
    }
    
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新代币失败:', error);
    res.status(500).json({ success: false, message: '更新代币失败' });
  }
});

// ==================== 返佣配置管理 ====================

// 获取返佣配置（包含最大层级）
router.get('/referral-config', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    
    // 获取层级配置
    const { data, error } = await client
      .from('referral_config')
      .select('*')
      .order('level', { ascending: true });
    
    if (error) throw error;
    
    // 获取最大层级配置
    const { data: maxLevelConfig } = await client
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'max_referral_levels')
      .maybeSingle();
    
    const maxLevel = parseInt(maxLevelConfig?.config_value || '10', 10);
    
    res.json({
      success: true,
      data: {
        config: data || [],
        maxLevel: maxLevel,
      }
    });
  } catch (error) {
    console.error('Failed to fetch referral config:', error);
    res.status(500).json({ success: false, message: '获取返佣配置失败' });
  }
});

// 更新最大层级配置
router.put('/referral-config/max-level', async (req: Request, res: Response) => {
  try {
    const { maxLevel } = req.body;
    
    if (!maxLevel || maxLevel < 1 || maxLevel > 20) {
      return res.status(400).json({ success: false, message: '层级数必须在 1-20 之间' });
    }
    
    const client = getSupabaseClient();
    
    // 更新最大层级配置
    await client
      .from('system_config')
      .update({ 
        config_value: String(maxLevel),
        updated_at: new Date().toISOString() 
      })
      .eq('config_key', 'max_referral_levels');
    
    // 检查并补充缺失的层级配置
    const { data: existingConfig } = await client
      .from('referral_config')
      .select('level');
    
    const existingLevels = new Set((existingConfig || []).map((c: any) => c.level));
    
    for (let level = 1; level <= maxLevel; level++) {
      if (!existingLevels.has(level)) {
        // 添加默认配置
        await client
          .from('referral_config')
          .insert({
            id: generateId(),
            level: level,
            reward_rate: 0.01, // 默认1%
            required_direct_count: level,
          });
      }
    }
    
    // 删除超出最大层级的配置
    await client
      .from('referral_config')
      .delete()
      .gt('level', maxLevel);
    
    res.json({ success: true, message: '更新成功', maxLevel });
  } catch (error) {
    console.error('Failed to update max level:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 更新单层返佣配置
router.put('/referral-config/:level', async (req: Request, res: Response) => {
  try {
    const { level } = req.params;
    const { reward_rate, required_direct_count } = req.body;
    const client = getSupabaseClient();
    
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (reward_rate !== undefined) {
      updateData.reward_rate = reward_rate;
    }
    if (required_direct_count !== undefined) {
      updateData.required_direct_count = required_direct_count;
    }
    
    const { error } = await client
      .from('referral_config')
      .update(updateData)
      .eq('level', Number(level));
    
    if (error) throw error;
    
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('Failed to update referral config:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 批量更新返佣配置
router.post('/referral-config/batch', async (req: Request, res: Response) => {
  try {
    const { config, maxLevel } = req.body;
    const client = getSupabaseClient();
    
    // 更新最大层级
    if (maxLevel !== undefined) {
      await client
        .from('system_config')
        .update({ 
          config_value: String(maxLevel),
          updated_at: new Date().toISOString() 
        })
        .eq('config_key', 'max_referral_levels');
    }
    
    // 批量更新各层级配置
    if (config && Array.isArray(config)) {
      for (const item of config) {
        await client
          .from('referral_config')
          .upsert({
            id: item.id || generateId(),
            level: item.level,
            reward_rate: item.reward_rate,
            required_direct_count: item.required_direct_count,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'level' });
      }
    }
    
    res.json({ success: true, message: '批量更新成功' });
  } catch (error) {
    console.error('Failed to batch update referral config:', error);
    res.status(500).json({ success: false, message: '批量更新失败' });
  }
});

// 获取推广统计列表
router.get('/referrals', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);
    
    const client = getSupabaseClient();
    
    // 获取用户列表，包含推荐统计和钱包地址
    const { data: users, count, error } = await client
      .from('users')
      .select(`
        id,
        nickname,
        phone,
        referral_code,
        referred_by,
        is_kyc_verified,
        created_at,
        referral_stats(direct_count, team_count, total_reward)
      `, { count: 'exact' })
      .not('referral_code', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(pageSize) - 1);
    
    if (error) throw error;
    
    // 获取钱包地址
    const userIds = (users || []).map((u: any) => u.id);
    const { data: wallets } = userIds.length > 0 ? await client
      .from('wallets')
      .select('user_id, address')
      .in('user_id', userIds) : { data: [] };
    const walletMap = new Map((wallets || []).map((w: any) => [w.user_id, w.address]));
    
    // 获取所有用户的总奖励
    const { data: totalRewardsData } = await client
      .from('referral_rewards')
      .select('amount');
    
    const totalRewards = totalRewardsData?.reduce(
      (sum: number, r: any) => sum + parseFloat(r.amount || '0'), 0
    ) || 0;
    
    // 获取总推广人数
    const { count: totalReferrals } = await client
      .from('users')
      .select('*', { count: 'exact', head: true })
      .not('referred_by', 'is', null);
    
    // 获取推广用户数
    const { count: totalPromoters } = await client
      .from('users')
      .select('*', { count: 'exact', head: true })
      .not('referral_code', 'is', null);
    
    // 获取平均推广人数
    const { data: avgData } = await client
      .from('referral_stats')
      .select('direct_count');
    
    const avgReferrals = avgData && avgData.length > 0
      ? avgData.reduce((sum: number, s: any) => sum + (s.direct_count || 0), 0) / avgData.length
      : 0;
    
    // 获取TOP 3推广者
    const { data: topPromoters } = await client
      .from('referral_stats')
      .select('user_id, direct_count, users(nickname)')
      .order('direct_count', { ascending: false })
      .limit(3);
    
    res.json({
      success: true,
      data: {
        list: (users || []).map((u: any) => ({
          id: u.id,
          walletAddress: walletMap.get(u.id) || '-',
          username: u.nickname || u.phone || 'Unknown',
          referralCode: u.referral_code,
          directCount: u.referral_stats?.[0]?.direct_count || 0,
          teamCount: u.referral_stats?.[0]?.team_count || 0,
          totalReward: u.referral_stats?.[0]?.total_reward || '0.00000000',
          unlockedLevel: u.referral_stats?.[0]?.direct_count || 0, // 直推几人解锁几层
          createdAt: u.created_at,
        })),
        total: count || 0,
        stats: {
          totalPromoters: totalPromoters || 0,
          totalReferrals: totalReferrals || 0,
          totalRewards: totalRewards.toFixed(8),
          avgReferrals: avgReferrals.toFixed(1),
          topPromoters: (topPromoters || []).map((p: any) => ({
            username: p.users?.nickname || 'Unknown',
            directCount: p.direct_count || 0,
          })),
        }
      }
    });
  } catch (error) {
    console.error('Failed to fetch referrals:', error);
    res.status(500).json({ success: false, message: '获取推广数据失败' });
  }
});

// ==================== 等级配置管理 (S1-S6) ====================

// 获取等级配置
router.get('/level-config', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('level_config')
      .select('*')
      .order('min_team_stake', { ascending: true });
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: {
        levels: data || [],
      }
    });
  } catch (error) {
    console.error('Failed to fetch level config:', error);
    res.status(500).json({ success: false, message: '获取等级配置失败' });
  }
});

// 更新等级配置
router.put('/level-config/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { level_name, min_team_stake, big_zone_rate, small_zone_rate } = req.body;
    const client = getSupabaseClient();
    
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (level_name !== undefined) {
      updateData.level_name = level_name;
    }
    if (min_team_stake !== undefined) {
      updateData.min_team_stake = min_team_stake;
    }
    if (big_zone_rate !== undefined) {
      updateData.big_zone_rate = big_zone_rate;
    }
    if (small_zone_rate !== undefined) {
      updateData.small_zone_rate = small_zone_rate;
    }
    
    const { error } = await client
      .from('level_config')
      .update(updateData)
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('Failed to update level config:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 创建等级配置
router.post('/level-config', async (req: Request, res: Response) => {
  try {
    const { level_name, min_team_stake, big_zone_rate, small_zone_rate } = req.body;
    const client = getSupabaseClient();
    
    if (!level_name || min_team_stake === undefined) {
      return res.status(400).json({ success: false, message: '等级名称和团队质押额不能为空' });
    }
    
    const { error } = await client
      .from('level_config')
      .insert({
        id: generateId(),
        level_name,
        min_team_stake,
        big_zone_rate: big_zone_rate || 0,
        small_zone_rate: small_zone_rate || 0,
      });
    
    if (error) throw error;
    
    res.json({ success: true, message: '创建成功' });
  } catch (error) {
    console.error('Failed to create level config:', error);
    res.status(500).json({ success: false, message: '创建失败' });
  }
});

// 删除等级配置
router.delete('/level-config/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();
    
    const { error } = await client
      .from('level_config')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('Failed to delete level config:', error);
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

// ==================== C2C买家列表标签配置 ====================

/**
 * GET /api/v1/admin/c2c/label-config
 * 获取C2C买家列表动态标签配置
 */
router.get('/c2c/label-config', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('system_config')
      .select('*')
      .eq('config_key', 'c2c_buyer_list_label')
      .maybeSingle();

    if (error) throw error;

    // 解析JSON配置
    let config = { text: 'GPU', color: '#22C55E', enabled: true };
    if (data?.config_value) {
      try {
        config = JSON.parse(data.config_value);
      } catch (e) {
        // 解析失败使用默认值
      }
    }

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Get c2c label config error:', error);
    res.status(500).json({ success: false, message: '获取配置失败' });
  }
});

/**
 * POST /api/v1/admin/c2c/label-config
 * 更新C2C买家列表动态标签配置
 */
router.post('/c2c/label-config', async (req: Request, res: Response) => {
  try {
    const { text, color, enabled } = req.body;
    const client = getSupabaseClient();

    const configValue = JSON.stringify({ text, color, enabled });

    // 查询是否存在
    const { data: existing } = await client
      .from('system_config')
      .select('id')
      .eq('config_key', 'c2c_buyer_list_label')
      .maybeSingle();

    let error;
    if (existing) {
      // 更新
      const result = await client
        .from('system_config')
        .update({ 
          config_value: configValue,
          updated_at: new Date().toISOString(),
        })
        .eq('config_key', 'c2c_buyer_list_label');
      error = result.error;
    } else {
      // 插入
      const result = await client
        .from('system_config')
        .insert({
          config_key: 'c2c_buyer_list_label',
          config_value: configValue,
          description: 'C2C买家列表动态标签配置(text:文字,color:颜色,enabled:是否启用)',
        });
      error = result.error;
    }

    if (error) throw error;

    res.json({ success: true, message: '配置已保存' });
  } catch (error) {
    console.error('Update c2c label config error:', error);
    res.status(500).json({ success: false, message: '保存配置失败' });
  }
});

// ==================== 公告管理 ====================

/**
 * GET /api/v1/admin/announcements
 * 获取公告列表
 */
router.get('/announcements', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('announcements')
      .select('*')
      .order('sort_order', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ success: false, message: '获取公告列表失败' });
  }
});

/**
 * POST /api/v1/admin/announcements
 * 创建公告
 */
router.post('/announcements', async (req: Request, res: Response) => {
  try {
    const { title, content, type, is_popup, is_active, sort_order } = req.body;
    const client = getSupabaseClient();

    if (!title || !content) {
      return res.status(400).json({ success: false, message: '标题和内容不能为空' });
    }

    const { data, error } = await client
      .from('announcements')
      .insert({
        id: generateId(),
        title,
        content,
        type: type || 'announcement',
        is_popup: is_popup ?? false,
        is_active: is_active ?? true,
        sort_order: sort_order || 0,
        created_by: (req as any).admin?.id,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data, message: '创建成功' });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ success: false, message: '创建公告失败' });
  }
});

/**
 * PUT /api/v1/admin/announcements/:id
 * 更新公告
 */
router.put('/announcements/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, type, is_popup, is_active, sort_order } = req.body;
    const client = getSupabaseClient();

    const updateData: any = { updated_at: new Date().toISOString() };
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (type !== undefined) updateData.type = type;
    if (is_popup !== undefined) updateData.is_popup = is_popup;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (sort_order !== undefined) updateData.sort_order = sort_order;

    const { error } = await client
      .from('announcements')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ success: false, message: '更新公告失败' });
  }
});

/**
 * DELETE /api/v1/admin/announcements/:id
 * 删除公告
 */
router.delete('/announcements/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();

    const { error } = await client
      .from('announcements')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ success: false, message: '删除公告失败' });
  }
});

export default router;
