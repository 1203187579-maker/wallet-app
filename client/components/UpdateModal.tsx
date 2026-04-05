import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUpdateCheck, UpdateInfo } from '@/hooks/useUpdateCheck';
import { ThemedText } from '@/components/ThemedText';
import { Spacing, BorderRadius } from '@/constants/theme';

interface UpdateModalProps {
  visible: boolean;
  updateInfo: UpdateInfo | null;
  isDownloading: boolean;
  downloadProgress: number;
  onClose: () => void;
  onUpdate: () => void;
  onOpenAppStore: () => void;
}

export function UpdateModal({
  visible,
  updateInfo,
  isDownloading,
  downloadProgress,
  onClose,
  onUpdate,
  onOpenAppStore,
}: UpdateModalProps) {
  const { theme } = useTheme();
  const [progressAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: downloadProgress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [downloadProgress]);

  if (!visible || !updateInfo) return null;

  const isForceUpdate = updateInfo.isForceUpdate || updateInfo.updateType === 'force';
  const hasBundleUrl = !!updateInfo.updateBundleUrl;
  const needsAppStoreUpdate = updateInfo.updateUrl && !hasBundleUrl;

  const handleUpdate = () => {
    if (needsAppStoreUpdate) {
      onOpenAppStore();
    } else {
      onUpdate();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isForceUpdate ? undefined : onClose}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
          {/* Header */}
          <View style={styles.header}>
            <ThemedText variant="h3" color={theme.textPrimary}>
              发现新版本
            </ThemedText>
            <ThemedText variant="caption" color={theme.textMuted}>
              v{updateInfo.latestVersion} ({updateInfo.buildNumber})
            </ThemedText>
          </View>

          {/* Update Notes */}
          <ScrollView style={styles.notesContainer}>
            <ThemedText variant="body" color={theme.textSecondary}>
              {updateInfo.updateNotes || '修复了一些问题，优化了用户体验'}
            </ThemedText>
          </ScrollView>

          {/* Download Progress */}
          {isDownloading && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: theme.primary,
                      width: progressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <ThemedText variant="caption" color={theme.textMuted}>
                下载中... {downloadProgress}%
              </ThemedText>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            {!isForceUpdate && !isDownloading && (
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, { borderColor: theme.border }]}
                onPress={onClose}
              >
                <ThemedText variant="bodyMedium" color={theme.textSecondary}>
                  稍后更新
                </ThemedText>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.button,
                styles.updateButton,
                { backgroundColor: theme.primary },
                isForceUpdate && styles.fullWidthButton,
              ]}
              onPress={handleUpdate}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <ActivityIndicator color={theme.buttonPrimaryText} size="small" />
              ) : (
                <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
                  {needsAppStoreUpdate ? '前往更新' : '立即更新'}
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>

          {/* Force Update Hint */}
          {isForceUpdate && (
            <ThemedText variant="caption" color={theme.textMuted} style={styles.forceHint}>
              此版本为重要更新，请更新后继续使用
            </ThemedText>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    alignItems: 'center',
  },
  notesContainer: {
    maxHeight: 200,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  progressContainer: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  buttonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  updateButton: {
    minWidth: 120,
  },
  fullWidthButton: {
    flex: 1,
  },
  forceHint: {
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
});
