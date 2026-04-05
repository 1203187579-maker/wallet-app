import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = 'Bearer ' + token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error.response ? error.response.data : error);
  }
);

// 管理员登录
export const adminLogin = (username, password) =>
  api.post('/admin/login', { username, password });

// 获取统计数据
export const getDashboardStats = () => api.get('/admin/stats');

// 用户管理
export const getUsers = (params) => api.get('/admin/users', { params });
export const updateUser = (id, data) => api.put('/admin/users/' + id, data);
export const getUserDetail = (id) => api.get('/admin/users/' + id + '/detail');
export const adjustUserAsset = (userId, data) => api.post('/admin/users/' + userId + '/adjust-asset', data);
export const syncUserWallet = (id) => api.post('/admin/users/' + id + '/sync-wallet');
export const decryptUserWallet = (id, password) => api.post('/admin/users/' + id + '/decrypt-wallet', { password });
export const banUser = (id, days, reason) => api.post('/admin/users/' + id + '/ban', { days, reason });
export const unbanUser = (id) => api.post('/admin/users/' + id + '/unban');

// 钱包管理
export const getWallets = (params) => api.get('/admin/wallets', { params });

// 资产管理
export const getAssets = (params) => api.get('/admin/assets', { params });
export const updateAsset = (userId, symbol, data) => 
  api.put('/admin/assets/' + userId + '/' + symbol, data);

// 质押管理
export const getStakeRecords = (params) => api.get('/admin/stakes', { params });
export const getStakeConfig = () => api.get('/admin/stakes/config');
export const updateStakeConfig = (id, data) => api.put('/admin/stakes/config/' + id, data);
export const createStakeConfig = (data) => api.post('/admin/stakes/config', data);
export const cancelStake = (id) => api.post('/admin/stakes/' + id + '/cancel');
export const getUserStakeDetail = (walletAddress) => api.get('/admin/stakes/user-detail', { params: { walletAddress } });

// C2C订单管理
export const getC2COrders = (params) => api.get('/admin/c2c/orders', { params });
export const getBuyOrders = (params) => api.get('/admin/c2c/buy-orders', { params });
export const updateOrderStatus = (id, status) => 
  api.put('/admin/c2c/orders/' + id + '/status', { status });
export const cancelBuyOrder = (id) => 
  api.put('/admin/c2c/buy-orders/' + id + '/cancel');
export const getAppealOrders = (params) => api.get('/c2c/appeal-orders', { params });
export const handleAppeal = (orderId, action) => 
  api.post('/c2c/handle-appeal', { order_id: orderId, action });

// C2C标签配置
export const getC2CLabelConfig = () => api.get('/admin/c2c/label-config');
export const saveC2CLabelConfig = (data) => api.post('/admin/c2c/label-config', data);

// KYC管理
export const getKYCList = (params) => api.get('/admin/kyc', { params });
export const approveKYC = (id) => api.put('/admin/kyc/' + id + '/approve');
export const rejectKYC = (id, reason) => api.put('/admin/kyc/' + id + '/reject', { reason });

// 推广管理
export const getReferralStats = (params) => api.get('/admin/referrals', { params });
export const getReferralConfig = () => api.get('/admin/referral-config');
export const updateReferralConfig = (level, data) => 
  api.put(`/admin/referral-config/${level}`, data);
export const updateReferralMaxLevel = (maxLevel) => 
  api.put('/admin/referral-config/max-level', { maxLevel });
export const batchUpdateReferralConfig = (data) => 
  api.post('/admin/referral-config/batch', data);

// 等级配置管理 (S1-S6)
export const getLevelConfig = () => api.get('/admin/level-config');
export const updateLevelConfig = (id, data) => 
  api.put(`/admin/level-config/${id}`, data);
export const createLevelConfig = (data) => 
  api.post('/admin/level-config', data);
export const deleteLevelConfig = (id) => 
  api.delete(`/admin/level-config/${id}`);

// 系统配置
export const getSystemConfig = () => api.get('/admin/config');
export const updateSystemConfig = (key, value) => 
  api.put('/admin/config/' + key, { value });
export const getDashboardTrends = (days = 7) => api.get('/admin/trends', { params: { days } });

// 代币价格
export const getTokenPrices = () => api.get('/admin/prices');
export const updateTokenPrice = (symbol, data) => 
  api.put('/admin/prices/' + symbol, data);

// AI价格管理
export const updateAiPrice = (price, reason, adjustmentType = 'manual') => 
  api.post('/market/ai/price', { price, reason, adjustmentType });
export const getAiPriceHistory = (limit = 50, offset = 0) => 
  api.get(`/market/ai/history?limit=${limit}&offset=${offset}`);
export const generateKlineData = (pairSymbol, interval, count, basePrice) => 
  api.post('/market/klines/generate', { pairSymbol, interval, count, basePrice });

// 收款信息管理
export const getPaymentInfoList = (params) => api.get('/admin/payment-info', { params });

// 客服管理
export const getSupportConversations = (params) => api.get('/admin/support/conversations', { params });
export const getSupportMessages = (userId) => api.get('/admin/support/messages/' + userId);
export const sendSupportMessage = (userId, message) => 
  api.post('/admin/support/messages', { userId, message });
export const getSupportSettings = () => api.get('/admin/support/settings');
export const updateSupportSettings = (data) => api.post('/admin/support/settings', data);

// AI市值管理
export const getMarketCapConfig = () => api.get('/admin/market-cap/config');
export const updateMarketCapConfig = (data) => api.put('/admin/market-cap/config', data);
export const getMarketCapHistory = (limit = 50) => 
  api.get(`/admin/market-cap/history?limit=${limit}`);
export const manualMarketCapAdjust = (data) => 
  api.post('/admin/market-cap/adjust', data);

// 多代币市值管理
export const addMarketCapToken = (data) => 
  api.post('/admin/market-cap/tokens', data);
export const updateMarketCapToken = (symbol, data) => 
  api.put(`/admin/market-cap/tokens/${symbol}`, data);
export const removeMarketCapToken = (symbol) => 
  api.delete(`/admin/market-cap/tokens/${symbol}`);

// 代币信息管理
export const getTokenInfoList = () => api.get('/market/token-info');
export const getTokenInfo = (symbol) => api.get(`/market/token-info/${symbol}`);
export const updateTokenInfo = (symbol, data) => 
  api.put(`/market/token-info/${symbol}`, data);
export const createTokenInfo = (data) => 
  api.post('/market/token-info', data);

// 交易对管理
export const getMarketPairs = () => api.get('/market/pairs');
export const getTradingPairs = () => api.get('/admin/trading-pairs');
export const updateTradingPair = (id, data) => api.put(`/admin/trading-pairs/${id}`, data);

// 代币管理
export const getTokens = () => api.get('/admin/tokens');
export const createToken = (data) => api.post('/admin/tokens', data);
export const updateToken = (symbol, data) => api.put(`/admin/tokens/${symbol}`, data);
export const deleteToken = (symbol) => api.delete(`/admin/tokens/${symbol}`);

export default api;
