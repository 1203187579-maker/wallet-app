import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { KLineChartComponent } from '@/components/KLineChart';
import { useTheme } from '@/hooks/useTheme';
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

interface PairData {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  pairSymbol: string;
  priceSource: string;
  price: PriceData | null;
}

interface KLineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export default function MarketScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [pairs, setPairs] = useState<PairData[]>([]);
  const [selectedPair, setSelectedPair] = useState<string>('');
  const [klineData, setKlineData] = useState<KLineData[]>([]);
  const [interval, setInterval] = useState('1h');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [klineLoading, setKlineLoading] = useState(false);

  // 获取交易对列表
  const fetchPairs = async () => {
    try {
      /**
       * 服务端文件：server/src/routes/market.ts
       * 接口：GET /api/v1/market/pairs
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/market/pairs`);
      const result = await response.json();
      if (result.success) {
        setPairs(result.data);
        if (!selectedPair && result.data.length > 0) {
          setSelectedPair(result.data[0].pairSymbol);
        }
      }
    } catch (error) {
      console.error('获取交易对失败:', error);
    }
  };

  // 获取K线数据
  const fetchKlineData = async (pairSymbol: string, intervalValue: string) => {
    if (!pairSymbol) return;
    
    setKlineLoading(true);
    try {
      /**
       * 服务端文件：server/src/routes/market.ts
       * 接口：GET /api/v1/market/klines/:pairSymbol
       * Query 参数：interval: string, limit: number
       */
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/market/klines/${pairSymbol}?interval=${intervalValue}&limit=100`
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

  // 初始化加载
  useFocusEffect(
    useCallback(() => {
      const init = async () => {
        setLoading(true);
        await fetchPairs();
        setLoading(false);
      };
      init();
    }, [])
  );

  // 当选中交易对或时间周期变化时，加载K线数据
  useEffect(() => {
    if (selectedPair) {
      fetchKlineData(selectedPair, interval);
    }
  }, [selectedPair, interval]);

  // 下拉刷新
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPairs();
    if (selectedPair) {
      await fetchKlineData(selectedPair, interval);
    }
    setRefreshing(false);
  }, [selectedPair, interval]);

  // 获取当前选中交易对的价格信息
  const currentPair = pairs.find((p) => p.pairSymbol === selectedPair);
  const currentPrice = currentPair?.price;
  const priceChange = currentPrice?.change24h ? parseFloat(currentPrice.change24h) : 0;
  const isPositive = priceChange >= 0;

  // 格式化价格
  const formatPrice = (priceStr: string | null | undefined) => {
    if (!priceStr) return '--';
    const price = parseFloat(priceStr);
    if (isNaN(price)) return '--';
    if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(8);
  };

  // 格式化涨跌幅
  const formatChange = (changeStr: string | null | undefined) => {
    if (!changeStr) return '--';
    const change = parseFloat(changeStr);
    if (isNaN(change)) return '--';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
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
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />
        }
      >
        {/* 头部 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>行情</Text>
        </View>

        {/* 交易对选择器 */}
        <View style={styles.pairSelector}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pairScroll}>
            {pairs.map((pair) => (
              <TouchableOpacity
                key={pair.id}
                style={[styles.pairButton, selectedPair === pair.pairSymbol && styles.pairButtonActive]}
                onPress={() => setSelectedPair(pair.pairSymbol)}
              >
                <Text
                  style={[
                    styles.pairButtonText,
                    selectedPair === pair.pairSymbol && styles.pairButtonTextActive,
                  ]}
                >
                  {pair.pairSymbol}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 价格卡片 */}
        {currentPrice && (
          <View style={styles.priceCard}>
            <View style={styles.priceRow}>
              <View>
                <Text style={styles.priceLabel}>当前价格</Text>
                <Text style={[styles.priceValue, isPositive ? styles.priceUp : styles.priceDown]}>
                  ${formatPrice(currentPrice.priceUsd)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.priceLabel}>24h涨跌</Text>
                <Text style={[styles.priceValue, isPositive ? styles.priceUp : styles.priceDown]}>
                  {formatChange(currentPrice.change24h)}
                </Text>
              </View>
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>24h最高</Text>
                <Text style={styles.statValue}>${formatPrice(currentPrice.high24h)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>24h最低</Text>
                <Text style={styles.statValue}>${formatPrice(currentPrice.low24h)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>24h成交</Text>
                <Text style={styles.statValue}>${formatVolume(currentPrice.volume24h)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* K线图表 */}
        <View style={styles.chartContainer}>
          <KLineChartComponent
            data={klineData}
            pairSymbol={selectedPair}
            currentPrice={currentPrice ? parseFloat(currentPrice.priceUsd) : undefined}
            priceChange24h={currentPrice?.change24h ? parseFloat(currentPrice.change24h) : undefined}
            loading={klineLoading}
            onIntervalChange={setInterval}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
