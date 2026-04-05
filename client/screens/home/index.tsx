import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { 
  ScrollView, 
  View, 
  TouchableOpacity, 
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { assetApi, priceApi, walletApi, getBaseUrl, type TokenPrice } from '@/services/api';
import { createStyles } from './styles';

interface PopupAnnouncement {
  id: string;
  title: string;
  content: string;
  type: string;
}

// 价格走势迷你折线图组件（纯折线，无背景框）
function PriceSparkline({ data, isUp }: { data: number[]; isUp: boolean }) {
  if (!data || data.length < 2) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const height = 28;
  const width = 64;
  const step = width / (data.length - 1);
  
  // 计算每个点的位置
  const points = data.map((val, i) => ({
    x: i * step,
    y: height - ((val - min) / range) * (height - 6) - 3,
  }));

  const color = isUp ? '#22C55E' : '#EF4444';

  return (
    <View style={{ 
      width, 
      height,
      position: 'relative',
    }}>
      {/* 连接线段 */}
      {points.slice(0, -1).map((p, i) => {
        const next = points[i + 1];
        const dx = next.x - p.x;
        const dy = next.y - p.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        return (
          <View
            key={`line-${i}`}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: length,
              height: 1.5,
              backgroundColor: color,
              transformOrigin: 'left center',
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}
    </View>
  );
}

// 行情Tab类型
type MarketTab = 'hot' | 'new' | 'gainers' | 'losers' | 'volume';

export default function HomeScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { user, isAuthenticated, isLoading: authLoading, refreshUser } = useAuth();
  
  const [prices, setPrices] = useState<TokenPrice[]>([]);
  const [totalValueUsd, setTotalValueUsd] = useState<string>('0');
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeMarketTab, setActiveMarketTab] = useState<MarketTab>('hot');
  
  // 公告弹窗相关状态
  const [popupAnnouncements, setPopupAnnouncements] = useState<PopupAnnouncement[]>([]);
  const [currentPopupIndex, setCurrentPopupIndex] = useState(0);
  const [showPopup, setShowPopup] = useState(false);
  const [hasUnreadAnnouncements, setHasUnreadAnnouncements] = useState(false);

  // 检查登录状态
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // 加载数据
  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    
    // 同时刷新用户信息以获取最新的禁用状态
    refreshUser();
    
    try {
      const [assetsResult, pricesResult, walletsResult] = await Promise.all([
        assetApi.getList(),
        priceApi.getAll(),
        walletApi.getList(),
      ]);

      if (assetsResult.success && assetsResult.data) {
        setTotalValueUsd(assetsResult.data.total_value_usd || '0');
      }
      if (pricesResult.success && pricesResult.data) {
        setPrices(pricesResult.data.prices);
      }
      if (walletsResult.success && walletsResult.data && walletsResult.data.wallets && walletsResult.data.wallets.length > 0) {
        const addr = walletsResult.data.wallets[0].address;
        setWalletAddress(`${addr.slice(0, 6)}...${addr.slice(-4)}`);
      }
      
      // 获取弹窗公告
      await fetchPopupAnnouncements();
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, refreshUser]);
  
  // 获取弹窗公告
  const fetchPopupAnnouncements = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();
      
      // 检查今天是否已经显示过弹窗
      const lastPopupDate = await AsyncStorage.getItem('last_popup_date');
      const today = new Date().toDateString();
      
      // 获取所有公告列表用于检查未读状态
      const listResponse = await fetch(`${baseUrl}/api/v1/announcements`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const listData = await listResponse.json();
      
      if (listData.success && listData.data && listData.data.length > 0) {
        // 获取已读公告ID列表
        const readIdsStr = await AsyncStorage.getItem('read_announcement_ids');
        const readIds = readIdsStr ? JSON.parse(readIdsStr) : [];
        
        // 检查是否有未读公告
        const hasUnread = listData.data.some((item: any) => !readIds.includes(item.id));
        setHasUnreadAnnouncements(hasUnread);
      }
      
      // 获取弹窗公告
      const response = await fetch(`${baseUrl}/api/v1/announcements/popup`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      const data = await response.json();
      if (data.success && data.data && data.data.length > 0) {
        // 如果今天还没显示过，则显示弹窗
        if (lastPopupDate !== today) {
          setPopupAnnouncements(data.data);
          setCurrentPopupIndex(0);
          setShowPopup(true);
          // 记录今天已显示
          await AsyncStorage.setItem('last_popup_date', today);
        }
      }
    } catch (error) {
      console.error('Fetch popup announcements error:', error);
    }
  };
  
  // 关闭弹窗（显示下一条或关闭）
  const handleClosePopup = () => {
    if (currentPopupIndex < popupAnnouncements.length - 1) {
      setCurrentPopupIndex(currentPopupIndex + 1);
    } else {
      setShowPopup(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadData(), refreshUser()]);
    setRefreshing(false);
  }, [loadData, refreshUser]);

  // 计算总资产（使用后端返回的值）
  const totalBalance = useMemo(() => {
    const value = parseFloat(totalValueUsd);
    return isNaN(value) ? 0 : value;
  }, [totalValueUsd]);

  // 行情Tab配置
  const marketTabs: { key: MarketTab; label: string }[] = [
    { key: 'hot', label: t('market.hot') },
    { key: 'new', label: t('market.newCoins') },
    { key: 'gainers', label: t('market.gainers') },
    { key: 'losers', label: t('market.losers') },
    { key: 'volume', label: t('market.volume') },
  ];

  // 根据Tab筛选行情数据
  const filteredPrices = useMemo(() => {
    if (!prices.length) return [];
    
    // 生成模拟的价格走势数据
    const pricesWithSparkline = prices.map(p => {
      const basePrice = parseFloat(p.price_usd);
      const change = parseFloat(p.change_24h || '0');
      // 生成7个点的模拟走势数据
      const sparkline = Array.from({ length: 7 }, (_, i) => {
        const randomFactor = 1 + (Math.random() - 0.5) * 0.02 * (i + 1);
        return basePrice * randomFactor * (1 - (change / 100) * ((6 - i) / 6));
      });
      return { ...p, sparkline };
    });

    switch (activeMarketTab) {
      case 'hot':
        // 热门：按默认顺序
        return pricesWithSparkline;
      case 'new':
        // 新币榜：显示非主流币种（这里用ARA等）
        return pricesWithSparkline.filter(p => !['BTC', 'ETH', 'USDT'].includes(p.token_symbol));
      case 'gainers':
        // 涨幅榜：按涨幅降序
        return [...pricesWithSparkline].sort((a, b) => 
          parseFloat(b.change_24h || '0') - parseFloat(a.change_24h || '0')
        );
      case 'losers':
        // 跌幅榜：按涨幅升序（负数最小的在前）
        return [...pricesWithSparkline].sort((a, b) => 
          parseFloat(a.change_24h || '0') - parseFloat(b.change_24h || '0')
        );
      case 'volume':
        // 成交额：按价格降序（简化处理）
        return [...pricesWithSparkline].sort((a, b) => 
          parseFloat(b.price_usd) - parseFloat(a.price_usd)
        );
      default:
        return pricesWithSparkline;
    }
  }, [prices, activeMarketTab]);

  // 显示加载状态
  if (authLoading || loading) {
    return (
      <Screen backgroundColor="#000000" statusBarStyle="light">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <ThemedText variant="caption" color={theme.textMuted} style={{ marginTop: 16 }}>
            {t('common.loading')}
          </ThemedText>
        </View>
      </Screen>
    );
  }

  // 未登录状态
  if (!isAuthenticated) {
    return null;
  }

  return (
    <Screen backgroundColor="#000000" statusBarStyle="light">
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#F59E0B"
          />
        }
      >
        {/* Top Bar - Notification & Language */}
        <View style={styles.topBar}>
          <TouchableOpacity 
            style={styles.topBarButton}
            onPress={() => router.push('/announcements')}
          >
            <FontAwesome6 name="bell" size={18} color="#FFFFFF" />
            {hasUnreadAnnouncements && <View style={styles.redDot} />}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.topBarButton}
            onPress={() => router.push('/settings')}
          >
            <FontAwesome6 name="globe" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Asset Card - Orange Background */}
        <TouchableOpacity 
          style={styles.assetCard}
          onPress={() => router.push('/wallet')}
          activeOpacity={0.8}
        >
          <View style={styles.assetCardHeader}>
            <ThemedText variant="label" style={styles.totalAssetLabel}>
              {t('home.totalAssets')}
            </ThemedText>
            <View style={styles.chainTag}>
              <View style={styles.chainDot} />
              <ThemedText variant="captionMedium" style={styles.chainText}>
                BoostAra
              </ThemedText>
            </View>
          </View>
          <ThemedText variant="statLarge" style={styles.totalBalance}>
            ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </ThemedText>
          <View style={styles.walletAddress}>
            <ThemedText variant="small" style={styles.walletAddressText}>
              {walletAddress || '0x1234...5678'}
            </ThemedText>
            <FontAwesome6 name="chevron-right" size={14} color="rgba(0,0,0,0.6)" />
          </View>
        </TouchableOpacity>

        {/* Quick Actions - 4 Buttons */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickActionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/wallet-send');
            }}
          >
            <View style={styles.quickActionIcon}>
              <FontAwesome6 name="paper-plane" size={20} color="#F59E0B" />
            </View>
            <ThemedText variant="captionMedium" style={styles.quickActionText}>
              {t('wallet.send')}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/wallet-receive');
            }}
          >
            <View style={styles.quickActionIcon}>
              <FontAwesome6 name="qrcode" size={20} color="#F59E0B" />
            </View>
            <ThemedText variant="captionMedium" style={styles.quickActionText}>
              {t('wallet.receive')}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // 检查社交广场功能是否被禁用
              const disabledFeatures = user?.disabled_features || [];
              if (disabledFeatures.includes('plaza')) {
                if (Platform.OS === 'web') {
                  window.alert('该功能暂不可用');
                } else {
                  Alert.alert('提示', '该功能暂不可用');
                }
                return;
              }
              router.push('/plaza');
            }}
          >
            <View style={styles.quickActionIcon}>
              <FontAwesome6 name="users" size={20} color="#F59E0B" />
            </View>
            <ThemedText variant="captionMedium" style={styles.quickActionText}>
              {t('plaza.title')}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/stake');
            }}
          >
            <View style={styles.quickActionIcon}>
              <FontAwesome6 name="leaf" size={20} color="#F59E0B" />
            </View>
            <ThemedText variant="captionMedium" style={styles.quickActionText}>
              {t('stake.title')}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Token Assets Section - 已隐藏（我的页面有钱包功能） */}
        
        {/* Market Section - 行情 */}
        {/* Market Tabs */}
        <View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.marketTabsScroll}
            contentContainerStyle={styles.marketTabsContainer}
          >
            {marketTabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.marketTab,
                  activeMarketTab === tab.key && styles.marketTabActive,
                ]}
                onPress={() => setActiveMarketTab(tab.key)}
              >
                <ThemedText
                  variant="smallMedium"
                  style={[
                    styles.marketTabText,
                    activeMarketTab === tab.key && styles.marketTabTextActive,
                  ]}
                >
                  {tab.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.marketSection}>
          {filteredPrices.length > 0 ? filteredPrices.map((item) => {
            const changeValue = parseFloat(item.change_24h || '0');
            const isUp = changeValue >= 0;
            
            // 代币名称映射
            const tokenName: Record<string, string> = {
              'BTC': 'Bitcoin',
              'ETH': 'Ethereum',
              'USDT': 'Tether',
              'AI': 'AI Token',
              'GPU': 'GPU Token',
            };
            
            return (
              <TouchableOpacity 
                key={item.token_symbol} 
                style={styles.marketCard}
                onPress={() => {
                  if (item.isViewable === false) {
                    if (Platform.OS === 'web') {
                      window.alert('该代币暂未开放交易');
                    } else {
                      Alert.alert('提示', '该代币暂未开放交易');
                    }
                    return;
                  }
                  router.push('/coin-detail', { symbol: item.token_symbol });
                }}
                activeOpacity={0.7}
              >
                <View style={styles.marketRow}>
                  <View style={styles.marketLeft}>
                    <View style={styles.marketIcon}>
                      <FontAwesome6 
                        name={
                          item.token_symbol === 'BTC' ? 'bitcoin' : 
                          item.token_symbol === 'ETH' ? 'ethereum' : 
                          item.token_symbol === 'AI' ? 'robot' :
                          item.token_symbol === 'GPU' ? 'microchip' :
                          'coins'
                        } 
                        size={18} 
                        color="#F59E0B" 
                      />
                    </View>
                    <View style={styles.marketInfo}>
                      <ThemedText variant="bodyMedium" style={styles.marketSymbol}>
                        {item.token_symbol}
                      </ThemedText>
                      <ThemedText variant="caption" style={styles.marketName}>
                        {tokenName[item.token_symbol] || item.token_symbol}
                      </ThemedText>
                    </View>
                  </View>
                  
                  {/* 价格走势图 */}
                  <View style={styles.marketSparkline}>
                    <PriceSparkline data={(item as any).sparkline || []} isUp={isUp} />
                  </View>
                  
                  <View style={styles.marketRight}>
                    <ThemedText variant="bodyMedium" style={styles.marketPrice}>
                      $ {parseFloat(item.price_usd).toLocaleString()}
                    </ThemedText>
                    <ThemedText 
                      variant="smallMedium" 
                      style={isUp ? styles.marketChangeUp : styles.marketChangeDown}
                    >
                      {isUp ? '+' : ''}{changeValue.toFixed(2)}%
                    </ThemedText>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }) : (
            <View style={styles.emptyTokenState}>
              <FontAwesome6 name="chart-line" size={40} color="#6B7280" />
              <ThemedText variant="small" style={styles.emptyTokenText}>
                {t('market.noData')}
              </ThemedText>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 公告弹窗 */}
      <Modal
        visible={showPopup}
        transparent
        animationType="fade"
        onRequestClose={handleClosePopup}
      >
        <TouchableOpacity 
          style={styles.popupOverlay}
          activeOpacity={1}
          onPress={handleClosePopup}
        >
          <TouchableOpacity 
            style={styles.popupCard}
            activeOpacity={1}
            onPress={() => {}}
          >
            <View style={styles.popupHeader}>
              <FontAwesome6 name="bullhorn" size={20} color="#F59E0B" />
              <ThemedText variant="h3" style={styles.popupTitle}>
                {popupAnnouncements[currentPopupIndex]?.title || t('announcements.title') || '公告'}
              </ThemedText>
              <TouchableOpacity onPress={handleClosePopup} style={styles.popupCloseBtn}>
                <FontAwesome6 name="xmark" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.popupContent}>
              <ThemedText variant="body" style={styles.popupText}>
                {popupAnnouncements[currentPopupIndex]?.content || ''}
              </ThemedText>
            </ScrollView>
            {popupAnnouncements.length > 1 && (
              <View style={styles.popupFooter}>
                <ThemedText variant="caption" style={styles.popupPage}>
                  {currentPopupIndex + 1} / {popupAnnouncements.length}
                </ThemedText>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}
