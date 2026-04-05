import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { 
  ScrollView, 
  View, 
  TouchableOpacity, 
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, useTranslationState } from '@/hooks/useTranslation';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { getBaseUrl, assetApi, walletApi } from '@/services/api';
import { createStyles } from './styles';
import { confirm, alert } from '@/utils/alert';
import { languageNames, supportedLanguages } from '@/i18n';

type KYCStatusType = 'none' | 'pending' | 'approved' | 'rejected';

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { locale, setLocale } = useTranslationState();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { user, referralStats, isLoading: authLoading, logout, refreshUser, wallet: authWallet } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [kycStatus, setKycStatus] = useState<KYCStatusType>('none');
  const [langModalVisible, setLangModalVisible] = useState(false);
  
  // 资产数据
  const [totalValueUsd, setTotalValueUsd] = useState<string>('');
  const [walletAddress, setWalletAddress] = useState<string>('');

  // 菜单项（删除设置）
  const MENU_ITEMS = [
    { icon: 'money-bill-transfer', label: t('profile.bindPhone'), route: '/payment-info' },
    { icon: 'book-open', label: t('profile.help'), route: '/education' },
    { icon: 'clock-rotate-left', label: t('assets.history'), route: '/transactions' },
    { icon: 'users', label: t('profile.myTeam'), route: '/team' },
    { icon: 'gift', label: t('profile.referralRewards'), route: '/rewards' },
    { icon: 'headset', label: t('profile.help'), route: '/support' },
  ];

  // 语言选项
  const languageOptions = supportedLanguages.map(lang => ({
    code: lang,
    name: languageNames[lang]?.nativeName || lang,
    englishName: languageNames[lang]?.englishName || lang,
  }));

  const handleLanguageSelect = async (lang: string) => {
    await setLocale(lang);
    setLangModalVisible(false);
  };

  // 如果未登录，跳转到登录页
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user]);

  // 获取KYC状态
  const fetchKYCStatus = useCallback(async () => {
    if (!user) return;
    
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();
      
      const response = await fetch(`${baseUrl}/api/v1/kyc/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      const data = await response.json();
      if (data.success && data.data) {
        setKycStatus(data.data.status || 'none');
      }
    } catch (error) {
      console.error('Fetch KYC status error:', error);
    }
  }, [user]);

  // 加载资产数据
  const loadAssetData = useCallback(async () => {
    if (!user) return;
    
    try {
      const [assetsResult, walletsResult] = await Promise.all([
        assetApi.getList(),
        walletApi.getList(),
      ]);

      if (assetsResult.success && assetsResult.data) {
        setTotalValueUsd(assetsResult.data.total_value_usd || '0');
      }
      if (walletsResult.success && walletsResult.data && walletsResult.data.wallets && walletsResult.data.wallets.length > 0) {
        const addr = walletsResult.data.wallets[0].address;
        setWalletAddress(`${addr.slice(0, 6)}...${addr.slice(-4)}`);
      } else if (authWallet) {
        const addr = authWallet.address;
        setWalletAddress(`${addr.slice(0, 6)}...${addr.slice(-4)}`);
      }
    } catch (error) {
      console.error('Load asset data error:', error);
    }
  }, [user, authWallet]);

  // 计算总资产
  const totalBalance = useMemo(() => {
    const value = parseFloat(totalValueUsd);
    return isNaN(value) ? 0 : value;
  }, [totalValueUsd]);

  // 页面聚焦时刷新数据
  useFocusEffect(
    useCallback(() => {
      fetchKYCStatus();
      loadAssetData();
    }, [fetchKYCStatus, loadAssetData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refreshUser(),
      fetchKYCStatus(),
      loadAssetData(),
    ]);
    setRefreshing(false);
  };

  const handleKYC = () => {
    if (kycStatus === 'pending') {
      alert(t('common.notice'), t('kyc.underReview'));
    } else {
      router.push('/kyc');
    }
  };

  // 获取KYC状态显示信息
  const getKYCStatusInfo = () => {
    switch (kycStatus) {
      case 'approved':
        return { icon: 'shield-check', color: '#22C55E', text: t('kyc.statusApproved') };
      case 'pending':
        return { icon: 'clock', color: '#F59E0B', text: t('kyc.statusPending') };
      case 'rejected':
        return { icon: 'shield-xmark', color: '#EF4444', text: t('kyc.statusRejected') };
      default:
        return { icon: 'shield-halved', color: '#F59E0B', text: t('kyc.statusNone') };
    }
  };

  const kycInfo = getKYCStatusInfo();

  const handleLogout = () => {
    confirm(
      t('profile.logout'),
      t('profile.logoutConfirm'),
      async () => {
        await logout();
        router.replace('/login');
      },
      undefined,
      t('common.confirm'),
      t('common.cancel'),
      true
    );
  };

  const handleMenuPress = (route: string) => {
    router.push(route as any);
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

  if (!user) {
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
        {/* Header with Language Selector */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity 
            style={styles.langButton}
            onPress={() => setLangModalVisible(true)}
          >
            <FontAwesome6 name="globe" size={18} color="#F59E0B" />
            <ThemedText variant="small" style={styles.langText}>
              {languageNames[locale]?.nativeName || locale}
            </ThemedText>
            <FontAwesome6 name="chevron-down" size={10} color="#F59E0B" />
          </TouchableOpacity>
        </View>

        {/* Asset Card - Orange Background */}
        <TouchableOpacity 
          style={styles.assetCard}
          onPress={() => router.push('/wallet')}
          activeOpacity={0.8}
        >
          <View style={styles.assetCardHeader}>
            <ThemedText variant="label" style={styles.totalAssetLabel}>
              {t('home.totalAssets')}
            </ThemedText>
            <View style={styles.chainTag}>
              <View style={styles.chainDot} />
              <ThemedText variant="captionMedium" style={styles.chainText}>
                BoostAra
              </ThemedText>
            </View>
          </View>
          <ThemedText variant="statLarge" style={styles.totalBalance}>
            ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </ThemedText>
          <View style={styles.walletAddress}>
            <ThemedText variant="small" style={styles.walletAddressText}>
              {walletAddress || '0x1234...5678'}
            </ThemedText>
            <FontAwesome6 name="chevron-right" size={14} color="rgba(0,0,0,0.6)" />
          </View>
        </TouchableOpacity>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <ThemedText variant="smallMedium" style={styles.statsTitle}>
            {t('profile.referralStats')}
          </ThemedText>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <ThemedText variant="stat" style={styles.statValue}>
                {referralStats?.direct_count || 0}
              </ThemedText>
              <ThemedText variant="caption" style={styles.statLabel}>
                {t('profile.directCount')}
              </ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText variant="stat" style={styles.statValue}>
                {referralStats?.team_count || 0}
              </ThemedText>
              <ThemedText variant="caption" style={styles.statLabel}>
                {t('profile.teamCount')}
              </ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText variant="stat" style={[styles.statValue, { color: '#10B981' }]}>
                {referralStats?.total_reward || '0'}
              </ThemedText>
              <ThemedText variant="caption" style={styles.statLabel}>
                {t('profile.totalEarnings')}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* KYC Status */}
        <View style={styles.menuSection}>
          <ThemedText variant="caption" style={styles.sectionTitle}>
            {t('profile.authStatus')}
          </ThemedText>
          <TouchableOpacity style={styles.menuItem} onPress={handleKYC}>
            <View style={styles.menuIcon}>
              <FontAwesome6 
                name={kycInfo.icon as any} 
                size={18} 
                color={kycInfo.color} 
              />
            </View>
            <ThemedText variant="smallMedium" style={styles.menuText}>
              {t('kyc.title')}
            </ThemedText>
            <View style={[styles.kycBadge, kycStatus === 'pending' && styles.kycBadgePending, kycStatus === 'rejected' && styles.kycBadgeRejected]}>
              <FontAwesome6 
                name={kycInfo.icon as any}
                size={10} 
                color={kycInfo.color} 
              />
              <ThemedText 
                variant="tiny" 
                style={[styles.kycBadgeText, kycStatus === 'pending' && styles.kycBadgeTextPending]}
              >
                {kycInfo.text}
              </ThemedText>
            </View>
          </TouchableOpacity>
        </View>

        {/* Menu Section */}
        <View style={styles.menuSection}>
          <ThemedText variant="caption" style={styles.sectionTitle}>
            功能菜单
          </ThemedText>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity 
              key={item.route} 
              style={styles.menuItem}
              onPress={() => handleMenuPress(item.route)}
            >
              <View style={styles.menuIcon}>
                <FontAwesome6 name={item.icon as any} size={18} color="#F59E0B" />
              </View>
              <ThemedText variant="smallMedium" style={styles.menuText}>
                {item.label}
              </ThemedText>
              <FontAwesome6 name="chevron-right" size={14} color="#6B7280" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <ThemedText variant="smallMedium" style={styles.logoutButtonText}>
            退出登录
          </ThemedText>
        </TouchableOpacity>
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={langModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLangModalVisible(false)}
        >
          <View style={styles.langModal}>
            <ThemedText variant="smallMedium" style={styles.langModalTitle}>
              {t('language.title')}
            </ThemedText>
            {languageOptions.map((option) => (
              <TouchableOpacity
                key={option.code}
                style={[
                  styles.langOption,
                  locale === option.code && styles.langOptionActive,
                ]}
                onPress={() => handleLanguageSelect(option.code)}
              >
                <View style={styles.langOptionLeft}>
                  <FontAwesome6 
                    name={option.code === 'zh-CN' ? 'language' : 'globe'} 
                    size={18} 
                    color={locale === option.code ? '#F59E0B' : '#9CA3AF'} 
                  />
                  <View>
                    <ThemedText 
                      variant="smallMedium" 
                      style={[
                        styles.langOptionText,
                        locale === option.code && styles.langOptionTextActive,
                      ]}
                    >
                      {option.name}
                    </ThemedText>
                    <ThemedText variant="tiny" style={{ color: '#6B7280' }}>
                      {option.englishName}
                    </ThemedText>
                  </View>
                </View>
                {locale === option.code && (
                  <FontAwesome6 name="check" size={16} color="#F59E0B" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}
