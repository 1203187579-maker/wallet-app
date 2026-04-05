import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { 
  generateId, 
  successResponse, 
  errorResponse,
  hashPassword,
  checkFeatureDisabled,
} from '../utils';
import {
  generateMnemonicPhrase,
  validateMnemonic,
  derivePrivateKeyFromMnemonic,
  getAddressFromMnemonic,
  getAddressFromPrivateKey,
  encryptData,
  decryptData,
  generateWalletId,
} from '../utils/wallet';
import { sensitiveLimiter } from '../middleware/security';

const router = Router();

/**
 * 创建钱包
 * POST /api/v1/wallets/create
 * Headers: Authorization: Bearer <token>
 * Body: { password }
 * 返回：助记词（仅此一次）
 */
router.post('/create', sensitiveLimiter, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { password } = req.body;
    const client = getSupabaseClient();

    if (!password || password.length < 6) {
      return res.status(400).json(errorResponse('支付密码至少6位'));
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
    
    // 检查钱包功能是否被禁用
    const featureCheck = checkFeatureDisabled(user, 'wallet');
    if (featureCheck.disabled) {
      return res.status(403).json(errorResponse(featureCheck.message!));
    }

    // 检查用户是否已有钱包
    const { data: existingWallet } = await client
      .from('wallets')
      .select('id')
      .eq('user_id', session.user_id)
      .maybeSingle();

    if (existingWallet) {
      return res.status(400).json(errorResponse('您已有钱包，无法重复创建'));
    }

    // 生成助记词
    const mnemonic = generateMnemonicPhrase();
    
    // 从助记词派生私钥和地址
    const privateKey = derivePrivateKeyFromMnemonic(mnemonic);
    const address = getAddressFromPrivateKey(privateKey);
    
    // 加密存储
    const encryptedMnemonic = encryptData(mnemonic, password);
    const encryptedPrivateKey = encryptData(privateKey, password);

    // 创建钱包
    const walletId = generateId();
    const { error: walletError } = await client
      .from('wallets')
      .insert({
        id: walletId,
        user_id: session.user_id,
        wallet_type: 'created',
        address,
        encrypted_mnemonic: encryptedMnemonic,
        encrypted_private_key: encryptedPrivateKey,
        is_primary: true,
      });

    if (walletError) throw walletError;

    // 更新用户的钱包地址
    await client
      .from('users')
      .update({ wallet_address: address })
      .eq('id', session.user_id);

    // 初始化默认资产（AI + GPU）
    const defaultAssets = [
      { token_symbol: 'AI', balance: '0' },
      { token_symbol: 'GPU', balance: '0' },
    ];

    for (const asset of defaultAssets) {
      await client.from('assets').insert({
        id: generateId(),
        user_id: session.user_id,
        wallet_id: walletId,
        token_symbol: asset.token_symbol,
        balance: asset.balance,
      });
    }

    res.json(successResponse({
      wallet: {
        id: walletId,
        address,
        mnemonic, // 仅创建时返回一次，务必保存！
      },
    }, '钱包创建成功，请务必保存助记词！'));
  } catch (error: any) {
    console.error('Create wallet error:', error);
    res.status(500).json(errorResponse(error.message || '钱包创建失败'));
  }
});

/**
 * 导入钱包（助记词或私钥）
 * POST /api/v1/wallets/import
 * Headers: Authorization: Bearer <token>
 * Body: { mnemonic?, private_key?, password }
 */
router.post('/import', sensitiveLimiter, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { mnemonic, private_key, password } = req.body;
    const client = getSupabaseClient();

    if (!mnemonic && !private_key) {
      return res.status(400).json(errorResponse('请提供助记词或私钥'));
    }

    if (!password || password.length < 6) {
      return res.status(400).json(errorResponse('支付密码至少6位'));
    }

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

    // 检查该地址是否已被其他用户使用
    const { data: existingWallet } = await client
      .from('wallets')
      .select('id, user_id')
      .eq('address', address)
      .maybeSingle();

    if (existingWallet) {
      if (existingWallet.user_id === session.user_id) {
        return res.status(400).json(errorResponse('您已导入过此钱包'));
      }
      return res.status(400).json(errorResponse('该钱包已被其他账号导入'));
    }

    // 加密存储
    const encryptedMnemonic = derivedMnemonic ? encryptData(derivedMnemonic, password) : null;
    const encryptedPrivateKey = encryptData(derivedPrivateKey, password);

    // 创建钱包
    const walletId = generateId();
    const { error: walletError } = await client
      .from('wallets')
      .insert({
        id: walletId,
        user_id: session.user_id,
        wallet_type: walletType,
        address,
        encrypted_mnemonic: encryptedMnemonic,
        encrypted_private_key: encryptedPrivateKey,
        is_primary: true,
      });

    if (walletError) throw walletError;

    // 更新用户的钱包地址
    await client
      .from('users')
      .update({ wallet_address: address })
      .eq('id', session.user_id);

    // 初始化默认资产（AI + GPU）
    const defaultAssets = [
      { token_symbol: 'AI', balance: '0' },
      { token_symbol: 'GPU', balance: '0' },
    ];

    for (const asset of defaultAssets) {
      await client.from('assets').insert({
        id: generateId(),
        user_id: session.user_id,
        wallet_id: walletId,
        token_symbol: asset.token_symbol,
        balance: asset.balance,
      });
    }

    res.json(successResponse({
      wallet: {
        id: walletId,
        address,
        wallet_type: walletType,
      },
    }, '钱包导入成功'));
  } catch (error: any) {
    console.error('Import wallet error:', error);
    res.status(500).json(errorResponse(error.message || '钱包导入失败'));
  }
});

/**
 * 导出助记词
 * POST /api/v1/wallets/export-mnemonic
 * Headers: Authorization: Bearer <token>
 * Body: { password }
 */
router.post('/export-mnemonic', sensitiveLimiter, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { password } = req.body;
    const client = getSupabaseClient();

    if (!password) {
      return res.status(400).json(errorResponse('请输入支付密码'));
    }

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

    // 获取钱包
    const { data: wallet } = await client
      .from('wallets')
      .select('*')
      .eq('user_id', session.user_id)
      .eq('is_primary', true)
      .maybeSingle();

    if (!wallet) {
      return res.status(404).json(errorResponse('钱包不存在'));
    }

    if (!wallet.encrypted_mnemonic) {
      return res.status(400).json(errorResponse('该钱包是通过私钥导入的，无助记词'));
    }

    // 解密助记词
    try {
      const mnemonic = decryptData(wallet.encrypted_mnemonic, password);
      
      res.json(successResponse({
        mnemonic,
        address: wallet.address,
      }));
    } catch (e) {
      return res.status(400).json(errorResponse('支付密码错误'));
    }
  } catch (error: any) {
    console.error('Export mnemonic error:', error);
    res.status(500).json(errorResponse(error.message || '导出失败'));
  }
});

/**
 * 导出私钥
 * POST /api/v1/wallets/export-private-key
 * Headers: Authorization: Bearer <token>
 * Body: { password }
 */
router.post('/export-private-key', sensitiveLimiter, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { password } = req.body;
    const client = getSupabaseClient();

    if (!password) {
      return res.status(400).json(errorResponse('请输入支付密码'));
    }

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

    // 获取钱包
    const { data: wallet } = await client
      .from('wallets')
      .select('*')
      .eq('user_id', session.user_id)
      .eq('is_primary', true)
      .maybeSingle();

    if (!wallet) {
      return res.status(404).json(errorResponse('钱包不存在'));
    }

    let privateKey: string;

    // 如果有加密的私钥，直接解密
    if (wallet.encrypted_private_key) {
      try {
        privateKey = decryptData(wallet.encrypted_private_key, password);
      } catch (e) {
        return res.status(400).json(errorResponse('支付密码错误'));
      }
    } 
    // 如果没有私钥但有助记词，从助记词派生私钥
    else if (wallet.encrypted_mnemonic) {
      try {
        const mnemonic = decryptData(wallet.encrypted_mnemonic, password);
        privateKey = derivePrivateKeyFromMnemonic(mnemonic);
        
        // 顺便存储私钥，方便下次使用
        const encryptedPrivateKey = encryptData(privateKey, password);
        await client
          .from('wallets')
          .update({ encrypted_private_key: encryptedPrivateKey })
          .eq('id', wallet.id);
      } catch (e) {
        return res.status(400).json(errorResponse('支付密码错误'));
      }
    } else {
      return res.status(400).json(errorResponse('该钱包无私钥和助记词，无法导出'));
    }
    
    res.json(successResponse({
      private_key: privateKey,
      address: wallet.address,
    }));
  } catch (error: any) {
    console.error('Export private key error:', error);
    res.status(500).json(errorResponse(error.message || '导出失败'));
  }
});

/**
 * 获取用户钱包列表
 * GET /api/v1/wallets
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

    // 获取钱包列表
    const { data: wallets, error } = await client
      .from('wallets')
      .select('id, user_id, wallet_type, address, is_primary, created_at')
      .eq('user_id', session.user_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 添加是否有助记词的标识
    const walletsWithFlags = (wallets || []).map(w => ({
      ...w,
      has_mnemonic: w.wallet_type !== 'imported_private_key',
    }));

    res.json(successResponse({ wallets: walletsWithFlags }));
  } catch (error: any) {
    console.error('Get wallets error:', error);
    res.status(500).json(errorResponse(error.message || '获取钱包列表失败'));
  }
});

/**
 * 获取钱包详情
 * GET /api/v1/wallets/:id
 * Headers: Authorization: Bearer <token>
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { id } = req.params;
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

    // 获取钱包
    const { data: wallet, error } = await client
      .from('wallets')
      .select('id, user_id, wallet_type, address, is_primary, created_at')
      .eq('id', id)
      .eq('user_id', session.user_id)
      .maybeSingle();

    if (error) throw error;
    if (!wallet) {
      return res.status(404).json(errorResponse('钱包不存在'));
    }

    res.json(successResponse({ 
      wallet: {
        ...wallet,
        has_mnemonic: wallet.wallet_type !== 'imported_private_key',
      }
    }));
  } catch (error: any) {
    console.error('Get wallet error:', error);
    res.status(500).json(errorResponse(error.message || '获取钱包详情失败'));
  }
});

export default router;
