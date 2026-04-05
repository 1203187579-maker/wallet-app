import { Alert as RNAlert, Platform } from 'react-native';

interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

/**
 * 跨平台 Alert
 * - 原生端使用 React Native Alert
 * - Web 端使用 window.confirm / window.alert
 */
export const showAlert = (
  title: string,
  message?: string,
  buttons?: AlertButton[]
) => {
  if (Platform.OS === 'web') {
    // Web 端处理
    if (buttons && buttons.length > 1) {
      // 多按钮：使用 confirm
      const confirmText = buttons.find(b => b.style !== 'cancel')?.text || '确定';
      const cancelText = buttons.find(b => b.style === 'cancel')?.text || '取消';
      
      const confirmed = window.confirm(`${title}\n\n${message || ''}`);
      if (confirmed) {
        const confirmButton = buttons.find(b => b.style !== 'cancel');
        confirmButton?.onPress?.();
      } else {
        const cancelButton = buttons.find(b => b.style === 'cancel');
        cancelButton?.onPress?.();
      }
    } else if (buttons && buttons.length === 1) {
      // 单按钮：使用 alert
      window.alert(`${title}\n\n${message || ''}`);
      buttons[0]?.onPress?.();
    } else {
      // 无按钮：仅提示
      window.alert(`${title}${message ? `\n\n${message}` : ''}`);
    }
  } else {
    // 原生端使用 RN Alert
    RNAlert.alert(title, message, buttons);
  }
};

/**
 * 简单提示（单按钮）
 */
export const alert = (title: string, message?: string) => {
  showAlert(title, message, [{ text: '确定' }]);
};

/**
 * 确认对话框（双按钮）
 */
export const confirm = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
  confirmText: string = '确定',
  cancelText: string = '取消',
  destructive: boolean = false
) => {
  showAlert(title, message, [
    { text: cancelText, style: 'cancel', onPress: onCancel },
    { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
};
