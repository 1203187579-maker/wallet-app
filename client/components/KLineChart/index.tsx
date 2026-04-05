import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions, ScrollView } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';
import { createStyles } from './styles';

interface KLineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface KLineChartProps {
  data: KLineData[];
  pairSymbol: string;
  currentPrice?: number;
  priceChange24h?: number;
  loading?: boolean;
  onIntervalChange?: (interval: string) => void;
}

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'];

export const KLineChartComponent: React.FC<KLineChartProps> = ({
  data,
  pairSymbol,
  currentPrice,
  priceChange24h,
  loading = false,
  onIntervalChange,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [selectedInterval, setSelectedInterval] = useState('1h');

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 40;

  const handleIntervalPress = (interval: string) => {
    setSelectedInterval(interval);
    onIntervalChange?.(interval);
  };

  const isPositive = priceChange24h !== undefined && priceChange24h >= 0;
  const priceColor = isPositive ? '#10B981' : '#EF4444';

  // 格式化价格显示
  const formatPrice = (price: number | undefined) => {
    if (price === undefined) return '--';
    if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(8);
  };

  // 格式化涨跌幅
  const formatChange = (change: number | undefined) => {
    if (change === undefined) return '--';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  // 计算价格范围
  const priceRange = useMemo(() => {
    if (!data || data.length === 0) return { min: 0, max: 100 };
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const max = Math.max(...highs);
    const min = Math.min(...lows);
    const padding = (max - min) * 0.1;
    return { min: min - padding, max: max + padding };
  }, [data]);

  // 准备收盘价折线图数据
  const lineData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item) => ({
      value: item.close,
    }));
  }, [data]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  const candleWidth = Math.max(4, (chartWidth - 60) / data.length - 2);
  const chartHeight = 280;

  return (
    <View style={styles.container}>
      {/* 币对信息头部 */}
      <View style={styles.header}>
        <View style={styles.pairInfo}>
          <Text style={styles.pairName}>{pairSymbol}</Text>
          <View style={styles.priceContainer}>
            <Text style={[styles.currentPrice, isPositive ? styles.priceUp : styles.priceDown]}>
              ${formatPrice(currentPrice)}
            </Text>
            <View style={styles.changeContainer}>
              <Text style={[styles.changeText, isPositive ? styles.priceUp : styles.priceDown]}>
                {formatChange(priceChange24h)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 时间周期选择器 */}
      <View style={styles.intervalSelector}>
        {INTERVALS.map((interval) => (
          <TouchableOpacity
            key={interval}
            style={[
              styles.intervalButton,
              selectedInterval === interval && styles.intervalButtonActive,
            ]}
            onPress={() => handleIntervalPress(interval)}
          >
            <Text
              style={[
                styles.intervalButtonText,
                selectedInterval === interval && styles.intervalButtonTextActive,
              ]}
            >
              {interval}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* K线图表 */}
      <View style={styles.chartContainer}>
        {data && data.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[styles.chartWrapper, { width: Math.max(chartWidth, candleWidth * data.length + 60) }]}>
              {/* K线蜡烛图 */}
              <Svg width={Math.max(chartWidth, candleWidth * data.length + 60)} height={chartHeight}>
                {data.map((item, index) => {
                  const x = 50 + index * (candleWidth + 2);
                  const priceScale = chartHeight / (priceRange.max - priceRange.min);
                  const highY = chartHeight - (item.high - priceRange.min) * priceScale;
                  const lowY = chartHeight - (item.low - priceRange.min) * priceScale;
                  const openY = chartHeight - (item.open - priceRange.min) * priceScale;
                  const closeY = chartHeight - (item.close - priceRange.min) * priceScale;
                  const isUp = item.close >= item.open;
                  const color = isUp ? '#10B981' : '#EF4444';
                  const bodyTop = Math.min(openY, closeY);
                  const bodyHeight = Math.max(1, Math.abs(closeY - openY));

                  return (
                    <React.Fragment key={index}>
                      {/* 影线 */}
                      <Line
                        x1={x + candleWidth / 2}
                        y1={highY}
                        x2={x + candleWidth / 2}
                        y2={lowY}
                        stroke={color}
                        strokeWidth={1}
                      />
                      {/* 实体 */}
                      <Rect
                        x={x}
                        y={bodyTop}
                        width={candleWidth}
                        height={bodyHeight}
                        fill={color}
                      />
                    </React.Fragment>
                  );
                })}
              </Svg>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无K线数据</Text>
          </View>
        )}
      </View>

      {/* 统计信息 */}
      {data && data.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>24h最高</Text>
            <Text style={styles.statsValue}>${formatPrice(Math.max(...data.map(d => d.high)))}</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>24h最低</Text>
            <Text style={styles.statsValue}>${formatPrice(Math.min(...data.map(d => d.low)))}</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>数据点</Text>
            <Text style={styles.statsValue}>{data.length} 条</Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default KLineChartComponent;
