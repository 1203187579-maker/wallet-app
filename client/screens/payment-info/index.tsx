import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { 
  ScrollView, 
  View, 
  TouchableOpacity, 
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createFormDataFile } from '@/utils';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { getBaseUrl } from '@/services/api';
import { createStyles } from './styles';
import { alert } from '@/utils/alert';

// 支付类型基础配置
const PAYMENT_TYPES_BASE = [
  { type: 'alipay', icon: 'alipay', iconColor: '#1677FF', bgColor: 'rgba(22, 119, 255, 0.1)' },
  { type: 'wechat', icon: 'weixin', iconColor: '#07C160', bgColor: 'rgba(7, 193, 96, 0.1)' },
  { type: 'usdt_bsc', icon: 'bitcoin-sign', iconColor: '#F7931A', bgColor: 'rgba(247, 147, 26, 0.1)' },
] as const;

interface PaymentInfo {
  id: string;
  user_id: string;
  payment_type: string;
  account_info: string;
  account_name?: string;
  phone?: string;
  qrcode_url?: string;
  is_default: boolean;
  created_at: string;
}

export default function PaymentInfoScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { user, isLoading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentInfoList, setPaymentInfoList] = useState<PaymentInfo[]>([]);
  const [availablePaymentTypes, setAvailablePaymentTypes] = useState<string[]>(['alipay', 'wechat', 'usdt_bsc']);
  
  const [email, setEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailEditing, setEmailEditing] = useState(false);
  
  const [editingType, setEditingType] = useState<string | null>(null);
  const [accountInfo, setAccountInfo] = useState('');
  const [accountName, setAccountName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [qrcodeUrl, setQrcodeUrl] = useState<string | null>(null);

  // 获取支付类型的标签
  const getPaymentLabel = (type: string) => {
    switch (type) {
      case 'alipay': return t('paymentInfo.alipay');
      case 'wechat': return t('paymentInfo.wechat');
      case 'usdt_bsc': return t('paymentInfo.usdtBsc');
      default: return type;
    }
  };

  // 获取支付类型的占位符
  const getPaymentPlaceholder = (type: string) => {
    switch (type) {
      case 'alipay': return t('paymentInfo.inputPlaceholder.alipay');
      case 'wechat': return t('paymentInfo.inputPlaceholder.wechat');
      case 'usdt_bsc': return t('paymentInfo.inputPlaceholder.usdtBsc');
      default: return '';
    }
  };

  // 获取支付类型的提示
  const getPaymentHint = (type: string) => {
    switch (type) {
      case 'alipay': return t('paymentInfo.hint.alipay');
      case 'wechat': return t('paymentInfo.hint.wechat');
      case 'usdt_bsc': return t('paymentInfo.hint.usdtBsc');
      default: return '';
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user]);

  const loadPaymentInfo = useCallback(async () => {
    if (!user) return;
    
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${getBaseUrl()}/api/v1/payment-info`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      const data = await response.json();
      if (data.success && data.data) {
        setPaymentInfoList(data.data.payment_info || []);
        setEmail(data.data.email || '');
        if (data.data.available_payment_types) {
          setAvailablePaymentTypes(data.data.available_payment_types);
        }
      }
    } catch (error) {
      console.error('Load payment info error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadPaymentInfo();
    }, [loadPaymentInfo])
  );

  const handleSaveEmail = async () => {
    if (!email.trim()) {
      alert(t('common.info'), t('paymentInfo.setEmail'));
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      alert(t('common.info'), t('auth.invalidEmail'));
      return;
    }
    
    try {
      setEmailSaving(true);
      const token = await AsyncStorage.getItem('auth_token');
      
      const response = await fetch(`${getBaseUrl()}/api/v1/payment-info/email`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      });
      
      const data = await response.json();
      if (data.success) {
        alert(t('common.success'), t('paymentInfo.saveSuccess'));
        setEmailEditing(false);
        loadPaymentInfo();
      } else {
        alert(t('paymentInfo.saveFailed'), data.error || t('common.networkError'));
      }
    } catch (error) {
      console.error('Save email error:', error);
      alert(t('paymentInfo.saveFailed'), t('common.networkError'));
    } finally {
      setEmailSaving(false);
    }
  };

  const startEdit = (type: string) => {
    const existing = paymentInfoList.find(p => p.payment_type === type);
    setEditingType(type);
    setAccountInfo(existing?.account_info || '');
    setAccountName(existing?.account_name || '');
    setPhoneNumber(existing?.phone || '');
    setQrcodeUrl(existing?.qrcode_url || null);
  };

  const cancelEdit = () => {
    setEditingType(null);
    setAccountInfo('');
    setAccountName('');
    setPhoneNumber('');
    setQrcodeUrl(null);
  };

  const handlePickQRCode = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      try {
        const formData = new FormData();
        const file = await createFormDataFile(uri, 'qrcode.jpg', 'image/jpeg');
        formData.append('file', file as any);
        
        const response = await fetch(`${getBaseUrl()}/api/v1/upload`, {
          method: 'POST',
          body: formData,
        });
        
        const data = await response.json();
        if (data.success && data.url) {
          setQrcodeUrl(data.url);
        } else {
          alert(t('paymentInfo.saveFailed'), data.message || t('common.networkError'));
        }
      } catch (error) {
        console.error('Upload QR code error:', error);
        alert(t('paymentInfo.saveFailed'), t('common.networkError'));
      }
    }
  };

  const handleSave = async (paymentType: string) => {
    if (!accountInfo.trim()) {
      alert(t('common.info'), t('paymentInfo.accountInfo'));
      return;
    }
    
    if (!phoneNumber.trim()) {
      alert(t('common.info'), t('paymentInfo.phone'));
      return;
    }
    
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();
      
      const response = await fetch(`${baseUrl}/api/v1/payment-info`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_type: paymentType,
          account_info: accountInfo.trim(),
          account_name: accountName.trim() || undefined,
          phone: phoneNumber.trim() || undefined,
          qrcode_url: qrcodeUrl || undefined,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(t('common.success'), t('paymentInfo.saveSuccess'));
        cancelEdit();
        loadPaymentInfo();
      } else {
        alert(t('paymentInfo.saveFailed'), data.error || data.message || t('common.networkError'));
      }
    } catch (error) {
      console.error('Save payment info error:', error);
      alert(t('paymentInfo.saveFailed'), t('common.networkError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (paymentType: string) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      
      const response = await fetch(`${getBaseUrl()}/api/v1/payment-info/${paymentType}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      const data = await response.json();
      if (data.success) {
        alert(t('common.success'), t('paymentInfo.deleteSuccess'));
        cancelEdit();
        loadPaymentInfo();
      } else {
        alert(t('paymentInfo.deleteFailed'), data.error || t('common.networkError'));
      }
    } catch (error) {
      console.error('Delete payment info error:', error);
      alert(t('paymentInfo.deleteFailed'), t('common.networkError'));
    }
  };

  if (authLoading || loading) {
    return (
      <Screen backgroundColor="#0D0D0D" statusBarStyle="light">
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
    <Screen backgroundColor="#0D0D0D" statusBarStyle="light">
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText variant="h2" style={styles.headerTitle}>
            {t('paymentInfo.title')}
          </ThemedText>
          <ThemedText variant="caption" style={styles.headerSubtitle}>
            {t('paymentInfo.subtitle')}
          </ThemedText>
        </View>

        {/* 邮箱设置 */}
        <View style={[styles.paymentCard, { borderLeftWidth: 4, borderLeftColor: '#F59E0B' }]}>
          <View style={styles.paymentHeader}>
            <View style={styles.paymentHeaderLeft}>
              <View style={[styles.paymentIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <FontAwesome6 name="envelope" size={18} color="#F59E0B" />
              </View>
              <View>
                <ThemedText variant="smallMedium" style={styles.paymentTitle}>
                  {t('paymentInfo.emailNotify')}
                </ThemedText>
                <ThemedText variant="tiny" style={{ color: '#F59E0B', marginTop: 2 }}>
                  ⚠️ {t('paymentInfo.emailRequired')}
                </ThemedText>
              </View>
            </View>
            {email && !emailEditing && (
              <View style={styles.paymentStatus}>
                <FontAwesome6 name="check-circle" size={14} color="#22C55E" />
                <ThemedText variant="caption" style={styles.paymentStatusText}>
                  {t('paymentInfo.emailBound')}
                </ThemedText>
              </View>
            )}
          </View>

          {emailEditing ? (
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder={t('paymentInfo.setEmail')}
                placeholderTextColor="#6B7280"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <View style={[styles.buttonGroup, { marginTop: 12 }]}>
                <TouchableOpacity 
                  style={styles.saveBtn}
                  onPress={handleSaveEmail}
                  disabled={emailSaving}
                >
                  {emailSaving ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <ThemedText variant="smallMedium" style={styles.saveBtnText}>
                      {t('common.save')}
                    </ThemedText>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.deleteBtn, { backgroundColor: '#4B5563' }]}
                  onPress={() => {
                    setEmailEditing(false);
                    loadPaymentInfo();
                  }}
                >
                  <FontAwesome6 name="times" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}
              onPress={() => setEmailEditing(true)}
            >
              {email ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <FontAwesome6 name="at" size={12} color="#6B7280" />
                  <ThemedText variant="small" style={{ color: '#9CA3AF', marginLeft: 8 }}>
                    {email}
                  </ThemedText>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <FontAwesome6 name="exclamation-circle" size={14} color="#EF4444" />
                  <ThemedText variant="small" style={{ color: '#EF4444', marginLeft: 8 }}>
                    {t('paymentInfo.emailUnbound')}
                  </ThemedText>
                </View>
              )}
              <FontAwesome6 name="chevron-right" size={12} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>

        {/* Payment Types */}
        {PAYMENT_TYPES_BASE
          .filter(config => availablePaymentTypes.includes(config.type))
          .map((config) => {
          const existingInfo = paymentInfoList.find(p => p.payment_type === config.type);
          const isEditing = editingType === config.type;
          
          return (
            <TouchableOpacity 
              key={config.type}
              style={[styles.paymentCard, existingInfo && styles.paymentCardActive]}
              onPress={() => !isEditing && startEdit(config.type)}
              activeOpacity={0.7}
              disabled={isEditing}
            >
              <View style={styles.paymentHeader}>
                <View style={styles.paymentHeaderLeft}>
                  <View style={[styles.paymentIcon, { backgroundColor: config.bgColor }]}>
                    <FontAwesome6 name={config.icon as any} size={18} color={config.iconColor} />
                  </View>
                  <ThemedText variant="smallMedium" style={styles.paymentTitle}>
                    {getPaymentLabel(config.type)}
                  </ThemedText>
                </View>
                {existingInfo && !isEditing && (
                  <View style={styles.paymentStatus}>
                    <FontAwesome6 name="check-circle" size={14} color="#22C55E" />
                    <ThemedText variant="caption" style={styles.paymentStatusText}>
                      {t('paymentInfo.emailBound')}
                    </ThemedText>
                  </View>
                )}
              </View>

              {isEditing ? (
                <>
                  <View style={styles.inputContainer}>
                    <ThemedText variant="caption" style={styles.inputLabel}>
                      {t('paymentInfo.accountInfo')}
                    </ThemedText>
                    <TextInput
                      style={styles.input}
                      value={accountInfo}
                      onChangeText={setAccountInfo}
                      placeholder={getPaymentPlaceholder(config.type)}
                      placeholderTextColor="#6B7280"
                    />
                    <ThemedText variant="tiny" style={styles.inputHint}>
                      {getPaymentHint(config.type)}
                    </ThemedText>
                  </View>

                  <View style={styles.inputContainer}>
                    <ThemedText variant="caption" style={styles.inputLabel}>
                      {t('paymentInfo.accountName')}
                    </ThemedText>
                    <TextInput
                      style={styles.input}
                      value={accountName}
                      onChangeText={setAccountName}
                      placeholder={t('paymentInfo.accountNamePlaceholder')}
                      placeholderTextColor="#6B7280"
                    />
                  </View>

                  <View style={styles.inputContainerNoLabel}>
                    <TextInput
                      style={styles.input}
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      placeholder={t('paymentInfo.phone')}
                      placeholderTextColor="#6B7280"
                      keyboardType="phone-pad"
                    />
                  </View>

                  <View style={styles.qrcodeSection}>
                    <ThemedText variant="caption" style={styles.qrcodeLabel}>
                      {t('paymentInfo.qrcode')}
                    </ThemedText>
                    {qrcodeUrl ? (
                      <View style={styles.qrcodePreview}>
                        <Image source={{ uri: qrcodeUrl }} style={styles.qrcodeImage} />
                        <TouchableOpacity 
                          style={styles.qrcodeRemoveBtn}
                          onPress={() => setQrcodeUrl(null)}
                        >
                          <FontAwesome6 name="times" size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.qrcodeUploadBtn} onPress={handlePickQRCode}>
                        <FontAwesome6 name="qrcode" size={24} color="#6B7280" />
                        <ThemedText variant="caption" style={{ color: '#6B7280', marginTop: 8 }}>
                          {t('paymentInfo.uploadQrcode')}
                        </ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.buttonGroup}>
                    <TouchableOpacity 
                      style={styles.saveBtn}
                      onPress={() => handleSave(config.type)}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#000000" />
                      ) : (
                        <ThemedText variant="smallMedium" style={styles.saveBtnText}>
                          {t('common.save')}
                        </ThemedText>
                      )}
                    </TouchableOpacity>
                    {existingInfo && (
                      <TouchableOpacity 
                        style={styles.deleteBtn}
                        onPress={() => handleDelete(config.type)}
                      >
                        <FontAwesome6 name="trash" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                      style={[styles.deleteBtn, { backgroundColor: '#4B5563' }]}
                      onPress={cancelEdit}
                    >
                      <FontAwesome6 name="times" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  {existingInfo ? (
                    <View>
                      <View style={styles.existingInfoRow}>
                        <FontAwesome6 name="copy" size={12} color="#6B7280" />
                        <ThemedText variant="small" style={{ color: '#9CA3AF', marginLeft: 8 }}>
                          {existingInfo.account_info}
                          {existingInfo.account_name && ` (${existingInfo.account_name})`}
                        </ThemedText>
                      </View>
                      {existingInfo.phone && (
                        <View style={[styles.existingInfoRow, { marginTop: 8 }]}>
                          <FontAwesome6 name="phone" size={12} color="#6B7280" />
                          <ThemedText variant="small" style={{ color: '#9CA3AF', marginLeft: 8 }}>
                            {existingInfo.phone}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.emptyInfoRow}>
                      <FontAwesome6 name="plus-circle" size={14} color="#F59E0B" />
                      <ThemedText variant="small" style={{ color: '#F59E0B', marginLeft: 8 }}>
                        {t('paymentInfo.setPayment')}
                      </ThemedText>
                    </View>
                  )}
                  <View style={styles.clickHint}>
                    <FontAwesome6 name="chevron-right" size={12} color="#6B7280" />
                  </View>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
