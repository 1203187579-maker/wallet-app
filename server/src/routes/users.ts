import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { 
  generateId, 
  generateReferralCode, 
  generateToken,
  hashPassword,
  verifyPassword,
  successResponse, 
  errorResponse 
} from '../utils';
import {
  generateMnemonicPhrase,
  validateMnemonic,
  derivePrivateKeyFromMnemonic,
  getAddressFromPrivateKey,
  encryptData,
} from '../utils/wallet';
import { authLimiter, auditMiddleware } from '../middleware/security';

const router = Router();

/**
 * 创建钱包并注册
 * POST /api/v1/users/wallet-create
 * Body: { password, referral_code? }
 * 返回: 用户信息、钱包信息（含助记词）、token
 */
router.post('/wallet-create', async (req: Request, res: Response) => {
  try {
    const { password, referral_code } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json(errorResponse('密码至少6位'));
    }

    const client = getSupabaseClient();

    // 生成钱包信息 - 使用真实的加密方法
    const mnemonic = generateMnemonicPhrase();
    const privateKey = derivePrivateKeyFromMnemonic(mnemonic);
    const address = getAddressFromPrivateKey(privateKey);
    const encryptedMnemonic = encryptData(mnemonic, password);
    const encryptedPrivateKey = encryptData(privateKey, password);

    // 检查地址是否已存在
    const { data: existingWallet } = await client
      .from('wallets')
      .select('id')
      .eq('address', address)
      .maybeSingle();

    if (existingWallet) {
      return res.status(400).json(errorResponse('钱包地址已存在，请重试'));
    }

    // 查找推荐人
    let referredBy = null;
    if (referral_code) {
      const { data: referrer } = await client
        .from('users')
        .select('id')
        .eq('referral_code', referral_code)
        .maybeSingle();
      if (referrer) {
        referredBy = referrer.id;
      }
    }

    // 创建用户
    const userId = generateId();
    const userReferralCode = generateReferralCode();

    const { error: userError } = await client
      .from('users')
      .insert({
        id: userId,
        phone: null, // 钱包登录用户没有手机号
        password_hash: null, // 钱包用户使用钱包密码
        referral_code: userReferralCode,
        referred_by: referredBy,
      });

    if (userError) throw userError;

    // 创建钱包
    const walletId = generateId();
    const { error: walletError } = await client
      .from('wallets')
      .insert({
        id: walletId,
        user_id: userId,
        wallet_type: 'created',
        address,
        encrypted_mnemonic: encryptedMnemonic,
        encrypted_private_key: encryptedPrivateKey,
        is_primary: true,
      });

    if (walletError) throw walletError;

    // 创建推荐统计记录
    await client.from('referral_stats').insert({
      user_id: userId,
    });

    // 初始化默认资产（包含AI代币）
    const defaultAssets = [
      { token_symbol: 'AI', balance: '0' },
      { token_symbol: 'BTC', balance: '0' },
      { token_symbol: 'ETH', balance: '0' },
      { token_symbol: 'USDT', balance: '0' },
    ];

    for (const asset of defaultAssets) {
      await client.from('assets').insert({
        id: generateId(),
        user_id: userId,
        wallet_id: walletId,
        token_symbol: asset.token_symbol,
        balance: asset.balance,
      });
    }

    // 创建会话
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30天过期

    await client.from('user_sessions').insert({
      user_id: userId,
      token,
      expires_at: expiresAt.toISOString(),
      is_active: true,
    });

    res.json(successResponse({
      user: {
        id: userId,
        wallet_address: address,
        referral_code: userReferralCode,
      },
      wallet: {
        id: walletId,
        address,
        mnemonic, // 仅创建时返回一次！
      },
      token,
      expires_at: expiresAt,
    }, '钱包创建成功'));
  } catch (error: any) {
    console.error('Wallet create error:', error);
    res.status(500).json(errorResponse(error.message || '创建钱包失败'));
  }
});

/**
 * 导入钱包并登录/注册
 * POST /api/v1/users/wallet-import
 * Body: { mnemonic?, private_key?, password }
 * 返回: 用户信息、钱包信息、token
 */
router.post('/wallet-import', async (req: Request, res: Response) => {
  try {
    const { mnemonic, private_key, password } = req.body;

    if (!mnemonic && !private_key) {
      return res.status(400).json(errorResponse('请提供助记词或私钥'));
    }
    if (!password) {
      return res.status(400).json(errorResponse('请输入钱包密码'));
    }

    const client = getSupabaseClient();

    let address: string;
    let derivedPrivateKey: string;
    let derivedMnemonic: string | null = null;
    let walletType: 'imported_mnemonic' | 'imported_private_key';

    if (mnemonic) {
      // 验证助记词
      const trimmedMnemonic = mnemonic.trim().toLowerCase();
      if (!validateMnemonic(trimmedMnemonic)) {
        return res.status(400).json(errorResponse('助记词无效，请检查是否正确'));
      }
      
      derivedMnemonic = trimmedMnemonic;
      derivedPrivateKey = derivePrivateKeyFromMnemonic(trimmedMnemonic);
      address = getAddressFromPrivateKey(derivedPrivateKey);
      walletType = 'imported_mnemonic';
    } else {
      // 私钥导入
      let pk = private_key.trim();
      if (!pk.startsWith('0x')) {
        pk = '0x' + pk;
      }
      
      try {
        address = getAddressFromPrivateKey(pk);
        derivedPrivateKey = pk;
      } catch (e) {
        return res.status(400).json(errorResponse('私钥格式无效'));
      }
      walletType = 'imported_private_key';
    }

    // 加密存储
    const encryptedMnemonic = derivedMnemonic ? encryptData(derivedMnemonic, password) : null;
    const encryptedPrivateKey = encryptData(derivedPrivateKey, password);

    // 查找钱包是否已存在
    const { data: existingWallet } = await client
      .from('wallets')
      .select('id, user_id')
      .eq('address', address)
      .maybeSingle();

    let userId: string;
    let walletId: string;
    let isNewUser = false;

    if (existingWallet) {
      // 钱包已存在，检查用户是否被禁用
      userId = existingWallet.user_id;
      walletId = existingWallet.id;
      
      // 获取用户信息检查是否被禁用
      const { data: existingUser } = await client
        .from('users')
        .select('is_active, disabled_features')
        .eq('id', userId)
        .single();
      
      if (existingUser) {
        // 检查用户是否被完全禁用
        if (!existingUser.is_active) {
          return res.status(403).json(errorResponse('IP地址不支持导入'));
        }
        
        // 检查登录功能是否被禁用
        const disabledFeatures = existingUser.disabled_features || [];
        if (disabledFeatures.includes('login')) {
          return res.status(403).json(errorResponse('IP地址不支持导入'));
        }
      }
    } else {
      // 新用户，创建账户
      isNewUser = true;
      userId = generateId();
      walletId = generateId();
      const userReferralCode = generateReferralCode();

      // 创建用户
      const { error: userError } = await client
        .from('users')
        .insert({
          id: userId,
          phone: null,
          password_hash: null,
          referral_code: userReferralCode,
        });

      if (userError) throw userError;

      // 创建钱包
      const { error: walletError } = await client
        .from('wallets')
        .insert({
          id: walletId,
          user_id: userId,
          wallet_type: walletType,
          address,
          encrypted_mnemonic: encryptedMnemonic,
          encrypted_private_key: encryptedPrivateKey,
          is_primary: true,
        });

      if (walletError) throw walletError;

      // 创建推荐统计记录
      await client.from('referral_stats').insert({
        user_id: userId,
      });

      // 初始化默认资产
      const defaultAssets = [
        { token_symbol: 'AI', balance: '0' },
        { token_symbol: 'BTC', balance: '0' },
        { token_symbol: 'ETH', balance: '0' },
        { token_symbol: 'USDT', balance: '0' },
      ];

      for (const asset of defaultAssets) {
        await client.from('assets').insert({
          id: generateId(),
          user_id: userId,
          wallet_id: walletId,
          token_symbol: asset.token_symbol,
          balance: asset.balance,
        });
      }
    }

    // 获取用户信息
    const { data: user } = await client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    // 创建会话
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await client.from('user_sessions').insert({
      user_id: userId,
      token,
      expires_at: expiresAt.toISOString(),
      is_active: true,
    });

    res.json(successResponse({
      user: {
        id: userId,
        wallet_address: address,
        nickname: user?.nickname,
        avatar_url: user?.avatar_url,
        referral_code: user?.referral_code,
        is_kyc_verified: user?.is_kyc_verified || false,
      },
      wallet: {
        id: walletId,
        address,
      },
      token,
      expires_at: expiresAt,
      is_new_user: isNewUser,
    }, isNewUser ? '钱包导入成功' : '登录成功'));
  } catch (error: any) {
    console.error('Wallet import error:', error);
    res.status(500).json(errorResponse(error.message || '导入钱包失败'));
  }
});

/**
 * 用户注册（保留手机号注册方式）
 * POST /api/v1/users/register
 * Body: { phone, password, referral_code? }
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { phone, password, referral_code } = req.body;

    if (!phone || !password) {
      return res.status(400).json(errorResponse('手机号和密码不能为空'));
    }

    const client = getSupabaseClient();

    // 检查手机号是否已注册
    const { data: existingUser } = await client
      .from('users')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json(errorResponse('手机号已注册'));
    }

    // 查找推荐人
    let referredBy = null;
    if (referral_code) {
      const { data: referrer } = await client
        .from('users')
        .select('id')
        .eq('referral_code', referral_code)
        .maybeSingle();
      if (referrer) {
        referredBy = referrer.id;
      }
    }

    // 创建用户
    const userId = generateId();
    const userReferralCode = generateReferralCode();
    const passwordHash = await hashPassword(password);

    const { error: userError } = await client
      .from('users')
      .insert({
        id: userId,
        phone,
        password_hash: passwordHash,
        referral_code: userReferralCode,
        referred_by: referredBy,
      });

    if (userError) {
      throw userError;
    }

    // 创建推荐统计记录
    await client.from('referral_stats').insert({
      user_id: userId,
    });

    // 创建会话
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天过期

    await client.from('user_sessions').insert({
      user_id: userId,
      token,
      expires_at: expiresAt.toISOString(),
      is_active: true,
    });

    res.json(successResponse({
      user: {
        id: userId,
        phone,
        referral_code: userReferralCode,
      },
      token,
      expires_at: expiresAt,
    }, '注册成功'));
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json(errorResponse(error.message || '注册失败'));
  }
});

/**
 * 用户登录（保留手机号登录方式）
 * POST /api/v1/users/login
 * Body: { phone, password }
 */
router.post('/login', authLimiter, auditMiddleware('USER_LOGIN', 'users'), async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json(errorResponse('手机号和密码不能为空'));
    }

    const client = getSupabaseClient();

    // 查找用户
    const { data: user, error } = await client
      .from('users')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json(errorResponse('手机号或密码错误'));
    }

    // 验证密码（支持 bcrypt 和旧的 SHA256 兼容）
    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json(errorResponse('手机号或密码错误'));
    }

    // 如果是旧密码格式，自动升级为 bcrypt
    if (user.password_hash && !user.password_hash.startsWith('$2')) {
      const newHash = await hashPassword(password);
      await client
        .from('users')
        .update({ password_hash: newHash })
        .eq('id', user.id);
    }

    if (!user.is_active) {
      return res.status(403).json(errorResponse('账号已被禁用'));
    }

    // 检查登录功能是否被禁用
    const disabledFeatures = user.disabled_features || [];
    if (disabledFeatures.includes('login')) {
      return res.status(403).json(errorResponse('登录功能已被禁用'));
    }

    // 创建会话
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await client.from('user_sessions').insert({
      user_id: user.id,
      token,
      expires_at: expiresAt.toISOString(),
      is_active: true,
    });

    // 更新最后登录时间
    await client
      .from('users')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', user.id);

    res.json(successResponse({
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        referral_code: user.referral_code,
        is_kyc_verified: user.is_kyc_verified,
      },
      token,
      expires_at: expiresAt,
    }, '登录成功'));
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json(errorResponse(error.message || '登录失败'));
  }
});

/**
 * 获取用户信息
 * GET /api/v1/users/me
 * Headers: Authorization: Bearer <token>
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const client = getSupabaseClient();

    // 验证会话
    const { data: session, error: sessionError } = await client
      .from('user_sessions')
      .select('user_id, users(*)')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (sessionError || !session) {
      return res.status(401).json(errorResponse('无效的 token'));
    }

    const user = session.users as any;

    // 获取钱包地址
    const { data: primaryWallet } = await client
      .from('wallets')
      .select('address')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .maybeSingle();

    // 获取推荐统计
    const { data: referralStats } = await client
      .from('referral_stats')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    res.json(successResponse({
      user: {
        id: user.id,
        phone: user.phone,
        wallet_address: primaryWallet?.address,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        referral_code: user.referral_code,
        is_kyc_verified: user.is_kyc_verified,
        disabled_features: user.disabled_features || [],
        created_at: user.created_at,
      },
      referral_stats: referralStats,
    }));
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json(errorResponse(error.message || '获取用户信息失败'));
  }
});

/**
 * 更新用户信息
 * PUT /api/v1/users/me
 * Headers: Authorization: Bearer <token>
 * Body: { nickname?, avatar_url? }
 */
router.put('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { nickname, avatar_url } = req.body;
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

    // 更新用户信息
    const updateData: any = { updated_at: new Date().toISOString() };
    if (nickname) updateData.nickname = nickname;
    if (avatar_url) updateData.avatar_url = avatar_url;

    const { error } = await client
      .from('users')
      .update(updateData)
      .eq('id', session.user_id);

    if (error) throw error;

    res.json(successResponse(null, '更新成功'));
  } catch (error: any) {
    console.error('Update user error:', error);
    res.status(500).json(errorResponse(error.message || '更新失败'));
  }
});

/**
 * 退出登录
 * POST /api/v1/users/logout
 * Headers: Authorization: Bearer <token>
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const client = getSupabaseClient();

    // 使会话失效
    await client
      .from('user_sessions')
      .update({ is_active: false })
      .eq('token', token);

    res.json(successResponse(null, '退出成功'));
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json(errorResponse(error.message || '退出失败'));
  }
});

export default router;
