import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, ScrollView, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path, Defs, LinearGradient, Stop, ClipPath, Rect, G, Line, Text as SvgText } from 'react-native-svg';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

// K线周期配置
export type KLineInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';

export const INTERVAL_CONFIG: Record<KLineInterval, { label: string; shortLabel: string }> = {
  '1m': { label: '1分钟', shortLabel: '分' },
  '5m': { label: '5分钟', shortLabel: '5分' },
  '15m': { label: '15分钟', shortLabel: '15分' },
  '1h': { label: '1小时', shortLabel: '时' },
  '4h': { label: '4小时', shortLabel: '4时' },
  '1d': { label: '1天', shortLabel: '日' },
  '1w': { label: '1周', shortLabel: '周' },
  '1M': { label: '1月', shortLabel: '月' },
};

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface InteractiveKLineProps {
  data: CandleData[];
  width?: number;
  height?: number;
  color?: string;
  animationDuration?: number;
  autoPlay?: boolean;
  interval: KLineInterval;
  onIntervalChange: (interval: KLineInterval) => void;
}

export const InteractiveKLine: React.FC<InteractiveKLineProps> = ({
  data,
  width: propWidth,
  height = 200,
  color = '#F59E0B',
  animationDuration = 2000,
  autoPlay = true,
  interval,
  onIntervalChange,
}) => {
  const screenWidth = Dimensions.get('window').width;
  const width = propWidth || screenWidth;
  
  // 缩放和平移状态
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  
  const lastScale = useRef(1);
  const lastTranslateX = useRef(0);

  // 动画进度
  const progress = useSharedValue(0);
  const clipWidth = useSharedValue(0);

  // 从K线数据提取收盘价用于平滑曲线
  const closePrices = useMemo(() => {
    return data.map(d => d.close);
  }, [data]);

  // 计算路径（平滑曲线）
  const { linePath, areaPath, points, minPrice, maxPrice } = useMemo(() => {
    if (!closePrices || closePrices.length < 2) {
      return { linePath: '', areaPath: '', points: [], minPrice: 0, maxPrice: 0 };
    }

    const padding = { top: 20, bottom: 20, left: 10, right: 10 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const minVal = Math.min(...closePrices);
    const maxVal = Math.max(...closePrices);
    const range = maxVal - minVal || 1;

    // 计算点位置
    const pts = closePrices.map((value, index) => {
      const x = padding.left + (index / (closePrices.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((value - minVal) / range) * chartHeight;
      return { x, y };
    });

    // 生成平滑曲线路径（使用贝塞尔曲线）
    let lineD = `M ${pts[0].x} ${pts[0].y}`;
    
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      
      // 计算控制点使曲线更平滑
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      
      // 使用二次贝塞尔曲线
      lineD += ` Q ${prev.x} ${midY}, ${midX} ${midY}`;
      if (i === pts.length - 1) {
        lineD += ` L ${curr.x} ${curr.y}`;
      }
    }

    // 面积路径（填充到底部）
    const areaD = `${lineD} L ${pts[pts.length - 1].x} ${height - padding.bottom} L ${pts[0].x} ${height - padding.bottom} Z`;

    return { linePath: lineD, areaPath: areaD, points: pts, minPrice: minVal, maxPrice: maxVal };
  }, [closePrices, width, height]);

  // 手势处理
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newScale = Math.max(1, Math.min(lastScale.current * e.scale, 5));
      setScale(newScale);
      setIsZoomed(newScale > 1.2);
    })
    .onEnd(() => {
      lastScale.current = scale;
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (isZoomed) {
        const maxTranslate = (scale - 1) * width / 2;
        const newTranslate = Math.max(-maxTranslate, Math.min(maxTranslate, lastTranslateX.current + e.translationX));
        setTranslateX(newTranslate);
      }
    })
    .onEnd(() => {
      lastTranslateX.current = translateX;
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  // 格式化价格标签
  const formatPriceLabel = (price: number) => {
    if (price >= 1000) return price.toFixed(0);
    if (price >= 1) return price.toFixed(2);
    return price.toFixed(4);
  };

  // 生成价格标签
  const priceLabels = useMemo(() => {
    if (!maxPrice || !minPrice) return [];
    const labels = [];
    const steps = 3;
    for (let i = 0; i <= steps; i++) {
      const price = minPrice + (maxPrice - minPrice) * (1 - i / steps);
      labels.push({
        price: formatPriceLabel(price),
        y: 20 + (height - 40) * (i / steps),
      });
    }
    return labels;
  }, [maxPrice, minPrice, height]);

  // 动画
  const animatedLineProps = useAnimatedProps(() => {
    const strokeDashoffset = linePath.length * (1 - progress.value);
    return { strokeDashoffset };
  });

  const animatedClipProps = useAnimatedProps(() => {
    return { width: clipWidth.value };
  });

  // 启动动画
  useEffect(() => {
    if (autoPlay && closePrices && closePrices.length >= 2) {
      progress.value = 0;
      clipWidth.value = 0;
      
      progress.value = withTiming(1, {
        duration: animationDuration,
        easing: Easing.out(Easing.quad),
      });
      
      clipWidth.value = withDelay(100, withTiming(width, {
        duration: animationDuration - 100,
        easing: Easing.out(Easing.quad),
      }));
    }
  }, [closePrices, autoPlay, animationDuration, width]);

  // 周期选择器
  const intervals: KLineInterval[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];

  return (
    <View style={[styles.container, { width, height }]}>
      {/* K线图区域 */}
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.chartContainer, { transform: [{ scale }, { translateX }] }]}>
          {closePrices && closePrices.length >= 2 ? (
            <Svg width={width} height={height - 35}>
              <Defs>
                {/* 金色渐变 */}
                <LinearGradient id="goldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor={color} stopOpacity="0.6" />
                  <Stop offset="50%" stopColor={color} stopOpacity="0.3" />
                  <Stop offset="100%" stopColor={color} stopOpacity="0.05" />
                </LinearGradient>
                
                {/* 线条发光渐变 */}
                <LinearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor={color} stopOpacity="0.3" />
                  <Stop offset="50%" stopColor={color} stopOpacity="1" />
                  <Stop offset="100%" stopColor={color} stopOpacity="0.8" />
                </LinearGradient>
                
                {/* 裁剪区域 */}
                <ClipPath id="revealClip">
                  <AnimatedRect
                    x={0}
                    y={0}
                    animatedProps={animatedClipProps}
                    height={height}
                  />
                </ClipPath>
              </Defs>

              {/* 价格标签 */}
              {priceLabels.map((label, i) => (
                <G key={i}>
                  <Line
                    x1={width - 50}
                    y1={label.y}
                    x2={width - 10}
                    y2={label.y}
                    stroke="#333"
                    strokeWidth={0.5}
                    strokeDasharray="2,2"
                  />
                  <SvgText
                    x={width - 8}
                    y={label.y + 4}
                    fill="#666"
                    fontSize={10}
                    textAnchor="end"
                  >
                    ${label.price}
                  </SvgText>
                </G>
              ))}
              
              {/* 背景区域填充（带裁剪动画） */}
              <Path
                d={areaPath}
                fill="url(#goldGradient)"
                clipPath="url(#revealClip)"
              />
              
              {/* 线条（带描边动画） */}
              <AnimatedPath
                d={linePath}
                stroke="url(#lineGradient)"
                strokeWidth={2.5}
                fill="none"
                strokeDasharray={linePath.length}
                animatedProps={animatedLineProps}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* 发光效果层 */}
              <AnimatedPath
                d={linePath}
                stroke={color}
                strokeWidth={5}
                fill="none"
                strokeDasharray={linePath.length}
                animatedProps={animatedLineProps}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.3}
                clipPath="url(#revealClip)"
              />
            </Svg>
          ) : (
            <View style={[styles.noData, { height: height - 35 }]}>
              <Text style={styles.noDataText}>暂无K线数据</Text>
            </View>
          )}
        </Animated.View>
      </GestureDetector>

      {/* 周期选择器 */}
      <View style={styles.intervalSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {intervals.map((int) => (
            <TouchableOpacity
              key={int}
              style={[styles.intervalBtn, interval === int && styles.intervalBtnActive]}
              onPress={() => onIntervalChange(int)}
            >
              <Text style={[styles.intervalText, interval === int && styles.intervalTextActive]}>
                {INTERVAL_CONFIG[int].shortLabel}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 缩放提示 */}
      {isZoomed && (
        <View style={styles.zoomHint}>
          <Text style={styles.zoomHintText}>双指缩放中</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  intervalSelector: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  intervalBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  intervalBtnActive: {
    backgroundColor: '#F59E0B',
  },
  intervalText: {
    color: '#888',
    fontSize: 12,
  },
  intervalTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  chartContainer: {
    flex: 1,
  },
  noData: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    color: '#666',
    fontSize: 14,
  },
  zoomHint: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  zoomHintText: {
    color: '#888',
    fontSize: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
});

export default InteractiveKLine;
