/**
 * 热更新检测 Hook
 * 用于检测应用更新并提示用户
 */

import { useEffect, useCallback, useState } from 'react';
import * as Updates from 'expo-updates';
import { Alert, Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000; // 30分钟检查一次
const LAST_CHECK_KEY = 'last_update_check';

interface UpdateInfo {
  isUpdateAvailable: boolean;
  isMandatory: boolean;
  currentVersion: string;
  latestVersion: string;
  updateMessage?: string;
  downloadUrl?: string;
}

export function useAppUpdate() {
  const [isChecking, setIsChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  /**
   * 检查 OTA 热更新
   */
  const checkOTAUpdate = useCallback(async () => {
    // 仅在非开发环境检查
    if (__DEV__ || Platform.OS === 'web') {
      return null;
    }

    try {
      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        return {
          isUpdateAvailable: true,
          isMandatory: false,
          currentVersion: Updates.updateId || '1.0.0',
          latestVersion: 'latest',
        };
      }
      
      return null;
    } catch (error) {
      console.log('[Update] OTA check failed:', error);
      return null;
    }
  }, []);

  /**
   * 检查服务器版本更新
   */
  const checkServerUpdate = useCallback(async () => {
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      if (!backendUrl) return null;

      const response = await fetch(`${backendUrl}/api/v1/updates/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: Platform.OS,
          currentVersion: Updates.updateId || '1.0.0',
          buildNumber: '1',
        }),
      });

      const data = await response.json();
      
      if (data.success && data.data?.hasUpdate) {
        return {
          isUpdateAvailable: true,
          isMandatory: data.data.isMandatory || false,
          currentVersion: data.data.currentVersion,
          latestVersion: data.data.latestVersion,
          updateMessage: data.data.updateMessage,
          downloadUrl: data.data.downloadUrl,
        };
      }
      
      return null;
    } catch (error) {
      console.log('[Update] Server check failed:', error);
      return null;
    }
  }, []);

  /**
   * 执行更新检查
   */
  const checkForUpdate = useCallback(async (force: boolean = false) => {
    if (isChecking) return null;
    
    // 检查是否需要检查更新
    if (!force) {
      const lastCheck = await AsyncStorage.getItem(LAST_CHECK_KEY);
      if (lastCheck && Date.now() - parseInt(lastCheck) < UPDATE_CHECK_INTERVAL) {
        return null;
      }
    }

    setIsChecking(true);

    try {
      // 先检查OTA更新
      let info = await checkOTAUpdate();
      
      // 如果没有OTA更新，检查服务器版本
      if (!info) {
        info = await checkServerUpdate();
      }

      if (info) {
        setUpdateInfo(info);
      }

      // 更新最后检查时间
      await AsyncStorage.setItem(LAST_CHECK_KEY, Date.now().toString());

      return info;
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, checkOTAUpdate, checkServerUpdate]);

  /**
   * 下载并应用OTA更新
   */
  const downloadAndApplyUpdate = useCallback(async () => {
    if (__DEV__ || Platform.OS === 'web') {
      Alert.alert('提示', '开发环境不支持热更新');
      return false;
    }

    try {
      setIsChecking(true);
      
      // 下载更新
      const downloadResult = await Updates.fetchUpdateAsync();
      
      if (downloadResult.isNew) {
        Alert.alert(
          '更新完成',
          '应用已更新，需要重启才能生效。是否立即重启？',
          [
            { text: '稍后', style: 'cancel' },
            { 
              text: '立即重启', 
              onPress: () => {
                Updates.reloadAsync();
              }
            },
          ]
        );
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[Update] Download failed:', error);
      Alert.alert('更新失败', '下载更新失败，请稍后重试');
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  /**
   * 打开应用商店下载新版本
   */
  const openAppStore = useCallback((url?: string) => {
    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert('错误', '无法打开下载链接');
      });
    } else if (Platform.OS === 'ios') {
      Linking.openURL('itms-apps://itunes.apple.com/app/idYOUR_APP_ID');
    } else {
      Linking.openURL('market://details?id=YOUR_PACKAGE_NAME');
    }
  }, []);

  /**
   * 显示更新对话框
   */
  const showUpdateDialog = useCallback((info: UpdateInfo) => {
    if (info.downloadUrl) {
      // 需要下载新版本
      Alert.alert(
        info.isMandatory ? '强制更新' : '发现新版本',
        info.updateMessage || `发现新版本 ${info.latestVersion}，是否立即更新？`,
        info.isMandatory ? [
          { 
            text: '立即更新', 
            onPress: () => openAppStore(info.downloadUrl)
          }
        ] : [
          { text: '稍后提醒', style: 'cancel' },
          { 
            text: '立即更新', 
            onPress: () => openAppStore(info.downloadUrl)
          },
        ]
      );
    } else {
      // OTA热更新
      Alert.alert(
        info.isMandatory ? '强制更新' : '发现新版本',
        info.updateMessage || '发现新版本，是否立即更新？',
        info.isMandatory ? [
          { 
            text: '立即更新', 
            onPress: downloadAndApplyUpdate
          }
        ] : [
          { text: '稍后提醒', style: 'cancel' },
          { 
            text: '立即更新', 
            onPress: downloadAndApplyUpdate
          },
        ]
      );
    }
  }, [openAppStore, downloadAndApplyUpdate]);

  /**
   * 应用启动时自动检查更新
   */
  useEffect(() => {
    if (!__DEV__ && Platform.OS !== 'web') {
      checkForUpdate().then((info) => {
        if (info && info.isMandatory) {
          showUpdateDialog(info);
        }
      });
    }
  }, []);

  return {
    isChecking,
    updateInfo,
    checkForUpdate,
    downloadAndApplyUpdate,
    showUpdateDialog,
    openAppStore,
  };
}
