import React, { useMemo, useState, useCallback, useRef } from 'react';
import { 
  ScrollView, 
  View, 
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Text,
  Image,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/AuthContext';
import { createStyles } from './styles';
import { alert } from '@/utils/alert';
import * as Clipboard from 'expo-clipboard';

export default function InviteScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { user, isAuthenticated, isLoading: authLoading, referralStats } = useAuth();
  
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const posterRef = useRef<View>(null);

  // 邀请链接
  const inviteCode = user?.referral_code || '';
  const inviteLink = `https://boostara.app/invite?code=${inviteCode}`;

  // 复制邀请码
  const handleCopyCode = async () => {
    if (inviteCode) {
      await Clipboard.setStringAsync(inviteCode);
      alert(t('common.success'), '邀请码已复制');
    }
  };

  // 复制邀请链接
  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(inviteLink);
    alert(t('common.success'), '邀请链接已复制');
  };

  // 保存海报
  const handleSavePoster = async () => {
    if (!posterRef.current) return;
    
    try {
      setSaving(true);
      
      // 截图
      const uri = await captureRef(posterRef, {
        format: 'png',
        quality: 1,
      });

      if (Platform.OS === 'web') {
        // Web端直接下载
        const link = (document as any).createElement('a');
        link.href = uri;
        link.download = `invite-${inviteCode}.png`;
        link.click();
      } else {
        // 移动端分享
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
        } else {
          alert('提示', '海报已保存');
        }
      }
    } catch (error) {
      console.error('Save poster error:', error);
      alert('错误', '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <Screen backgroundColor="#000000" statusBarStyle="light">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor="#000000" statusBarStyle="light">
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => setRefreshing(false)}
            tintColor="#F59E0B"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <ThemedText variant="h3" style={styles.headerTitle}>
            邀请好友
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {/* Poster Card */}
        <View ref={posterRef} style={styles.posterCard} collapsable={false}>
          {/* Poster Header */}
          <View style={styles.posterHeader}>
            <View style={styles.logoRow}>
              <View style={styles.logoIcon}>
                <FontAwesome6 name="rocket" size={24} color="#F59E0B" />
              </View>
              <ThemedText style={styles.logoText}>BoostAra</ThemedText>
            </View>
            <ThemedText style={styles.posterTitle}>邀请好友 赚取奖励</ThemedText>
            <ThemedText style={styles.posterSubtitle}>邀请好友注册并质押，获得丰厚返佣</ThemedText>
          </View>

          {/* QR Code */}
          <View style={styles.qrcodeSection}>
            <View style={styles.qrcodeWrapper}>
              <QRCode
                value={inviteLink}
                size={160}
                color="#000000"
                backgroundColor="#FFFFFF"
              />
            </View>
            <ThemedText style={styles.scanHint}>扫码注册</ThemedText>
          </View>

          {/* Invite Code */}
          <View style={styles.codeSection}>
            <ThemedText style={styles.codeLabel}>邀请码</ThemedText>
            <View style={styles.codeBox}>
              <ThemedText style={styles.codeText}>{inviteCode}</ThemedText>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <ThemedText style={styles.statValue}>
                {referralStats?.direct_count || 0}
              </ThemedText>
              <ThemedText style={styles.statLabel}>已邀请</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: '#10B981' }]}>
                ${parseFloat(referralStats?.total_reward || '0').toFixed(2)}
              </ThemedText>
              <ThemedText style={styles.statLabel}>累计收益</ThemedText>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSavePoster} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <>
                <FontAwesome6 name="download" size={18} color="#000000" />
                <ThemedText style={styles.primaryBtnText}>保存海报</ThemedText>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.secondaryRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleCopyCode}>
              <FontAwesome6 name="copy" size={16} color="#F59E0B" />
              <ThemedText style={styles.secondaryBtnText}>复制邀请码</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleCopyLink}>
              <FontAwesome6 name="link" size={16} color="#F59E0B" />
              <ThemedText style={styles.secondaryBtnText}>复制链接</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Rules */}
        <View style={styles.rulesSection}>
          <ThemedText style={styles.rulesTitle}>邀请规则</ThemedText>
          <View style={styles.ruleItem}>
            <View style={styles.ruleDot} />
            <ThemedText style={styles.ruleText}>分享邀请码或海报给好友</ThemedText>
          </View>
          <View style={styles.ruleItem}>
            <View style={styles.ruleDot} />
            <ThemedText style={styles.ruleText}>好友注册并完成质押</ThemedText>
          </View>
          <View style={styles.ruleItem}>
            <View style={styles.ruleDot} />
            <ThemedText style={styles.ruleText}>获得好友质押金额的返佣奖励</ThemedText>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
