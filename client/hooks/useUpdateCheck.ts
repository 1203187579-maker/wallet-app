import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, Linking, Alert } from 'react-native';
import Constants from 'expo-constants';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

export interface UpdateInfo {
  message: string;
  currentUpdateId: string | null;
  latestVersion: string;
  buildNumber: number;
  updateType: 'force' | 'optional' | 'silent';
  isForceUpdate: boolean;
  updateNotes: string;
  updateUrl?: string;
  updateBundleUrl?: string;
  directives?: {
    type: string;
    message?: string;
  };
}

export interface UseUpdateCheckResult {
  isChecking: boolean;
  updateInfo: UpdateInfo | null;
  hasUpdate: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  checkForUpdate: () => Promise<void>;
  downloadUpdate: () => Promise<boolean>;
  applyUpdate: () => Promise<void>;
  openAppStore: () => void;
}

export function useUpdateCheck(): UseUpdateCheckResult {
  const [isChecking, setIsChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const hasCheckedRef = useRef(false);

  const currentVersion = Constants.expoConfig?.version || '1.0.0';
  const currentBuildNumber = 1; // 简化版本号获取

  const checkForUpdate = useCallback(async () => {
    if (isChecking) return;

    setIsChecking(true);

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/v1/updates/check?platform=${Platform.OS}&currentVersion=${currentVersion}&buildNumber=${currentBuildNumber}`
      );

      const data = await response.json();

      if (data.message === 'update_available') {
        setUpdateInfo(data);
        setHasUpdate(true);
      } else {
        setUpdateInfo(null);
        setHasUpdate(false);
      }
    } catch (error) {
      console.error('Check update error:', error);
      // 检查失败时静默处理
    } finally {
      setIsChecking(false);
    }
  }, [currentVersion, isChecking]);

  const downloadUpdate = useCallback(async (): Promise<boolean> => {
    if (!updateInfo || isDownloading) return false;

    // 如果有应用商店更新链接，不进行下载
    if (updateInfo.updateUrl && !updateInfo.updateBundleUrl) {
      return false;
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      // 开发环境模拟下载
      if (__DEV__) {
        for (let i = 0; i <= 100; i += 10) {
          setDownloadProgress(i);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        return true;
      }

      // 生产环境：提示用户前往应用商店更新
      return true;
    } catch (error) {
      console.error('Download update error:', error);
      return false;
    } finally {
      setIsDownloading(false);
    }
  }, [updateInfo, isDownloading]);

  const applyUpdate = useCallback(async () => {
    try {
      if (__DEV__) {
        Alert.alert('提示', '开发环境无法热更新，请重新启动应用');
        return;
      }
      // 生产环境：提示用户重启
      Alert.alert('提示', '更新已完成，请重启应用');
    } catch (error) {
      console.error('Apply update error:', error);
      Alert.alert('错误', '应用更新失败，请手动重启应用');
    }
  }, []);

  const openAppStore = useCallback(() => {
    const url = Platform.select({
      ios: updateInfo?.updateUrl || 'itms-apps://itunes.apple.com/app',
      android: updateInfo?.updateUrl || 'market://details?id=com.anonymous.app',
    });

    Linking.openURL(url!).catch(() => {
      // 如果应用商店打开失败，尝试打开网页
      const fallbackUrl = Platform.select({
        ios: 'https://apps.apple.com',
        android: 'https://play.google.com/store/apps',
      });
      Linking.openURL(fallbackUrl!);
    });
  }, [updateInfo]);

  // 应用启动时检查更新
  useEffect(() => {
    if (!hasCheckedRef.current) {
      hasCheckedRef.current = true;
      checkForUpdate();
    }
  }, [checkForUpdate]);

  return {
    isChecking,
    updateInfo,
    hasUpdate,
    isDownloading,
    downloadProgress,
    checkForUpdate,
    downloadUpdate,
    applyUpdate,
    openAppStore,
  };
}
