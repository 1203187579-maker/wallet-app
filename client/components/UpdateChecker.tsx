import React, { useEffect, useState } from 'react';
import { UpdateModal } from '@/components/UpdateModal';
import { useUpdateCheck } from '@/hooks/useUpdateCheck';

export function UpdateChecker() {
  const {
    hasUpdate,
    updateInfo,
    isDownloading,
    downloadProgress,
    checkForUpdate,
    downloadUpdate,
    applyUpdate,
    openAppStore,
  } = useUpdateCheck();

  const [modalVisible, setModalVisible] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    if (hasUpdate && updateInfo) {
      setModalVisible(true);
    }
  }, [hasUpdate, updateInfo]);

  const handleClose = () => {
    if (updateInfo?.isForceUpdate || updateInfo?.updateType === 'force') {
      return; // 强制更新不允许关闭
    }
    setModalVisible(false);
  };

  const handleUpdate = async () => {
    if (!updateInfo) return;

    // 如果需要应用商店更新
    if (updateInfo.updateUrl && !updateInfo.updateBundleUrl) {
      openAppStore();
      return;
    }

    // 下载热更新
    const success = await downloadUpdate();
    if (success) {
      setDownloaded(true);
      // 自动应用更新
      setTimeout(() => {
        applyUpdate();
      }, 500);
    }
  };

  return (
    <UpdateModal
      visible={modalVisible}
      updateInfo={updateInfo}
      isDownloading={isDownloading}
      downloadProgress={downloadProgress}
      onClose={handleClose}
      onUpdate={handleUpdate}
      onOpenAppStore={openAppStore}
    />
  );
}
