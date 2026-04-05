import React, { useMemo, useState, useCallback } from 'react';
import { 
  View, 
  TouchableOpacity, 
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { walletApi, assetApi, type Wallet, type Transaction } from '@/services/api';
import { showAlert } from '@/utils/alert';
import { createStyles } from './styles';

export default function ReceiveScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [walletResult, txResult] = await Promise.all([
        walletApi.getList(),
        assetApi.getTransactions({ type: 'transfer' }),
      ]);

      if (walletResult.success && walletResult.data && walletResult.data.wallets.length > 0) {
        setWallet(walletResult.data.wallets[0]);
      }
      if (txResult.success && txResult.data) {
        // 只显示转入记录（金额为正）
        const receiveRecords = txResult.data.transactions.filter(tx => 
          parseFloat(tx.amount) > 0
        );
        setTransactions(receiveRecords);
      }
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleCopyAddress = () => {
    if (wallet?.address) {
      showAlert('复制成功', `地址已复制: ${wallet.address}`);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatAddress = (address: string) => {
    if (!address) return '-';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <Screen backgroundColor="#000000" statusBarStyle="light">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      </Screen>
    );
  }

  if (!wallet) {
    return (
      <Screen backgroundColor="#000000" statusBarStyle="light">
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FontAwesome6 name="wallet" size={32} color="#F59E0B" />
          </View>
          <ThemedText style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
            请先创建钱包
          </ThemedText>
          <ThemedText style={{ color: '#6B7280', fontSize: 14 }}>
            创建钱包后即可收款
          </ThemedText>
          <TouchableOpacity 
            style={styles.createBtn}
            onPress={() => router.push('/wallet')}
          >
            <ThemedText style={styles.createBtnText}>去创建钱包</ThemedText>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor="#000000" statusBarStyle="light">
      <ScrollView 
        style={styles.container}
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>接收</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {/* QR Code */}
        <View style={styles.qrContainer}>
          <View style={styles.qrPlaceholder}>
            <FontAwesome6 name="qrcode" size={100} color="#F59E0B" />
          </View>
          <ThemedText style={styles.qrHint}>扫描二维码收款</ThemedText>
        </View>

        {/* Address Card */}
        <View style={styles.addressCard}>
          <ThemedText style={styles.addressLabel}>钱包地址</ThemedText>
          <View style={styles.addressRow}>
            <ThemedText style={styles.addressText}>
              {wallet.address}
            </ThemedText>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopyAddress}>
              <FontAwesome6 name="copy" size={16} color="#F59E0B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tips */}
        <View style={styles.tipsCard}>
          <View style={styles.tipHeader}>
            <FontAwesome6 name="circle-info" size={14} color="#F59E0B" />
            <ThemedText style={styles.tipTitle}>温馨提示</ThemedText>
          </View>
          <ThemedText style={styles.tipText}>
            • 请确认收款地址正确后再进行转账{'\n'}
            • 转账到错误地址可能导致资产丢失{'\n'}
            • 不同链上的代币地址可能不同
          </ThemedText>
        </View>

        {/* Transaction Records */}
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>接收记录</ThemedText>
        </View>

        <View style={styles.recordList}>
          {transactions.length > 0 ? (
            transactions.slice(0, 5).map((tx) => (
              <View key={tx.id} style={styles.recordItem}>
                <View style={styles.recordHeader}>
                  <View style={styles.recordType}>
                    <View style={styles.recordIcon}>
                      <FontAwesome6 name="arrow-down" size={14} color="#22C55E" />
                    </View>
                    <ThemedText style={styles.recordTitle}>接收</ThemedText>
                  </View>
                  <ThemedText style={styles.recordAmount}>
                    +{tx.amount} {tx.token_symbol}
                  </ThemedText>
                </View>
                <View style={styles.recordInfo}>
                  <ThemedText style={styles.recordAddress}>
                    发送: {formatAddress(tx.from_address || '')}
                  </ThemedText>
                  <View style={styles.recordStatus}>
                    <ThemedText style={styles.recordStatusText}>已完成</ThemedText>
                  </View>
                </View>
                <ThemedText style={[styles.recordTime, { marginTop: 4 }]}>
                  {formatTime(tx.created_at)}
                </ThemedText>
              </View>
            ))
          ) : (
            <View style={styles.emptyRecords}>
              <FontAwesome6 name="arrow-down" size={24} color="#6B7280" />
              <ThemedText style={styles.emptyRecordsText}>暂无接收记录</ThemedText>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
