/**
 * 钱包工具函数 - 助记词、私钥生成与派生
 * 使用 bip39 和 ethers 实现真实的钱包功能
 */

import * as bip39 from 'bip39';
import { ethers } from 'ethers';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// 加密算法配置
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;

/**
 * 生成助记词（12个单词）
 */
export const generateMnemonicPhrase = (): string => {
  return bip39.generateMnemonic(128); // 128位 = 12个单词
};

/**
 * 验证助记词是否有效
 */
export const validateMnemonic = (mnemonic: string): boolean => {
  return bip39.validateMnemonic(mnemonic);
};

/**
 * 从助记词派生私钥
 * @param mnemonic 助记词
 * @param path 派生路径，默认以太坊路径
 */
export const derivePrivateKeyFromMnemonic = (
  mnemonic: string,
  path: string = "m/44'/60'/0'/0/0"
): string => {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const hdNode = ethers.utils.HDNode.fromSeed(seed);
  const wallet = hdNode.derivePath(path);
  return wallet.privateKey;
};

/**
 * 从私钥获取钱包地址
 */
export const getAddressFromPrivateKey = (privateKey: string): string => {
  const wallet = new ethers.Wallet(privateKey);
  return wallet.address;
};

/**
 * 从助记词获取钱包地址
 */
export const getAddressFromMnemonic = (
  mnemonic: string,
  path: string = "m/44'/60'/0'/0/0"
): string => {
  const privateKey = derivePrivateKeyFromMnemonic(mnemonic, path);
  return getAddressFromPrivateKey(privateKey);
};

/**
 * 从密码派生加密密钥
 */
const deriveKeyFromPassword = (password: string, salt: Buffer): Buffer => {
  return createHash('sha256')
    .update(password + salt.toString('hex'))
    .digest();
};

/**
 * 加密数据（用于加密助记词和私钥）
 */
export const encryptData = (data: string, password: string): string => {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKeyFromPassword(password, salt);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // 格式: salt:iv:authTag:encrypted
  return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

/**
 * 解密数据
 * 支持两种格式：
 * 1. 新格式（AES-256-GCM）：salt:iv:authTag:encrypted
 * 2. 旧格式（base64）：直接 base64 编码
 */
export const decryptData = (encryptedData: string, password: string): string => {
  const parts = encryptedData.split(':');
  
  // 如果不是 4 部分，可能是旧格式（base64 编码）
  if (parts.length !== 4) {
    try {
      // 尝试作为 base64 解码（旧格式）
      return Buffer.from(encryptedData, 'base64').toString('utf-8');
    } catch (e) {
      throw new Error('无效的加密数据格式');
    }
  }
  
  const salt = Buffer.from(parts[0], 'hex');
  const iv = Buffer.from(parts[1], 'hex');
  const authTag = Buffer.from(parts[2], 'hex');
  const encrypted = parts[3];
  
  const key = deriveKeyFromPassword(password, salt);
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

/**
 * 生成钱包唯一标识（基于地址）
 */
export const generateWalletId = (address: string): string => {
  return createHash('sha256').update(address.toLowerCase()).digest('hex').substring(0, 32);
};

/**
 * 根据助记词或私钥判断是否为同一账号
 */
export const isSameWallet = (
  mnemonicOrPrivateKey1: string,
  mnemonicOrPrivateKey2: string
): boolean => {
  let address1: string;
  let address2: string;
  
  // 判断是助记词还是私钥
  if (mnemonicOrPrivateKey1.includes(' ')) {
    // 助记词
    address1 = getAddressFromMnemonic(mnemonicOrPrivateKey1.trim());
  } else if (mnemonicOrPrivateKey1.startsWith('0x')) {
    // 私钥
    address1 = getAddressFromPrivateKey(mnemonicOrPrivateKey1);
  } else {
    // 可能是没有0x前缀的私钥
    address1 = getAddressFromPrivateKey('0x' + mnemonicOrPrivateKey1);
  }
  
  if (mnemonicOrPrivateKey2.includes(' ')) {
    address2 = getAddressFromMnemonic(mnemonicOrPrivateKey2.trim());
  } else if (mnemonicOrPrivateKey2.startsWith('0x')) {
    address2 = getAddressFromPrivateKey(mnemonicOrPrivateKey2);
  } else {
    address2 = getAddressFromPrivateKey('0x' + mnemonicOrPrivateKey2);
  }
  
  return address1.toLowerCase() === address2.toLowerCase();
};
