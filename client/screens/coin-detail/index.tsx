import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Alert,
  TextInput,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import RNSSE from 'react-native-sse';
import { Screen } from '@/components/Screen';
import { InteractiveKLine, KLineInterval } from '@/components/InteractiveKLine';
import { useTheme } from '@/hooks/useTheme';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { tradeApi, getAuthToken } from '@/services/api';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || '';

interface PriceData {
  id: string;
  symbol: string;
  priceUsd: string;
  change24h: string | null;
  volume24h: string | null;
  high24h: string | null;
  low24h: string | null;
  marketCap: string | null;
  priceSource: string;
  updatedAt: string;
}

interface KLineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface OrderbookItem {
  price: string;
  amount: number;
  count: number;
}

interface MyOrder {
  id: string;
  order_type: 'buy' | 'sell';
  base_currency: string;
  quote_currency: string;
  amount: string;
  price: string;
  filled_amount: string;
  status: 'open' | 'partial' | 'filled' | 'cancelled';
  created_at: string;
}

interface TradeHistoryItem {
  id: string;
  trade_type: 'buy' | 'sell';
  base_currency: string;
  quote_currency: string;
  amount: string;
  price: string;
  total_value: string;
  fee: string;
  status: string;
  created_at: string;
}

// 代币信息接口
interface TokenInfo {
  id: number;
  symbol: string;
  name: string;
  description: string;
  issueDate: string | null;
  totalSupply: string | null;
  consensusMechanism: string | null;
  blockchainNetwork: string | null;
  features: { icon: string; label: string }[];
  websiteUrl: string | null;
  whitepaperUrl: string | null;
}

// 代币信息映射（图标）
const TOKEN_ICONS: Record<string, string> = {
  'AI': 'robot',
  'GPU': 'microchip',
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDT': 'dollar-sign',
};

export default function CoinDetailScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ symbol: string }>();
  const symbol = params.symbol || 'BTC';
  const { user } = useAuth();

  const screenWidth = Dimensions.get('window').width;

  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [klineData, setKlineData] = useState<KLineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [klineInterval, setKlineInterval] = useState<KLineInterval>('1h');
  const [klineLoading, setKlineLoading] = useState(false);
  
  // 交易相关状态
  const [usdtBalance, setUsdtBalance] = useState(0);
  const [coinBalance, setCoinBalance] = useState(0);
  const [isTradingEnabled, setIsTradingEnabled] = useState(true);
  
  // Tab 切换
  const [activeTab, setActiveTab] = useState<'orderbook' | 'info' | 'orders' | 'history'>('orderbook');
  
  // 代币信息
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  
  // 订单簿
  const [bids, setBids] = useState<OrderbookItem[]>([]);
  const [asks, setAsks] = useState<OrderbookItem[]>([]);
  
  // 我的挂单
  const [myOrders, setMyOrders] = useState<MyOrder[]>([]);
  
  // 交易历史
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryItem[]>([]);
  
  // 挂单表单
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [orderAmount, setOrderAmount] = useState('');
  const [orderPrice, setOrderPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 获取代币信息
  const fetchTokenInfo = async () => {
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/market/token-info/${symbol}`
      );
      const result = await response.json();
      if (result.success && result.data) {
        setTokenInfo(result.data);
      }
    } catch (error) {
      console.error('获取代币信息失败:', error);
    }
  };

  // 获取价格数据
  const fetchPriceData = async () => {
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/market/price/${symbol}`
      );
      const result = await response.json();
      if (result.success) {
        setPriceData(result.data);
        // 设置默认挂单价格
        if (result.data?.priceUsd && !orderPrice) {
          setOrderPrice(parseFloat(result.data.priceUsd).toFixed(4));
        }
      }
    } catch (error) {
      console.error('获取价格失败:', error);
    }
  };

  // 获取K线数据
  const fetchKlineData = async (interval?: KLineInterval) => {
    const currentInterval = interval || klineInterval;
    setKlineLoading(true);
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/market/klines/${symbol}USDT?interval=${currentInterval}&limit=100`
      );
      const result = await response.json();
      if (result.success) {
        setKlineData(result.data);
      } else {
        setKlineData([]);
      }
    } catch (error) {
      console.error('获取K线数据失败:', error);
      setKlineData([]);
    } finally {
      setKlineLoading(false);
    }
  };

  // K线周期切换
  const handleIntervalChange = (newInterval: KLineInterval) => {
    setKlineInterval(newInterval);
    fetchKlineData(newInterval);
  };

  // 获取交易配置
  const fetchTradeConfig = async () => {
    try {
      const result = await tradeApi.getConfig(symbol);
      if (result.success && result.data) {
        setIsTradingEnabled(result.data.isTradingEnabled);
      }
    } catch (error) {
      console.error('获取交易配置失败:', error);
    }
  };

  // 获取用户余额
  const fetchUserBalance = async () => {
    try {
      const result = await tradeApi.getBalance();
      if (result.success && result.data) {
        setUsdtBalance(parseFloat(result.data.usdtBalance) || 0);
        setCoinBalance(parseFloat(result.data.coinBalances?.[symbol]) || 0);
      }
    } catch (error) {
      console.error('获取余额失败:', error);
    }
  };

  // 获取订单簿
  const fetchOrderbook = async () => {
    try {
      const result = await tradeApi.getOrderbook(symbol, 10);
      if (result.success && result.data) {
        setBids(result.data.bids || []);
        setAsks(result.data.asks || []);
      }
    } catch (error) {
      console.error('获取订单簿失败:', error);
    }
  };

  // 获取我的挂单
  const fetchMyOrders = async () => {
    try {
      const result = await tradeApi.getMyOrders(symbol, 'open');
      if (result.success && result.data) {
        setMyOrders(result.data as MyOrder[]);
      }
    } catch (error) {
      console.error('获取我的挂单失败:', error);
    }
  };

  // 获取交易历史
  const fetchTradeHistory = async () => {
    try {
      const result = await tradeApi.getHistory(20, 0);
      if (result.success && result.data) {
        const filtered = (result.data as TradeHistoryItem[]).filter(
          item => item.base_currency === symbol
        );
        setTradeHistory(filtered);
      }
    } catch (error) {
      console.error('获取交易历史失败:', error);
    }
  };

  // 提交挂单
  const handleSubmitOrder = async () => {
    const amount = parseFloat(orderAmount);
    const price = parseFloat(orderPrice);

    if (!amount || amount <= 0) {
      Alert.alert('错误', '请输入有效数量');
      return;
    }
    if (!price || price <= 0) {
      Alert.alert('错误', '请输入有效价格');
      return;
    }

    // 检查余额
    if (orderType === 'buy') {
      const required = amount * price;
      if (usdtBalance < required) {
        Alert.alert('余额不足', `需要 ${required.toFixed(2)} USDT`);
        return;
      }
    } else {
      if (coinBalance < amount) {
        Alert.alert('余额不足', `${symbol} 余额不足`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await tradeApi.createOrder({
        orderType,
        baseCurrency: symbol,
        amount,
        price,
      });

      if (result.success) {
        Alert.alert('成功', result.data?.message || '挂单成功');
        setOrderAmount('');
        // 刷新数据
        fetchUserBalance();
        fetchOrderbook();
        fetchMyOrders();
        fetchTradeHistory();
      } else {
        Alert.alert('失败', result.error || '挂单失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  // 取消挂单
  const handleCancelOrder = async (orderId: string) => {
    // 调试信息
    const currentToken = getAuthToken();
    console.log('当前token:', currentToken?.substring(0, 20) + '...');
    console.log('尝试撤销订单:', orderId);
    
    // 跨平台确认对话框
    const confirmCancel = async () => {
      try {
        console.log('开始调用 cancelOrder API...');
        const result = await tradeApi.cancelOrder(orderId);
        console.log('撤销结果:', JSON.stringify(result));
        if (result.success) {
          Alert.alert('成功', '订单已取消');
          fetchUserBalance();
          fetchMyOrders();
          fetchOrderbook();
        } else {
          // 显示详细错误信息
          const errorMsg = result.error || result.message || '取消失败';
          console.log('撤销失败:', errorMsg);
          Alert.alert('失败', errorMsg);
        }
      } catch (error: any) {
        console.log('撤销异常:', error);
        Alert.alert('错误', error.message || '网络错误');
      }
    };

    // Web 端使用 window.confirm，移动端使用 Alert.alert
    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm('确定要取消此订单吗？')) {
        await confirmCancel();
      }
    } else {
      Alert.alert(
        '取消订单',
        '确定要取消此订单吗？',
        [
          { text: '取消', style: 'cancel' },
          { text: '确定', onPress: confirmCancel },
        ]
      );
    }
  };

  // 初始化加载
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([
        fetchTokenInfo(),
        fetchPriceData(),
        fetchKlineData(),
        fetchTradeConfig(),
        fetchUserBalance(),
        fetchOrderbook(),
        fetchMyOrders(),
        fetchTradeHistory(),
      ]);
      setLoading(false);
    };
    init();
  }, [symbol]);

  // 页面聚焦时刷新数据
  useFocusEffect(
    useCallback(() => {
      fetchPriceData();
      fetchUserBalance();
      fetchOrderbook();
      fetchMyOrders();
      fetchTradeHistory();
    }, [symbol])
  );

  // SSE 订单簿实时订阅
  const sseRef = useRef<RNSSE | null>(null);

  useEffect(() => {
    // 连接 SSE
    const sseUrl = `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/trade/orderbook/${symbol}/stream`;
    
    sseRef.current = new RNSSE(sseUrl, {
      headers: {
        'Accept': 'text/event-stream',
      },
    });

    // 监听订单簿更新
    sseRef.current.addEventListener('message', (event: any) => {
      try {
        if (event.data === '[DONE]') {
          return;
        }
        const data = JSON.parse(event.data);
        if (data.bids && data.asks) {
          setBids(data.bids);
          setAsks(data.asks);
        }
        // 更新价格统计数据（24h最高、最低、成交量、涨跌幅）
        if (data.priceUsd || data.high24h || data.low24h || data.volume24h || data.change24h !== undefined) {
          setPriceData(prev => prev ? {
            ...prev,
            priceUsd: data.priceUsd?.toString() || prev.priceUsd,
            high24h: data.high24h?.toString() || prev.high24h,
            low24h: data.low24h?.toString() || prev.low24h,
            volume24h: data.volume24h?.toString() || prev.volume24h,
            change24h: data.change24h !== undefined && data.change24h !== null ? data.change24h.toString() : prev.change24h,
          } : null);
        }
      } catch (error) {
        // 忽略解析错误
      }
    });

    sseRef.current.addEventListener('error', (error: any) => {
      console.log('[OrderbookSSE] 连接错误:', error);
    });

    return () => {
      // 清理 SSE 连接
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [symbol]);

  const changeValue = priceData?.change24h ? parseFloat(priceData.change24h) : 0;
  const isPositive = changeValue >= 0;

  // 计算订单簿最大金额（用于热力背景条宽度比例）
  const maxOrderAmount = useMemo(() => {
    const allAmounts = [...bids.map(b => b.amount), ...asks.map(a => a.amount)];
    return Math.max(...allAmounts, 1);
  }, [bids, asks]);

  // 格式化价格
  const formatPrice = (priceStr: string | null | undefined) => {
    if (!priceStr) return '--';
    const price = parseFloat(priceStr);
    if (isNaN(price)) return '--';
    if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(8);
  };

  // 格式化成交量
  const formatVolume = (volumeStr: string | null | undefined) => {
    if (!volumeStr) return '--';
    const volume = parseFloat(volumeStr);
    if (isNaN(volume)) return '--';
    if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `${(volume / 1e6).toFixed(2)}M`;
    if (volume >= 1e3) return `${(volume / 1e3).toFixed(2)}K`;
    return volume.toFixed(2);
  };

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}小时前`;
    return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
  };

  // 计算最大深度用于显示比例
  const maxDepth = useMemo(() => {
    const allAmounts = [...bids, ...asks].map(o => o.amount);
    return Math.max(...allAmounts, 0.001);
  }, [bids, asks]);

  if (loading) {
    return (
      <Screen backgroundColor="#000000" statusBarStyle="light">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor="#000000" statusBarStyle="light">
      <ScrollView style={styles.container} bounces={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
              <FontAwesome6 name="arrow-left" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.pairName}>{symbol}/USDT</Text>
              <View style={styles.headerTopRow}>
                <Text style={[styles.currentPrice, isPositive ? styles.priceUp : styles.priceDown]}>
                  ${formatPrice(priceData?.priceUsd)}
                </Text>
                <Text style={[styles.priceChangeText, isPositive ? styles.priceUp : styles.priceDown]}>
                  {isPositive ? '+' : ''}{changeValue.toFixed(2)}%
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton}>
              <FontAwesome6 name="star" size={18} color="#F59E0B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* K线图 */}
        <View style={{ marginTop: 10 }}>
          <InteractiveKLine
            data={klineData}
            width={screenWidth}
            height={260}
            color="#F59E0B"
            animationDuration={1500}
            autoPlay={true}
            interval={klineInterval}
            onIntervalChange={handleIntervalChange}
          />
          {klineLoading && (
            <View style={styles.klineLoading}>
              <ActivityIndicator size="small" color="#F59E0B" />
            </View>
          )}
        </View>

        {/* 统计数据 */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>24h最高</Text>
            <Text style={styles.statValue}>${formatPrice(priceData?.high24h)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>24h最低</Text>
            <Text style={styles.statValue}>${formatPrice(priceData?.low24h)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>24h成交</Text>
            <Text style={styles.statValue}>${formatVolume(priceData?.volume24h)}</Text>
          </View>
        </View>

        {/* 挂单表单 */}
        <View style={styles.orderForm}>
          <View style={styles.orderFormHeader}>
            <Text style={styles.orderFormTitle}>限价挂单</Text>
            <View style={styles.orderTypeToggle}>
              <TouchableOpacity 
                style={[styles.orderTypeBtn, orderType === 'buy' && styles.orderTypeBtnActive]}
                onPress={() => setOrderType('buy')}
              >
                <Text style={[styles.orderTypeText, orderType === 'buy' && styles.orderTypeTextActive]}>买入</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.orderTypeBtn, orderType === 'sell' && styles.orderTypeBtnActive]}
                onPress={() => setOrderType('sell')}
              >
                <Text style={[styles.orderTypeText, orderType === 'sell' && styles.orderTypeTextActive]}>卖出</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputLabel}>数量 ({symbol})</Text>
                <TouchableOpacity 
                  style={styles.maxBtn}
                  onPress={() => {
                    if (orderType === 'buy') {
                      // 买入时，根据 USDT 余额计算可买数量
                      const price = parseFloat(orderPrice) || 0;
                      if (price > 0) {
                        setOrderAmount((usdtBalance / price).toFixed(6));
                      }
                    } else {
                      // 卖出时，填入代币余额
                      setOrderAmount(coinBalance.toFixed(6));
                    }
                  }}
                >
                  <Text style={styles.maxBtnText}>全部</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                value={orderAmount}
                onChangeText={setOrderAmount}
                placeholder="0.00"
                placeholderTextColor="#4B5563"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>价格 (USDT)</Text>
              <TextInput
                style={styles.input}
                value={orderPrice}
                onChangeText={setOrderPrice}
                placeholder="0.00"
                placeholderTextColor="#4B5563"
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          
          <Text style={styles.balanceInfo}>
            可用: {orderType === 'buy' ? `${usdtBalance.toFixed(2)} USDT` : `${coinBalance.toFixed(8)} ${symbol}`}
          </Text>
          <Text style={styles.feeInfo}>
            手续费: 0.3%（买卖双方各付0.15%）
          </Text>

          <TouchableOpacity 
            style={[styles.submitBtn, orderType === 'buy' ? styles.submitBtnBuy : styles.submitBtnSell]}
            onPress={handleSubmitOrder}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>
                {orderType === 'buy' ? '挂买单' : '挂卖单'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Tab 切换 */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'orderbook' && styles.tabActive]}
            onPress={() => setActiveTab('orderbook')}
          >
            <Text style={[styles.tabText, activeTab === 'orderbook' && styles.tabTextActive]}>订单簿</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'info' && styles.tabActive]}
            onPress={() => setActiveTab('info')}
          >
            <Text style={[styles.tabText, activeTab === 'info' && styles.tabTextActive]}>代币信息</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'orders' && styles.tabActive]}
            onPress={() => setActiveTab('orders')}
          >
            <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>我的挂单</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>成交记录</Text>
          </TouchableOpacity>
        </View>

        {/* 订单簿 */}
        {activeTab === 'orderbook' && (
          <View style={styles.orderbookSection}>
            {/* 标题行 */}
            <View style={styles.orderbookHeaderRow}>
              <Text style={styles.orderbookTitleText}>买单 (买入)</Text>
              <Text style={styles.orderbookTitleText}>卖单 (卖出)</Text>
            </View>
            
            {/* 表头 */}
            <View style={styles.orderbookHeaderRow}>
              <View style={styles.orderbookHalf}>
                <Text style={styles.orderbookHeaderLabel}>价格(USDT)</Text>
                <Text style={styles.orderbookHeaderLabel}>数量</Text>
              </View>
              <View style={styles.orderbookHalf}>
                <Text style={styles.orderbookHeaderLabel}>价格(USDT)</Text>
                <Text style={styles.orderbookHeaderLabel}>数量</Text>
              </View>
            </View>

            {/* 订单列表 */}
            <View style={styles.orderbookListRow}>
              {/* 买单列表 */}
              <View style={styles.orderbookHalf}>
                {bids.length === 0 ? (
                  <View style={styles.orderbookEmpty}>
                    <Text style={styles.orderbookEmptyText}>暂无买单</Text>
                  </View>
                ) : (
                  bids.slice(0, 8).map((bid, index) => {
                    const depthPercent = (bid.amount / maxOrderAmount) * 100;
                    return (
                      <View key={`bid-${index}`} style={styles.orderbookItemBuy}>
                        {/* 热力背景条 - 从右向左延伸 */}
                        <View 
                          style={[
                            styles.orderbookDepthBar, 
                            styles.orderbookDepthBarBuy,
                            { width: `${depthPercent}%` }
                          ]} 
                        />
                        <Text style={styles.orderbookPriceBuy}>${formatPrice(bid.price)}</Text>
                        <Text style={styles.orderbookAmountText}>{bid.amount.toFixed(2)}</Text>
                      </View>
                    );
                  })
                )}
              </View>
              
              {/* 卖单列表 */}
              <View style={styles.orderbookHalf}>
                {asks.length === 0 ? (
                  <View style={styles.orderbookEmpty}>
                    <Text style={styles.orderbookEmptyText}>暂无卖单</Text>
                  </View>
                ) : (
                  asks.slice(0, 8).map((ask, index) => {
                    const depthPercent = (ask.amount / maxOrderAmount) * 100;
                    return (
                      <View key={`ask-${index}`} style={styles.orderbookItemSell}>
                        {/* 热力背景条 - 从左向右延伸 */}
                        <View 
                          style={[
                            styles.orderbookDepthBar, 
                            styles.orderbookDepthBarSell,
                            { width: `${depthPercent}%`, left: 0, right: 'auto' }
                          ]} 
                        />
                        <Text style={styles.orderbookPriceSell}>${formatPrice(ask.price)}</Text>
                        <Text style={styles.orderbookAmountText}>{ask.amount.toFixed(2)}</Text>
                      </View>
                    );
                  })
                )}
              </View>
            </View>

            {/* 汇总信息 */}
            <View style={styles.orderbookSummary}>
              <View style={styles.orderbookSummaryItem}>
                <Text style={styles.orderbookSummaryLabel}>买单总量</Text>
                <Text style={[styles.orderbookSummaryValue, { color: '#22C55E' }]}>
                  {bids.reduce((sum, b) => sum + b.amount, 0).toFixed(2)} {symbol}
                </Text>
              </View>
              <View style={styles.orderbookSummaryItem}>
                <Text style={styles.orderbookSummaryLabel}>卖单总量</Text>
                <Text style={[styles.orderbookSummaryValue, { color: '#EF4444' }]}>
                  {asks.reduce((sum, a) => sum + a.amount, 0).toFixed(2)} {symbol}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 代币信息 */}
        {activeTab === 'info' && (
          <View style={styles.tokenInfoContainer}>
            {/* 代币基本信息 */}
            <View style={styles.tokenInfoCard}>
              <View style={styles.tokenInfoHeader}>
                <View style={styles.tokenIconLarge}>
                  <FontAwesome6 
                    name={TOKEN_ICONS[symbol] || 'coins'} 
                    size={32} 
                    color="#F59E0B" 
                  />
                </View>
                <View style={styles.tokenInfoTitle}>
                  <Text style={styles.tokenName}>{tokenInfo?.name || symbol}</Text>
                  <Text style={styles.tokenSymbol}>{symbol}</Text>
                </View>
              </View>
              
              <Text style={styles.tokenDescription}>
                {tokenInfo?.description || `${symbol}是一种数字资产，可在本平台进行交易和转账。`}
              </Text>
            </View>

            {/* 代币数据 */}
            <View style={styles.tokenDataCard}>
              <Text style={styles.cardTitle}>市场数据</Text>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>当前价格</Text>
                <Text style={[styles.dataValue, isPositive ? styles.priceUp : styles.priceDown]}>
                  ${formatPrice(priceData?.priceUsd)}
                </Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>24h涨跌幅</Text>
                <Text style={[styles.dataValue, isPositive ? styles.priceUp : styles.priceDown]}>
                  {isPositive ? '+' : ''}{changeValue.toFixed(2)}%
                </Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>24h最高价</Text>
                <Text style={styles.dataValue}>${formatPrice(priceData?.high24h)}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>24h最低价</Text>
                <Text style={styles.dataValue}>${formatPrice(priceData?.low24h)}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>24h成交量</Text>
                <Text style={styles.dataValue}>${formatVolume(priceData?.volume24h)}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>市值</Text>
                <Text style={styles.dataValue}>
                  {priceData?.marketCap ? `$${formatVolume(priceData.marketCap)}` : '--'}
                </Text>
              </View>
            </View>

            {/* 代币特性 */}
            {tokenInfo?.features && tokenInfo.features.length > 0 && (
              <View style={styles.tokenDataCard}>
                <Text style={styles.cardTitle}>代币特性</Text>
                
                <View style={styles.featureGrid}>
                  {tokenInfo.features.map((feature, idx) => (
                    <View key={idx} style={styles.featureItem}>
                      <FontAwesome6 name={feature.icon as any} size={20} color="#F59E0B" />
                      <Text style={styles.featureLabel}>{feature.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 链上信息 */}
            <View style={styles.tokenDataCard}>
              <Text style={styles.cardTitle}>链上信息</Text>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>发行时间</Text>
                <Text style={styles.dataValue}>{tokenInfo?.issueDate || '--'}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>发行总量</Text>
                <Text style={styles.dataValue}>{tokenInfo?.totalSupply || '--'}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>共识机制</Text>
                <Text style={styles.dataValue}>{tokenInfo?.consensusMechanism || '--'}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>区块链网络</Text>
                <Text style={styles.dataValue}>{tokenInfo?.blockchainNetwork || '--'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* 我的挂单 */}
        {activeTab === 'orders' && (
          <View style={styles.myOrdersSection}>
            {/* 显示当前用户信息 */}
            {user && (
              <Text style={{ color: '#6B7280', fontSize: 11, marginBottom: 8 }}>
                当前账号: {user.phone || user.id?.substring(0, 8)}...
              </Text>
            )}
            {myOrders.length === 0 ? (
              <View style={styles.myOrdersEmpty}>
                <FontAwesome6 name="clipboard" size={24} color="#4B5563" />
                <Text style={styles.myOrdersEmptyText}>暂无挂单</Text>
              </View>
            ) : (
              myOrders.map((order) => (
                <View key={order.id} style={styles.myOrderItem}>
                  <View style={styles.myOrderRow}>
                    <View style={styles.myOrderLeft}>
                      <Text style={[
                        styles.myOrderType,
                        { color: order.order_type === 'buy' ? '#22C55E' : '#EF4444' }
                      ]}>
                        {order.order_type === 'buy' ? '买入' : '卖出'}
                      </Text>
                      <Text style={styles.myOrderAmount}>
                        {parseFloat(order.amount).toFixed(4)} {order.base_currency}
                      </Text>
                    </View>
                    <View style={styles.myOrderRight}>
                      <Text style={styles.myOrderPrice}>${formatPrice(order.price)}</Text>
                      <Text style={styles.myOrderStatus}>
                        {order.status === 'open' ? '待成交' : '部分成交'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.cancelBtn}
                    onPress={() => handleCancelOrder(order.id)}
                  >
                    <Text style={styles.cancelBtnText}>撤销</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* 成交记录 */}
        {activeTab === 'history' && (
          <View style={styles.historySection}>
            {tradeHistory.length === 0 ? (
              <View style={styles.historyEmpty}>
                <FontAwesome6 name="receipt" size={24} color="#4B5563" />
                <Text style={styles.historyEmptyText}>暂无成交记录</Text>
              </View>
            ) : (
              tradeHistory.map((item) => (
                <View key={item.id} style={styles.historyItem}>
                  <View style={styles.historyLeft}>
                    <View style={[
                      styles.historyTypeBadge,
                      item.trade_type === 'buy' ? styles.historyTypeBuy : styles.historyTypeSell
                    ]}>
                      <Text style={[
                        styles.historyTypeText,
                        { color: item.trade_type === 'buy' ? '#22C55E' : '#EF4444' }
                      ]}>
                        {item.trade_type === 'buy' ? '买入' : '卖出'}
                      </Text>
                    </View>
                    <Text style={styles.historyAmount}>
                      {parseFloat(item.amount).toFixed(4)} {item.base_currency}
                    </Text>
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={styles.historyPriceLabel}>
                      {item.trade_type === 'buy' ? '买入价' : '卖出价'}: ${formatPrice(item.price)}
                    </Text>
                    <Text style={styles.historyPrice}>
                      ${parseFloat(item.total_value).toFixed(2)}
                    </Text>
                    {item.fee && parseFloat(item.fee) > 0 && (
                      <Text style={styles.historyFee}>
                        手续费: ${parseFloat(item.fee).toFixed(4)}
                      </Text>
                    )}
                    <Text style={styles.historyTime}>{formatTime(item.created_at)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* 底部占位 */}
        <View style={{ height: 50 }} />
      </ScrollView>
    </Screen>
  );
}
