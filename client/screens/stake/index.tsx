import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { 
  ScrollView, 
  View, 
  TouchableOpacity, 
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { stakeApi, type StakeRecord } from '@/services/api';
import { showAlert, alert, confirm } from '@/utils/alert';
import { createStyles } from './styles';
import MiningAnimation from '@/components/MiningAnimation';

interface StakeConfig {
  stake_type: string;
  daily_rate: string;
  duration_days: number | null;
  min_amount: string;
  rate_preview?: { day: number; rate: string }[];
  cycle_description?: string;
  daily_rate_display?: string; // 前端显示的日收益率范围
}

interface StakeRecordWithInfo extends StakeRecord {
  stake_days?: number;
  current_rate?: number;
  current_rate_percent?: string;
}

export default function StakeScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [configs, setConfigs] = useState<StakeConfig[]>([]);
  const [records, setRecords] = useState<StakeRecordWithInfo[]>([]);
  const [pendingRewards, setPendingRewards] = useState('0');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal 状态
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('flexible');
  const [stakeAmount, setStakeAmount] = useState('');
  const [stakePassword, setStakePassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 检查登录状态
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      const [configResult, recordsResult] = await Promise.all([
        stakeApi.getConfig(),
        stakeApi.getRecords(),
      ]);

      if (configResult.success && configResult.data) {
        setConfigs(configResult.data.configs || []);
      }
      if (recordsResult.success && recordsResult.data) {
        setRecords(recordsResult.data.stakes || []);
        setPendingRewards(recordsResult.data.total_pending_reward || '0');
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
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // 获取灵活质押的日收益率显示范围
  const getDailyRateDisplay = () => {
    const flexibleConfig = configs.find(c => c.stake_type === 'flexible');
    return flexibleConfig?.daily_rate_display || '0.5-1.5%';
  };

  const totalStaked = records
    .filter(r => r.status === 'active')
    .reduce((sum, r) => sum + parseFloat(r.amount), 0);

  const totalRewards = records
    .reduce((sum, r) => sum + parseFloat(r.total_reward), 0);

  const handleOpenStakeModal = (type: string) => {
    setSelectedType(type);
    setStakeAmount('');
    setStakePassword('');
    setShowStakeModal(true);
  };

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      showAlert(t('common.error'), t('coinDetail.invalidAmount'));
      return;
    }
    if (!stakePassword.trim()) {
      showAlert(t('common.error'), t('stake.paymentPassword'));
      return;
    }

    setSubmitting(true);
    try {
      const result = await stakeApi.stake({
        amount: stakeAmount,
        stake_type: selectedType as 'flexible' | 'fixed_180' | 'fixed_360',
        password: stakePassword,
      });

      if (result.success) {
        showAlert(t('common.success'), t('stake.stakeSuccess'));
        setShowStakeModal(false);
        loadData();
      } else {
        showAlert(t('common.error'), result.error || t('common.networkError'));
      }
    } catch (error: any) {
      showAlert(t('common.error'), error.message || t('common.networkError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaimRewards = async () => {
    if (parseFloat(pendingRewards) <= 0) {
      showAlert(t('common.info'), t('stake.noRewards'));
      return;
    }

    setSubmitting(true);
    try {
      const result = await stakeApi.claim();
      if (result.success) {
        showAlert(t('common.success'), t('stake.claimSuccess'));
        loadData();
      } else {
        showAlert(t('common.error'), result.error || t('common.networkError'));
      }
    } catch (error: any) {
      showAlert(t('common.error'), error.message || t('common.networkError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRedeem = async (recordId: string) => {
    showAlert(
      t('stake.redeem'),
      t('stake.redeemConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('common.confirm'), 
          onPress: async () => {
            try {
              const result = await stakeApi.redeem(recordId, '');
              if (result.success) {
                showAlert(t('common.success'), t('stake.redeemSuccess'));
                loadData();
              } else {
                showAlert(t('common.error'), result.error || t('common.networkError'));
              }
            } catch (error: any) {
              showAlert(t('common.error'), error.message || t('common.networkError'));
            }
          }
        }
      ]
    );
  };

  const getStakeTypeName = (type: string) => {
    switch (type) {
      case 'flexible': return t('stake.flexible');
      case 'fixed_180': return t('stake.fixed180');
      case 'fixed_360': return t('stake.fixed360');
      default: return type;
    }
  };

  const getStakeConfigRate = (type: string) => {
    const cfg = configs.find(c => c.stake_type === type);
    if (cfg?.daily_rate) {
      // daily_rate 是小数格式，需要转换为百分比显示
      const rate = parseFloat(String(cfg.daily_rate));
      return `${(rate * 100).toFixed(2)}%`;
    }
    return '0.05%';
  };

  // 显示加载状态
  if (authLoading || loading) {
    return (
      <Screen backgroundColor="#000000" statusBarStyle="light">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <ThemedText variant="caption" color={theme.textMuted} style={{ marginTop: 16 }}>
            {t('common.loading')}
          </ThemedText>
        </View>
      </Screen>
    );
  }

  // 未登录状态
  if (!isAuthenticated) {
    return null;
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
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText variant="h3" style={styles.headerTitle}>
            {t('stake.title')}
          </ThemedText>
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <ThemedText variant="stat" style={styles.statValue}>
                {totalStaked.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </ThemedText>
              <ThemedText variant="caption" style={styles.statLabel}>
                {t('stake.totalStaked')}
              </ThemedText>
            </View>
            <TouchableOpacity 
              style={styles.statItem} 
              onPress={() => router.push('/rewards')}
            >
              <ThemedText variant="stat" style={[styles.statValue, { color: '#F59E0B' }]}>
                +{totalRewards.toFixed(2)}
              </ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ThemedText variant="caption" style={styles.statLabel}>
                  {t('stake.totalRewards')}
                </ThemedText>
                <FontAwesome6 name="chevron-right" size={10} color="#6B7280" style={{ marginLeft: 4 }} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 待领取按钮 */}
        <TouchableOpacity style={styles.claimButton} onPress={handleClaimRewards}>
          <View style={styles.claimButtonContent}>
            <FontAwesome6 name="coins" size={16} color="#F59E0B" style={{ marginRight: 8 }} />
            <View style={styles.claimTextWrap}>
              <ThemedText variant="caption" style={styles.claimLabel}>
                {t('stake.pendingRewards')}
              </ThemedText>
              <ThemedText variant="smallMedium" style={styles.claimValue}>
                +{parseFloat(pendingRewards).toFixed(4)} GPU
              </ThemedText>
            </View>
          </View>
          <View style={styles.claimAction}>
            <ThemedText variant="captionMedium" style={styles.claimActionText}>
              {t('stake.claim')}
            </ThemedText>
            <FontAwesome6 name="chevron-right" size={12} color="#F59E0B" />
          </View>
        </TouchableOpacity>

        {/* 挖矿动画 */}
        <MiningAnimation 
          totalStaked={totalStaked}
          dailyReward={totalStaked * 0.005}
          isActive={totalStaked > 0}
          dailyRateDisplay={getDailyRateDisplay()}
        />

        {/* Stake Options - 根据后端配置动态显示 */}
        {/* 灵活质押 - 只有配置存在且开启时才显示 */}
        {configs.find(c => c.stake_type === 'flexible') && (
          <View style={styles.stakeCard}>
            <View style={styles.stakeCardTop}>
              <View style={styles.stakeIconGreen}>
                <FontAwesome6 name="leaf" size={18} color="#F59E0B" />
              </View>
              <View style={styles.stakeInfo}>
                <ThemedText variant="smallMedium" style={styles.stakeTitle}>
                  {t('stake.flexible')}
                </ThemedText>
              </View>
              <ThemedText variant="smallMedium" style={styles.stakeApy}>
                {t('stake.cycleIncome')}
              </ThemedText>
            </View>
            <View style={styles.stakeCardBottom}>
              <ThemedText variant="caption" style={styles.stakeAmount}>
                {t('stake.staking')}: {records.filter(r => r.stake_type === 'flexible' && r.status === 'active').reduce((s, r) => s + parseFloat(r.amount), 0).toFixed(2)} GPU
              </ThemedText>
              <TouchableOpacity 
                style={styles.stakeButton}
                onPress={() => handleOpenStakeModal('flexible')}
              >
                <ThemedText variant="captionMedium" style={styles.stakeButtonText}>
                  {t('stake.stake')}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 定期质押 - 显示所有开启的定期产品 */}
        {configs.filter(c => c.stake_type !== 'flexible').map((cfg) => (
          <View key={cfg.stake_type} style={styles.stakeCard}>
            <View style={styles.stakeCardTop}>
              <View style={styles.stakeIconOrange}>
                <FontAwesome6 name="lock" size={18} color="#F59E0B" />
              </View>
              <View style={styles.stakeInfo}>
                <ThemedText variant="smallMedium" style={styles.stakeTitle}>
                  {cfg.stake_type === 'fixed_180' ? t('stake.fixed180') : 
                   cfg.stake_type === 'fixed_360' ? t('stake.fixed360') : 
                   cfg.duration_days ? `${cfg.duration_days}天定期` : t('stake.fixed')}
                </ThemedText>
              </View>
              <ThemedText variant="smallMedium" style={styles.stakeApy}>
                ~{getStakeConfigRate(cfg.stake_type)}/天
              </ThemedText>
            </View>
            <View style={styles.stakeCardBottom}>
              <ThemedText variant="caption" style={styles.stakeAmount}>
                {t('stake.staking')}: {records.filter(r => r.stake_type === cfg.stake_type && r.status === 'active').reduce((s, r) => s + parseFloat(r.amount), 0).toFixed(2)} GPU
              </ThemedText>
              <TouchableOpacity 
                style={styles.stakeButton}
                onPress={() => handleOpenStakeModal(cfg.stake_type)}
              >
                <ThemedText variant="captionMedium" style={styles.stakeButtonText}>
                  {t('stake.stake')}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* My Records */}
        <View style={styles.sectionHeader}>
          <ThemedText variant="title" style={styles.sectionTitle}>
            {t('stake.myStakes')}
          </ThemedText>
          {parseFloat(pendingRewards) > 0 && (
            <TouchableOpacity onPress={handleClaimRewards}>
              <ThemedText variant="smallMedium" style={styles.sectionAction}>
                {t('stake.claim')}
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {records.length > 0 ? records.map((record) => (
          <View key={record.id} style={styles.recordCard}>
            <View style={styles.recordRow}>
              <View style={styles.recordLeft}>
                <ThemedText variant="smallMedium" style={styles.recordType}>
                  {getStakeTypeName(record.stake_type)}
                </ThemedText>
                <ThemedText variant="caption" style={styles.recordDate}>
                  {new Date(record.start_date).toLocaleDateString()}
                </ThemedText>
              </View>
              <View style={styles.recordRight}>
                <ThemedText variant="bodyMedium" style={styles.recordAmount}>
                  {parseFloat(record.amount).toFixed(2)} GPU
                </ThemedText>
                {record.status === 'active' && record.current_rate_percent ? (
                  <ThemedText variant="caption" style={styles.recordReward}>
                    {t('stake.stakeDays')}{record.stake_days}天 · {record.current_rate_percent}%/天
                  </ThemedText>
                ) : (
                  <ThemedText variant="caption" style={styles.recordReward}>
                    +{parseFloat(record.total_reward || '0').toFixed(2)}
                  </ThemedText>
                )}
              </View>
            </View>
            {record.status === 'active' && record.stake_type === 'flexible' && (
              <TouchableOpacity 
                style={{ marginTop: 12, alignItems: 'flex-end' }}
                onPress={() => handleRedeem(record.id)}
              >
                <ThemedText variant="captionMedium" color="#F59E0B">
                  {t('stake.redeem')}
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        )) : (
          <View style={styles.emptyState}>
            <FontAwesome6 name="coins" size={40} color="#6B7280" />
            <ThemedText variant="small" style={styles.emptyText}>
              {t('stake.noStakes')}
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {/* Stake Modal */}
      <Modal visible={showStakeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText variant="title" style={styles.modalTitle}>
                {getStakeTypeName(selectedType)}
              </ThemedText>
              <TouchableOpacity onPress={() => setShowStakeModal(false)}>
                <ThemedText style={styles.modalClose}>✕</ThemedText>
              </TouchableOpacity>
            </View>

            {/* 灵活质押收益说明 */}
            {selectedType === 'flexible' && (
              <View style={{ backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <ThemedText variant="captionMedium" style={{ color: '#F59E0B', marginBottom: 8 }}>
                  📈 {t('stake.cycleIncome')}
                </ThemedText>
                <ThemedText variant="caption" style={{ color: '#9CA3AF', lineHeight: 18 }}>
                  每10天一个周期：{'\n'}
                  第1天 0.6% → 第2天 0.7% → ... → 第10天 1.5%{'\n'}
                  第11天重新从0.6%开始循环
                </ThemedText>
              </View>
            )}

            <ThemedText variant="caption" style={styles.inputLabel}>
              {t('stake.stakeAmount')} (GPU)
            </ThemedText>
            <TextInput
              style={styles.input}
              placeholder={t('coinDetail.enterAmount')}
              placeholderTextColor="#6B7280"
              value={stakeAmount}
              onChangeText={setStakeAmount}
              keyboardType="decimal-pad"
            />

            <ThemedText variant="caption" style={styles.inputLabel}>
              {t('stake.paymentPassword')}
            </ThemedText>
            <TextInput
              style={styles.input}
              placeholder={t('stake.paymentPassword')}
              placeholderTextColor="#6B7280"
              value={stakePassword}
              onChangeText={setStakePassword}
              secureTextEntry
            />

            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleStake}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <ThemedText variant="smallMedium" style={styles.submitButtonText}>
                  {t('stake.confirmStake')}
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
