import React, { useMemo, useState, useCallback } from 'react';
import { 
  ScrollView, 
  View, 
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/AuthContext';
import { walletApi, assetApi, priceApi, type Wallet, type Asset, type TokenPrice } from '@/services/api';
import { createStyles } from './styles';
import { showAlert } from '@/utils/alert';

export default function WalletScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { user, isAuthenticated, isLoading: authLoading, refreshUser, wallet: authWallet } = useAuth();
  
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [prices, setPrices] = useState<TokenPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal 状态
  const [showExportModal, setShowExportModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // 表单状态
  const [modalPassword, setModalPassword] = useState('');
  const [exportType, setExportType] = useState<'mnemonic' | 'private_key'>('mnemonic');
  const [submitting, setSubmitting] = useState(false);
  
  // 导出结果
  const [exportedMnemonic, setExportedMnemonic] = useState('');
  const [exportedPrivateKey, setExportedPrivateKey] = useState('');

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      const [walletsResult, assetsResult, pricesResult] = await Promise.all([
        walletApi.getList(),
        assetApi.getList(),
        priceApi.getAll(),
      ]);

      if (walletsResult.success && walletsResult.data) {
        setWallets(walletsResult.data.wallets);
      }
      if (assetsResult.success && assetsResult.data) {
        setAssets(assetsResult.data.assets);
      }
      if (pricesResult.success && pricesResult.data) {
        setPrices(pricesResult.data.prices);
      }
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadData(), refreshUser()]);
    setRefreshing(false);
  }, [loadData, refreshUser]);

  const primaryWallet = wallets.find(w => w.is_primary) || wallets[0] || authWallet;
  // 使用 API 返回的钱包列表或 AuthContext 中的钱包数据判断
  const hasWallet = wallets.length > 0 || !!authWallet;
  const hasMnemonic = primaryWallet?.has_mnemonic !== false;

  // 计算总资产
  const totalBalance = assets.reduce((sum, asset) => {
    const price = prices.find(p => p.token_symbol === asset.token_symbol);
    const balance = parseFloat(asset.balance) || 0;
    const value = balance * (price ? parseFloat(price.price_usd) : 0);
    return sum + value;
  }, 0);

  const handleCreateWallet = async () => {
    if (!modalPassword.trim() || modalPassword.length < 6) {
      showAlert('错误', '支付密码至少6位');
      return;
    }

    setSubmitting(true);
    try {
      const result = await walletApi.create(modalPassword);
      if (result.success) {
        showAlert('成功', '钱包创建成功！', [
          { text: '确定', onPress: () => {
            loadData();
            refreshUser();
          }}
        ]);
      } else {
        showAlert('创建失败', result.error || '请重试');
      }
    } catch (error: any) {
      showAlert('创建失败', error.message || '网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    if (!modalPassword.trim()) {
      showAlert('错误', '请输入支付密码');
      return;
    }

    setSubmitting(true);
    try {
      if (exportType === 'mnemonic') {
        const result = await walletApi.exportMnemonic(modalPassword);
        if (result.success && result.data) {
          setExportedMnemonic(result.data.mnemonic);
          setExportedPrivateKey('');
          setShowExportModal(false);
          setShowResultModal(true);
        } else {
          showAlert('导出失败', result.error || '密码错误');
        }
      } else {
        const result = await walletApi.exportPrivateKey(modalPassword);
        if (result.success && result.data) {
          setExportedMnemonic('');
          setExportedPrivateKey(result.data.private_key);
          setShowExportModal(false);
          setShowResultModal(true);
        } else {
          showAlert('导出失败', result.error || '密码错误');
        }
      }
    } catch (error: any) {
      showAlert('导出失败', error.message || '网络错误');
    } finally {
      setSubmitting(false);
      setModalPassword('');
    }
  };

  const closeResultModal = () => {
    setShowResultModal(false);
    setExportedMnemonic('');
    setExportedPrivateKey('');
    setModalPassword('');
    loadData();
  };

  // 检查登录状态
  if (authLoading || loading) {
    return (
      <Screen backgroundColor="#000000" statusBarStyle="light">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <ThemedText variant="caption" color={theme.textMuted} style={{ marginTop: 16 }}>
            加载中...
          </ThemedText>
        </View>
      </Screen>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // 无钱包状态
  if (!hasWallet) {
    return (
      <Screen backgroundColor="#000000" statusBarStyle="light">
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FontAwesome6 name="wallet" size={40} color="#F59E0B" />
          </View>
          <ThemedText variant="h3" style={{ color: '#FFFFFF', marginBottom: 12 }}>
            创建钱包
          </ThemedText>
          <ThemedText variant="body" style={{ color: '#6B7280', marginBottom: 32, textAlign: 'center' }}>
            创建新钱包或导入已有钱包
          </ThemedText>
          
          <TouchableOpacity 
            style={styles.modalConfirmBtn} 
            onPress={() => setShowCreateModal(true)}
          >
            <ThemedText style={styles.modalConfirmBtnText}>创建钱包</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Create Wallet Modal */}
        <Modal visible={showCreateModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ThemedText style={styles.modalTitle}>创建钱包</ThemedText>
              
              <TextInput
                style={styles.modalInput}
                placeholder="设置支付密码（至少6位）"
                placeholderTextColor="#6B7280"
                value={modalPassword}
                onChangeText={setModalPassword}
                secureTextEntry
              />
              
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.modalCancelBtn}
                  onPress={() => { setShowCreateModal(false); setModalPassword(''); }}
                >
                  <ThemedText style={styles.modalCancelBtnText}>取消</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalConfirmBtn}
                  onPress={handleCreateWallet}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#000000" />
                  ) : (
                    <ThemedText style={styles.modalConfirmBtnText}>创建</ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
            onRefresh={onRefresh}
            tintColor="#F59E0B"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topBarButton}>
            <FontAwesome6 name="bell" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.topBarButton}
            onPress={() => router.push('/settings')}
          >
            <FontAwesome6 name="globe" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Wallet Card - Orange Background */}
        <View style={styles.walletCard}>
          <View style={styles.walletCardHeader}>
            <ThemedText style={styles.walletLabel}>
              总资产价值
            </ThemedText>
            <View style={styles.chainTag}>
              <View style={styles.chainDot} />
              <ThemedText style={styles.chainText}>
                BoostAra
              </ThemedText>
            </View>
          </View>
          <ThemedText style={styles.walletBalance}>
            ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </ThemedText>
          <View style={styles.walletAddressRow}>
            <ThemedText style={styles.walletAddressText}>
              {primaryWallet?.address.slice(0, 6)}...{primaryWallet?.address.slice(-4)}
            </ThemedText>
            <FontAwesome6 name="copy" size={14} color="rgba(0,0,0,0.6)" />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickActionBtn}
            onPress={() => router.push('/wallet-send')}
          >
            <View style={styles.quickActionIcon}>
              <FontAwesome6 name="paper-plane" size={20} color="#F59E0B" />
            </View>
            <ThemedText style={styles.quickActionText}>发送</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionBtn}
            onPress={() => router.push('/wallet-receive')}
          >
            <View style={styles.quickActionIcon}>
              <FontAwesome6 name="qrcode" size={20} color="#F59E0B" />
            </View>
            <ThemedText style={styles.quickActionText}>接收</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Management Section */}
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>钱包管理</ThemedText>
        </View>
        
        <View style={styles.managementCard}>
          {hasMnemonic && (
            <TouchableOpacity 
              style={styles.managementItem}
              onPress={() => { setExportType('mnemonic'); setModalPassword(''); setShowExportModal(true); }}
            >
              <View style={styles.managementIcon}>
                <FontAwesome6 name="key" size={18} color="#F59E0B" />
              </View>
              <View style={styles.managementInfo}>
                <ThemedText style={styles.managementTitle}>导出助记词</ThemedText>
                <ThemedText style={styles.managementDesc}>备份您的助记词</ThemedText>
              </View>
              <FontAwesome6 name="chevron-right" size={12} color="#6B7280" />
            </TouchableOpacity>
          )}
          
          {hasMnemonic && <View style={styles.managementDivider} />}
          
          <TouchableOpacity 
            style={styles.managementItem}
            onPress={() => { setExportType('private_key'); setModalPassword(''); setShowExportModal(true); }}
          >
            <View style={styles.managementIcon}>
              <FontAwesome6 name="lock" size={18} color="#F59E0B" />
            </View>
            <View style={styles.managementInfo}>
              <ThemedText style={styles.managementTitle}>导出私钥</ThemedText>
              <ThemedText style={styles.managementDesc}>查看您的私钥</ThemedText>
            </View>
            <FontAwesome6 name="chevron-right" size={12} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Assets Section */}
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>代币资产</ThemedText>
        </View>

        <View style={{ marginBottom: Spacing.xl }}>
          {assets.length > 0 ? (
            assets.map((asset) => {
              const price = prices.find(p => p.token_symbol === asset.token_symbol);
              const balance = parseFloat(asset.balance) || 0;
              const value = balance * (price ? parseFloat(price.price_usd) : 0);

              return (
                <View key={asset.id} style={styles.assetItem}>
                  <View style={styles.assetLeft}>
                    <View style={styles.assetIcon}>
                      <FontAwesome6 
                        name={
                          asset.token_symbol === 'BTC' ? 'bitcoin' : 
                          asset.token_symbol === 'ETH' ? 'ethereum' : 
                          asset.token_symbol === 'AI' ? 'gem' :
                          asset.token_symbol === 'GPU' ? 'microchip' :
                          'coins'
                        } 
                        size={20} 
                        color="#F59E0B" 
                      />
                    </View>
                    <View style={styles.assetInfo}>
                      <ThemedText style={styles.assetSymbol}>{asset.token_symbol}</ThemedText>
                      <ThemedText style={styles.assetName}>
                        {asset.token_symbol === 'BTC' ? 'Bitcoin' : 
                         asset.token_symbol === 'ETH' ? 'Ethereum' : 
                         asset.token_symbol === 'AI' ? 'AI Token' :
                         asset.token_symbol === 'GPU' ? 'GPU Token' :
                         asset.token_symbol === 'USDT' ? 'Tether' : 
                         'Platform Token'}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.assetRight}>
                    <ThemedText style={styles.assetAmount}>{balance.toFixed(4)}</ThemedText>
                    <ThemedText style={styles.assetValue}>${value.toFixed(2)}</ThemedText>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyAssets}>
              <FontAwesome6 name="coins" size={24} color="#6B7280" />
              <ThemedText style={styles.emptyAssetsText}>暂无资产</ThemedText>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Export Modal */}
      <Modal visible={showExportModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>
              {exportType === 'mnemonic' ? '导出助记词' : '导出私钥'}
            </ThemedText>
            <ThemedText style={styles.modalWarning}>⚠️ 请确保周围环境安全，防止泄露</ThemedText>
            <TextInput
              style={styles.modalInput}
              placeholder="输入支付密码"
              placeholderTextColor="#6B7280"
              value={modalPassword}
              onChangeText={setModalPassword}
              secureTextEntry
            />
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => { setShowExportModal(false); setModalPassword(''); }}
              >
                <ThemedText style={styles.modalCancelBtnText}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmBtn}
                onPress={handleExport}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <ThemedText style={styles.modalConfirmBtnText}>导出</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Result Modal */}
      <Modal visible={showResultModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>
              {exportedMnemonic ? '助记词' : '私钥'}
            </ThemedText>
            <ThemedText style={styles.modalWarning}>⚠️ 请务必备份，丢失将无法恢复！</ThemedText>
            <View style={styles.resultBox}>
              <ThemedText style={styles.resultLabel}>
                {exportedMnemonic ? '助记词' : '私钥'}
              </ThemedText>
              <ThemedText style={styles.resultText}>
                {exportedMnemonic || exportedPrivateKey}
              </ThemedText>
            </View>
            <TouchableOpacity style={styles.modalConfirmBtn} onPress={closeResultModal}>
              <ThemedText style={styles.modalConfirmBtnText}>我已备份</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

// 导入 Spacing 常量用于内联样式
import { Spacing } from '@/constants/theme';
