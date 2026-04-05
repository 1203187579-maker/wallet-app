import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/ThemedText';
import { t } from '@/i18n';

const { width } = Dimensions.get('window');

interface MiningAnimationProps {
  totalStaked: number;
  dailyReward: number;
  isActive?: boolean;
  dailyRateDisplay?: string; // 后台配置的日收益率显示范围，如 "0.5-1.5%"
}

// AI金币粒子
const CoinParticle = ({ delay, startX, startY }: { delay: number; startX: number; startY: number }) => {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.5);
  const rotate = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withSequence(
        withTiming(-50, { duration: 500 }),
        withTiming(-90, { duration: 400 })
      )
    );
    translateX.value = withDelay(
      delay,
      withTiming((Math.random() - 0.5) * 60 + 30, { duration: 900 })
    );
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 150 }),
        withDelay(500, withTiming(0, { duration: 250 }))
      )
    );
    scale.value = withDelay(
      delay,
      withSequence(
        withSpring(1),
        withDelay(500, withTiming(0, { duration: 250 }))
      )
    );
    rotate.value = withDelay(
      delay,
      withRepeat(withTiming(360, { duration: 600 }), -1)
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.coin, { left: startX, top: startY }, animatedStyle]}>
      <View style={styles.coinInner}>
        <View style={styles.coinShine} />
        <ThemedText variant="tiny" style={styles.coinText}>AI</ThemedText>
      </View>
    </Animated.View>
  );
};

// 可爱矿工
const CuteMiner = ({ isActive }: { isActive: boolean }) => {
  const bounce = useSharedValue(0);
  const armSwing = useSharedValue(0);
  const hammerSwing = useSharedValue(0);
  const eyeScale = useSharedValue(1);
  const blushPulse = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      bounce.value = withRepeat(
        withSequence(
          withSpring(-12, { damping: 8 }),
          withSpring(0, { damping: 8 })
        ),
        -1,
        false
      );

      armSwing.value = withRepeat(
        withSequence(
          withTiming(-50, { duration: 280 }),
          withTiming(10, { duration: 120, easing: Easing.out(Easing.back(2)) })
        ),
        -1,
        false
      );

      hammerSwing.value = withRepeat(
        withSequence(
          withTiming(-80, { duration: 280 }),
          withTiming(40, { duration: 80 })
        ),
        -1,
        false
      );

      eyeScale.value = withRepeat(
        withDelay(
          2500,
          withSequence(
            withTiming(0.1, { duration: 80 }),
            withTiming(1, { duration: 80 })
          )
        ),
        -1,
        false
      );

      blushPulse.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
    }
  }, [isActive]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bounce.value }],
  }));

  const armStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${armSwing.value}deg` }],
  }));

  const hammerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${hammerSwing.value}deg` }],
  }));

  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: eyeScale.value }],
  }));

  const blushStyle = useAnimatedStyle(() => ({
    transform: [{ scale: blushPulse.value }],
  }));

  return (
    <Animated.View style={[styles.miner, bodyStyle]}>
      <View style={styles.bodyShape}>
        <View style={styles.bodyPattern}>
          <View style={styles.patternLine} />
          <View style={styles.patternLine} />
        </View>
      </View>

      <View style={styles.headShape}>
        <View style={styles.hat}>
          <View style={styles.hatTop} />
          <View style={styles.hatBrim} />
          <View style={styles.hatLight} />
        </View>

        <View style={styles.face}>
          <Animated.View style={[styles.eyes, eyeStyle]}>
            <View style={styles.eye}>
              <View style={[styles.eyeShine, { right: 1 }]} />
            </View>
            <View style={styles.eye}>
              <View style={[styles.eyeShine, { right: 1 }]} />
            </View>
          </Animated.View>

          <View style={styles.mouth}>
            <View style={styles.mouthShape} />
          </View>
        </View>

        <Animated.View style={[styles.blush, styles.blushLeft, blushStyle]} />
        <Animated.View style={[styles.blush, styles.blushRight, blushStyle]} />
      </View>

      <Animated.View style={[styles.armContainer, armStyle]}>
        <View style={styles.arm}>
          <Animated.View style={[styles.hammer, hammerStyle]}>
            <View style={styles.hammerHead}>
              <View style={styles.hammerFace} />
            </View>
            <View style={styles.hammerHandle} />
          </Animated.View>
        </View>
      </Animated.View>

      <View style={styles.feet}>
        <View style={styles.foot} />
        <View style={styles.foot} />
      </View>
    </Animated.View>
  );
};

// 纯金色山峰
const GoldMountain = ({ isActive }: { isActive: boolean }) => {
  const flash = useSharedValue(0);
  const shake = useSharedValue(0);
  const dustOpacity = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      flash.value = withRepeat(
        withSequence(
          withDelay(400, withTiming(1, { duration: 60 })),
          withTiming(0, { duration: 100 })
        ),
        -1,
        false
      );

      shake.value = withRepeat(
        withSequence(
          withDelay(400, withTiming(2, { duration: 30 })),
          withTiming(-1, { duration: 30 }),
          withTiming(0, { duration: 30 })
        ),
        -1,
        false
      );

      dustOpacity.value = withRepeat(
        withSequence(
          withDelay(400, withTiming(0.8, { duration: 100 })),
          withTiming(0, { duration: 300 })
        ),
        -1,
        false
      );
    }
  }, [isActive]);

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value,
  }));

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const dustStyle = useAnimatedStyle(() => ({
    opacity: dustOpacity.value,
  }));

  return (
    <Animated.View style={[styles.mountainContainer, shakeStyle]}>
      {/* 纯金色山峰 */}
      <View style={styles.mountain}>
        {/* 主山体 - 纯金色 */}
        <View style={styles.goldBase} />
        
        {/* 金色纹理层次 */}
        <View style={styles.goldLayer1} />
        <View style={styles.goldLayer2} />
        <View style={styles.goldLayer3} />
        
        {/* 高光 */}
        <View style={styles.highlight1} />
        <View style={styles.highlight2} />
        
        {/* 阴影层次 */}
        <View style={styles.shadow1} />
        <View style={styles.shadow2} />
      </View>

      {/* 砸击闪光 */}
      <Animated.View style={[styles.flashLayer, flashStyle]} />

      {/* 粉尘效果 */}
      <Animated.View style={[styles.dustContainer, dustStyle]}>
        <View style={styles.dust1} />
        <View style={styles.dust2} />
        <View style={styles.dust3} />
      </Animated.View>

      {/* 撞击火花 */}
      <Animated.View style={[styles.impactSpark, flashStyle]}>
        <View style={styles.sparkDot1} />
        <View style={styles.sparkDot2} />
        <View style={styles.sparkDot3} />
        <View style={styles.sparkDot4} />
      </Animated.View>
    </Animated.View>
  );
};

export default function MiningAnimation({ totalStaked, dailyReward, isActive = true, dailyRateDisplay }: MiningAnimationProps) {
  const generateParticles = () => {
    const particles = [];
    for (let i = 0; i < 6; i++) {
      particles.push(
        <CoinParticle
          key={i}
          delay={i * 400 + 400}
          startX={width / 2 + 25 + Math.random() * 30}
          startY={45}
        />
      );
    }
    return particles;
  };

  return (
    <View style={styles.container}>
      <View style={styles.minerPosition}>
        <CuteMiner isActive={isActive} />
      </View>

      <View style={styles.mountainPosition}>
        <GoldMountain isActive={isActive} />
      </View>

      {isActive && generateParticles()}

      <View style={styles.infoContainer}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <ThemedText variant="caption" style={styles.infoLabel}>{t('stake.staking')}</ThemedText>
            <ThemedText variant="smallMedium" style={styles.infoValue}>
              {totalStaked.toLocaleString()} GPU
            </ThemedText>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoItem}>
            <ThemedText variant="caption" style={styles.infoLabel}>{t('stake.dailyOutput')}</ThemedText>
            <ThemedText variant="smallMedium" style={[styles.infoValue, { color: '#F59E0B' }]}>
              {dailyRateDisplay || `+${dailyReward.toFixed(4)} GPU`}
            </ThemedText>
          </View>
        </View>
      </View>

      {isActive && (
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <ThemedText variant="tiny" style={styles.statusText}>{t('stake.mining')}</ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  minerPosition: {
    position: 'absolute',
    left: width / 2 - 95,
    bottom: 45,
  },

  // 矿工样式
  miner: {
    alignItems: 'center',
  },
  bodyShape: {
    width: 50,
    height: 45,
    backgroundColor: '#F59E0B',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  bodyPattern: {
    gap: 4,
  },
  patternLine: {
    width: 20,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  headShape: {
    position: 'absolute',
    top: -32,
    alignItems: 'center',
  },
  hat: {
    alignItems: 'center',
    zIndex: 2,
  },
  hatTop: {
    width: 36,
    height: 20,
    backgroundColor: '#F59E0B',
    borderRadius: 18,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  hatBrim: {
    width: 42,
    height: 6,
    backgroundColor: '#D97706',
    borderRadius: 3,
    marginTop: -2,
  },
  hatLight: {
    position: 'absolute',
    top: 6,
    width: 8,
    height: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    shadowColor: '#FEF3C7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  face: {
    width: 32,
    height: 26,
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    marginTop: -4,
    alignItems: 'center',
    paddingTop: 6,
  },
  eyes: {
    flexDirection: 'row',
    gap: 8,
  },
  eye: {
    width: 6,
    height: 6,
    backgroundColor: '#1F2937',
    borderRadius: 3,
    overflow: 'hidden',
  },
  eyeShine: {
    position: 'absolute',
    top: 1,
    width: 2,
    height: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  mouth: {
    marginTop: 3,
  },
  mouthShape: {
    width: 8,
    height: 4,
    borderBottomWidth: 2,
    borderBottomColor: '#F59E0B',
    borderRadius: 4,
  },
  blush: {
    position: 'absolute',
    width: 8,
    height: 4,
    backgroundColor: '#FCA5A5',
    borderRadius: 4,
    opacity: 0.7,
  },
  blushLeft: {
    top: 14,
    left: 2,
  },
  blushRight: {
    top: 14,
    right: 2,
  },
  armContainer: {
    position: 'absolute',
    right: -20,
    top: 5,
  },
  arm: {
    width: 18,
    height: 14,
    backgroundColor: '#FEF3C7',
    borderRadius: 9,
    alignItems: 'center',
  },
  hammer: {
    position: 'absolute',
    left: 8,
    top: 8,
    alignItems: 'center',
  },
  hammerHead: {
    width: 28,
    height: 20,
    backgroundColor: '#6B7280',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  hammerFace: {
    width: 20,
    height: 12,
    backgroundColor: '#9CA3AF',
    borderRadius: 3,
  },
  hammerHandle: {
    width: 6,
    height: 18,
    backgroundColor: '#92400E',
    borderRadius: 3,
    marginTop: -4,
  },
  feet: {
    flexDirection: 'row',
    gap: 8,
    marginTop: -4,
  },
  foot: {
    width: 16,
    height: 10,
    backgroundColor: '#78350F',
    borderRadius: 5,
  },

  // 金山位置
  mountainPosition: {
    position: 'absolute',
    left: width / 2 + 5,
    bottom: 55,
  },

  mountainContainer: {
    position: 'relative',
  },

  // 主山峰 - 纯金色三角形
  mountain: {
    width: 85,
    height: 75,
    position: 'relative',
  },

  // 纯金色山体
  goldBase: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 42,
    borderRightWidth: 43,
    borderBottomWidth: 75,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FBBF24',
  },

  // 金色纹理层次
  goldLayer1: {
    position: 'absolute',
    left: 20,
    top: 30,
    width: 0,
    height: 0,
    borderLeftWidth: 20,
    borderRightWidth: 20,
    borderBottomWidth: 35,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FCD34D',
    opacity: 0.6,
  },
  goldLayer2: {
    position: 'absolute',
    left: 35,
    top: 15,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FDE68A',
    opacity: 0.5,
  },
  goldLayer3: {
    position: 'absolute',
    left: 10,
    top: 40,
    width: 0,
    height: 0,
    borderLeftWidth: 15,
    borderRightWidth: 15,
    borderBottomWidth: 25,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#F59E0B',
    opacity: 0.4,
  },

  // 高光
  highlight1: {
    position: 'absolute',
    left: 25,
    top: 25,
    width: 15,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 4,
    transform: [{ rotate: '-25deg' }],
  },
  highlight2: {
    position: 'absolute',
    left: 18,
    top: 35,
    width: 10,
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 3,
    transform: [{ rotate: '-20deg' }],
  },

  // 阴影层次
  shadow1: {
    position: 'absolute',
    right: 15,
    top: 35,
    width: 0,
    height: 0,
    borderLeftWidth: 15,
    borderRightWidth: 15,
    borderBottomWidth: 25,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#D97706',
    opacity: 0.3,
  },
  shadow2: {
    position: 'absolute',
    right: 8,
    bottom: 10,
    width: 20,
    height: 12,
    backgroundColor: '#D97706',
    opacity: 0.2,
    borderRadius: 4,
  },

  // 闪光层
  flashLayer: {
    position: 'absolute',
    left: 10,
    top: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 30,
    borderRightWidth: 30,
    borderBottomWidth: 50,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(254, 243, 199, 0.6)',
  },

  // 粉尘效果
  dustContainer: {
    position: 'absolute',
    left: 0,
    top: 30,
  },
  dust1: {
    position: 'absolute',
    width: 18,
    height: 18,
    backgroundColor: 'rgba(251, 191, 36, 0.6)',
    borderRadius: 9,
    left: 0,
    top: 0,
  },
  dust2: {
    position: 'absolute',
    width: 14,
    height: 14,
    backgroundColor: 'rgba(251, 191, 36, 0.5)',
    borderRadius: 7,
    left: 8,
    top: 12,
  },
  dust3: {
    position: 'absolute',
    width: 10,
    height: 10,
    backgroundColor: 'rgba(251, 191, 36, 0.4)',
    borderRadius: 5,
    left: -3,
    top: 18,
  },

  // 撞击火花
  impactSpark: {
    position: 'absolute',
    left: 5,
    top: 35,
    width: 30,
    height: 30,
  },
  sparkDot1: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 5,
    height: 5,
    backgroundColor: '#FEF3C7',
    borderRadius: 3,
    shadowColor: '#FEF3C7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  sparkDot2: {
    position: 'absolute',
    top: 12,
    left: 0,
    width: 4,
    height: 4,
    backgroundColor: '#FDE68A',
    borderRadius: 2,
  },
  sparkDot3: {
    position: 'absolute',
    top: 8,
    left: 12,
    width: 4,
    height: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 2,
  },
  sparkDot4: {
    position: 'absolute',
    top: 18,
    left: 6,
    width: 3,
    height: 3,
    backgroundColor: '#FDE68A',
    borderRadius: 2,
  },

  // AI金币
  coin: {
    position: 'absolute',
  },
  coinInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FBBF24',
    borderWidth: 2,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  coinShine: {
    position: 'absolute',
    top: 3,
    left: 4,
    width: 8,
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 3,
    transform: [{ rotate: '-30deg' }],
  },
  coinText: {
    color: '#92400E',
    fontWeight: '800',
    fontSize: 8,
    letterSpacing: 0.5,
  },

  // 底部信息
  infoContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValue: {
    color: '#FFFFFF',
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },

  // 状态
  statusBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  statusText: {
    color: '#F59E0B',
  },
});
