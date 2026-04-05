import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  userApi, 
  User, 
  ReferralStats, 
  Wallet,
  setAuthToken, 
} from '@/services/api';

interface AuthContextType {
  // 状态
  user: User | null;
  wallet: Wallet | null;
  referralStats: ReferralStats | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // 方法
  login: (phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (phone: string, password: string, referralCode?: string) => Promise<{ success: boolean; error?: string }>;
  walletCreate: (password: string, referralCode?: string) => Promise<{ success: boolean; mnemonic?: string; error?: string }>;
  walletImport: (data: { mnemonic?: string; private_key?: string; password: string }) => Promise<{ success: boolean; is_new_user?: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';
const WALLET_KEY = 'wallet_data';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化：从存储中恢复登录状态
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (token) {
          setAuthToken(token);
          // 验证 token 是否有效
          const result = await userApi.getMe();
          if (result.success && result.data) {
            setUser(result.data.user);
            setReferralStats(result.data.referral_stats || null);
            
            // 恢复钱包信息
            const walletData = await AsyncStorage.getItem(WALLET_KEY);
            if (walletData) {
              setWallet(JSON.parse(walletData));
            }
          } else {
            // Token 无效，清除存储
            await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, WALLET_KEY]);
            setAuthToken(null);
          }
        }
      } catch (error) {
        console.error('Init auth error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    try {
      const result = await userApi.login(phone, password);
      
      if (result.success && result.data) {
        const { user, token } = result.data;
        
        // 保存 token
        await AsyncStorage.setItem(TOKEN_KEY, token);
        setAuthToken(token);
        
        // 保存用户信息
        setUser(user);
        
        // 获取推荐统计
        const statsResult = await userApi.getMe();
        if (statsResult.success && statsResult.data) {
          setReferralStats(statsResult.data.referral_stats || null);
        }
        
        return { success: true };
      }
      
      return { success: false, error: result.error || '登录失败' };
    } catch (error: any) {
      return { success: false, error: error.message || '网络错误' };
    }
  }, []);

  const register = useCallback(async (phone: string, password: string, referralCode?: string) => {
    try {
      const result = await userApi.register(phone, password, referralCode);
      
      if (result.success && result.data) {
        const { user, token } = result.data;
        
        // 保存 token
        await AsyncStorage.setItem(TOKEN_KEY, token);
        setAuthToken(token);
        
        // 保存用户信息
        setUser(user);
        
        return { success: true };
      }
      
      return { success: false, error: result.error || '注册失败' };
    } catch (error: any) {
      return { success: false, error: error.message || '网络错误' };
    }
  }, []);

  const walletCreate = useCallback(async (password: string, referralCode?: string) => {
    try {
      const result = await userApi.walletCreate(password, referralCode);
      
      if (result.success && result.data) {
        const { user, wallet, token } = result.data;
        
        // 保存 token
        await AsyncStorage.setItem(TOKEN_KEY, token);
        setAuthToken(token);
        
        // 保存用户信息
        setUser(user);
        
        // 保存钱包信息（不含助记词）
        const walletData: Wallet = { 
          id: wallet.id, 
          address: wallet.address,
          user_id: user.id,
          wallet_type: 'created',
          is_primary: true,
          has_mnemonic: true,
          created_at: new Date().toISOString(),
        };
        await AsyncStorage.setItem(WALLET_KEY, JSON.stringify(walletData));
        setWallet(walletData);
        
        return { success: true, mnemonic: wallet.mnemonic };
      }
      
      return { success: false, error: result.error || '创建钱包失败' };
    } catch (error: any) {
      return { success: false, error: error.message || '网络错误' };
    }
  }, []);

  const walletImport = useCallback(async (data: { mnemonic?: string; private_key?: string; password: string }) => {
    try {
      const result = await userApi.walletImport(data);
      
      if (result.success && result.data) {
        const { user, wallet, token, is_new_user } = result.data;
        
        // 保存 token
        await AsyncStorage.setItem(TOKEN_KEY, token);
        setAuthToken(token);
        
        // 保存用户信息
        setUser(user);
        
        // 保存钱包信息
        const walletData: Wallet = {
          ...wallet,
          has_mnemonic: wallet.wallet_type !== 'imported_private_key',
        };
        await AsyncStorage.setItem(WALLET_KEY, JSON.stringify(walletData));
        setWallet(walletData);
        
        return { success: true, is_new_user };
      }
      
      return { success: false, error: result.error || '导入钱包失败' };
    } catch (error: any) {
      return { success: false, error: error.message || '网络错误' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await userApi.logout();
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // 无论 API 是否成功，都清除本地状态
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, WALLET_KEY]);
      setAuthToken(null);
      setUser(null);
      setWallet(null);
      setReferralStats(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const result = await userApi.getMe();
      if (result.success && result.data) {
        setUser(result.data.user);
        setReferralStats(result.data.referral_stats || null);
      }
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  }, []);

  const value: AuthContextType = {
    user,
    wallet,
    referralStats,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    walletCreate,
    walletImport,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
