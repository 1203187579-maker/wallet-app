import React from 'react';
import { View, StyleSheet, ViewStyle, GestureResponderEvent } from 'react-native';

interface WebTouchableProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  disabled?: boolean;
  activeOpacity?: number;
}

/**
 * 兼容搜狗浏览器的 Touchable 组件
 * 
 * 搜狗浏览器不支持 React Native 的手势系统
 * 使用原生 Web 事件代替
 */
export function WebTouchable({ 
  children, 
  onPress, 
  style, 
  disabled 
}: WebTouchableProps) {
  const handlePress = () => {
    if (!disabled && onPress) {
      onPress();
    }
  };

  return (
    <View 
      style={[styles.container, disabled && styles.disabled, style]}
      // @ts-ignore - Web only: onClick
      onClick={handlePress}
      // @ts-ignore - Web only: onTouchEnd for mobile
      onTouchEnd={(e: any) => {
        e && e.preventDefault && e.preventDefault();
        handlePress();
      }}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // 无默认样式，由外部传入
  },
  disabled: {
    opacity: 0.5,
  },
});
