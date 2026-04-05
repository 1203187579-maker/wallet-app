import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path, Defs, LinearGradient, Stop, ClipPath, Rect } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface AnimatedKLineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  animationDuration?: number;
  autoPlay?: boolean;
}

export const AnimatedKLine: React.FC<AnimatedKLineProps> = ({
  data,
  width: propWidth,
  height = 200,
  color = '#F59E0B',
  animationDuration = 2000,
  autoPlay = true,
}) => {
  const screenWidth = Dimensions.get('window').width;
  const width = propWidth || screenWidth;

  // 动画进度
  const progress = useSharedValue(0);
  const clipWidth = useSharedValue(0);

  // 计算路径
  const { linePath, areaPath, points } = useMemo(() => {
    if (!data || data.length < 2) {
      return { linePath: '', areaPath: '', points: [] };
    }

    const padding = 10;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    const range = maxVal - minVal || 1;

    // 计算点位置
    const pts = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((value - minVal) / range) * chartHeight;
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
    const areaD = `${lineD} L ${pts[pts.length - 1].x} ${height - padding} L ${pts[0].x} ${height - padding} Z`;

    return { linePath: lineD, areaPath: areaD, points: pts };
  }, [data, width, height]);

  // 线条动画
  const animatedLineProps = useAnimatedProps(() => {
    const strokeDashoffset = linePath.length * (1 - progress.value);
    return {
      strokeDashoffset,
    };
  });

  // 裁剪动画
  const animatedClipProps = useAnimatedProps(() => {
    return {
      width: clipWidth.value,
    };
  });

  // 启动动画
  useEffect(() => {
    if (autoPlay && data && data.length >= 2) {
      progress.value = 0;
      clipWidth.value = 0;
      
      // 线条绘制动画
      progress.value = withTiming(1, {
        duration: animationDuration,
        easing: Easing.out(Easing.quad),
      });
      
      // 裁剪区域动画（稍延迟）
      clipWidth.value = withDelay(100, withTiming(width, {
        duration: animationDuration - 100,
        easing: Easing.out(Easing.quad),
      }));
    }
  }, [data, autoPlay]);

  if (!data || data.length < 2) {
    return <View style={[styles.container, { width, height }]} />;
  }

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          {/* 金色渐变 */}
          <LinearGradient id="goldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.8" />
            <Stop offset="50%" stopColor={color} stopOpacity="0.4" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.1" />
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
});

export default AnimatedKLine;
