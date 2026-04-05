/**
 * API ·þÎñ²ã
 */

import { Platform } from 'react-native';

export const getBaseUrl = () => {
  return 'http://192.168.110.155:9091';
};

const BASE_URL = getBaseUrl();

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface User {
  id: string;
  phone?: string;
  wallet_address?: string;
  nickname?: string;
  avatar_url?: string;
  referral_code: string;
  is_kyc_verified: boolean;
  disabled_features?: string[];
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  wallet_type: string;
  address: string;
  is_primary: boolean;
  has_mnemonic?: boolean;
  created_at: string;
}

export interface Asset {
  id: string;
  user_id: string;
  wallet_id: string;
  token_symbol: string;
  balance: string;
  frozen_balance: string;
  price_usd?: string;
  value_usd?: string;
  change_24h?: string;
}

export interface TokenPrice {
  token_symbol: string;
  price_usd: string;
  change_24h: string;
  isViewable?: boolean;
  isTradingEnabled?: boolean;
}

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const getAuthToken = () => authToken;

const request = async (endpoint, options = {}) => {
  const { method = 'GET', body, headers = {} } = options;
  const url = BASE_URL + '/api/v1' + endpoint;
  const requestHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };
  if (authToken) {
    requestHeaders['Authorization'] = 'Bearer ' + authToken;
  }
  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || data.message || 'ÇëÇóÊ§°Ü' };
    }
    return { success: true, data: data.data || data, message: data.message };
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, error: error.message || 'ÍøÂç´íÎó' };
  }
};

export const userApi = {
  walletCreate: (password, referralCode) => request('/users/wallet-create', { method: 'POST', body: { password, referral_code: referralCode } }),
  walletImport: (data) => request('/users/wallet-import', { method: 'POST', body: data }),
  getMe: () => request('/users/me'),
  logout: () => request('/users/logout', { method: 'POST' }),
};

export const walletApi = {
  create: (password) => request('/wallets/create', { method: 'POST', body: { password } }),
  import: (data) => request('/wallets/import', { method: 'POST', body: data }),
  getList: () => request('/wallets'),
};

export const assetApi = {
  getList: () => request('/assets'),
  getBySymbol: (symbol) => request('/assets/' + symbol),
};

export const stakeApi = {
  getConfig: () => request('/stake/config'),
  getRecords: () => request('/stake/my-stakes'),
  stake: (data) => request('/stake/create', { method: 'POST', body: data }),
  claim: () => request('/stake/claim-rewards', { method: 'POST' }),
};

export const c2cApi = {
  getBuyOrders: (orderType) => request('/c2c/buy-orders?order_type=' + orderType),
  getMyOrders: () => request('/c2c/my-orders'),
  sell: (buyOrderId, amount) => request('/c2c/sell', { method: 'POST', body: buyOrderId ? { buy_order_id: buyOrderId, amount } : { amount } }),
};

export const priceApi = {
  getAll: () => request('/prices'),
  getBySymbol: (symbol) => request('/prices/' + symbol),
};

export const tradeApi = {
  getBalance: () => request('/trade/balance'),
  execute: (data) => request('/trade/execute', { method: 'POST', body: data }),
  getOrderbook: (symbol, limit) => request('/trade/orderbook/' + symbol + '?limit=' + (limit || 20)),
};

export const kycApi = {
  getStatus: () => request('/kyc/status'),
  submit: (data) => request('/kyc/submit', { method: 'POST', body: data }),
};

export const referralApi = {
  getStats: () => request('/referral/stats'),
  getTeam: (level) => request('/referral/team' + (level ? '?level=' + level : '')),
};

export const configApi = {
  getPublic: () => request('/config/public'),
};
