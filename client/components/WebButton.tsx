import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

interface WebButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  activeOpacity?: number;
}

/**
 * 兼容搜狗浏览器的按钮组件
 * 使用原生 Web 点击事件
 */
export function WebButton({ title, onPress, style, textStyle, disabled }: WebButtonProps) {
  const handlePress = () => {
    if (!disabled && onPress) {
      onPress();
    }
  };

  return (
    <View 
      style={[styles.button, disabled && styles.disabled, style]}
      // @ts-ignore - Web only
      onClick={handlePress}
      // @ts-ignore - Web only  
      onTouchEnd={(e: any) => {
        e && e.preventDefault && e.preventDefault();
        handlePress();
      }}
    >
      <Text style={[styles.buttonText, textStyle]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
