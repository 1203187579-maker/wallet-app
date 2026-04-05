import React, { useMemo, useState, useCallback } from 'react';
import { 
  View, 
  TouchableOpacity, 
  TextInput,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { assetApi, type Asset, type Transaction } from '@/services/api';
import { showAlert } from '@/utils/alert';
import { createStyles } from './styles';

const TOKENS = ['USDT', 'BTC', 'ETH', 'AI'];

export default function SendScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState('USDT');
  const [password, setPassword] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [assetsResult, txResult] = await Promise.all([
        assetApi.getList(),
        assetApi.getTransactions({ type: 'transfer' }),
      ]);

      if (assetsResult.success && assetsResult.data) {
        setAssets(assetsResult.data.assets);
      }
      if (txResult.success && txResult.data) {
        // 只显示转出记录（金额为负）
        const sendRecords = txResult.data.transactions.filter(tx => 
          parseFloat(tx.amount) < 0
        );
        setTransactions(sendRecords);
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

  const currentAsset = assets.find(a => a.token_symbol === selectedToken);
  const balance = currentAsset ? parseFloat(currentAsset.balance) : 0;

  const handleSend = async () => {
    if (!toAddress.trim()) {
      showAlert('错误', '请输入收款地址');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      showAlert('错误', '请输入有效金额');
      return;
    }
    if (parseFloat(amount) > balance) {
      showAlert('错误', '余额不足');
      return;
    }
    if (!password.trim()) {
      showAlert('错误', '请输入支付密码');
      return;
    }

    setSubmitting(true);
    try {
      const result = await assetApi.transfer({
        to_address: toAddress,
        amount: amount,
        token_symbol: selectedToken,
        password: password,
      });

      if (result.success) {
        showAlert('成功', '转账已提交', [
          { text: '确定', onPress: () => {
            setToAddress('');
            setAmount('');
            setPassword('');
            loadData();
          }}
        ]);
      } else {
        showAlert('转账失败', result.error || '请稍后重试');
      }
    } catch (error: any) {
      showAlert('转账失败', error.message || '网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMax = () => {
    if (currentAsset) {
      setAmount(currentAsset.balance);
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

  return (
    <Screen backgroundColor="#000000" statusBarStyle="light">
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
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
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>发送</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {/* Token Selector */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>选择代币</ThemedText>
          <View style={styles.tokenSelector}>
            {TOKENS.map((token) => {
              const asset = assets.find(a => a.token_symbol === token);
              const isSelected = selectedToken === token;
              if (!asset) return null;
              
              return (
                <TouchableOpacity
                  key={token}
                  style={[styles.tokenBtn, isSelected && styles.tokenBtnActive]}
                  onPress={() => setSelectedToken(token)}
                >
                  <FontAwesome6 
                    name={
                      token === 'BTC' ? 'bitcoin' : 
                      token === 'ETH' ? 'ethereum' : 
                      token === 'AI' ? 'robot' :
                      'coins'
                    } 
                    size={14} 
                    color={isSelected ? '#000000' : '#F59E0B'} 
                  />
                  <ThemedText style={isSelected ? styles.tokenBtnTextActive : styles.tokenBtnText}>
                    {token}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <ThemedText style={styles.balanceLabel}>可用余额</ThemedText>
            <ThemedText style={styles.balanceValue}>
              {balance.toFixed(4)} {selectedToken}
            </ThemedText>
          </View>
        </View>

        {/* Address Input */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>收款地址</ThemedText>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="输入或粘贴钱包地址"
              placeholderTextColor="#6B7280"
              value={toAddress}
              onChangeText={setToAddress}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.scanBtn}>
              <FontAwesome6 name="qrcode" size={18} color="#F59E0B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Amount Input */}
        <View style={styles.section}>
          <View style={styles.amountHeader}>
            <ThemedText style={styles.sectionLabel}>转账金额</ThemedText>
            <TouchableOpacity onPress={handleMax}>
              <ThemedText style={styles.maxBtn}>全部</ThemedText>
            </TouchableOpacity>
          </View>
          <View style={styles.amountWrapper}>
            <TextInput
              style={styles.amountInput}
              placeholder="0.0000"
              placeholderTextColor="#6B7280"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <ThemedText style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
              {selectedToken}
            </ThemedText>
          </View>
        </View>

        {/* Password Input */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>支付密码</ThemedText>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="输入支付密码"
              placeholderTextColor="#6B7280"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>
        </View>

        {/* Transaction Records */}
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>发送记录</ThemedText>
        </View>

        <View style={styles.recordList}>
          {transactions.length > 0 ? (
            transactions.slice(0, 5).map((tx) => (
              <View key={tx.id} style={styles.recordItem}>
                <View style={styles.recordHeader}>
                  <View style={styles.recordType}>
                    <View style={styles.recordIcon}>
                      <FontAwesome6 name="arrow-up" size={14} color="#EF4444" />
                    </View>
                    <ThemedText style={styles.recordTitle}>发送</ThemedText>
                  </View>
                  <ThemedText style={[styles.recordAmount, styles.recordAmountNegative]}>
                    {tx.amount} {tx.token_symbol}
                  </ThemedText>
                </View>
                <View style={styles.recordInfo}>
                  <ThemedText style={styles.recordAddress}>
                    收款: {formatAddress(tx.to_address || '')}
                  </ThemedText>
                  <View style={[styles.recordStatus, tx.status === 'pending' && styles.recordStatusPending]}>
                    <ThemedText style={[
                      styles.recordStatusText, 
                      tx.status === 'pending' && styles.recordStatusPendingText
                    ]}>
                      {tx.status === 'completed' ? '已完成' : tx.status === 'pending' ? '处理中' : '失败'}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={[styles.recordTime, { marginTop: 4 }]}>
                  {formatTime(tx.created_at)}
                </ThemedText>
              </View>
            ))
          ) : (
            <View style={styles.emptyRecords}>
              <FontAwesome6 name="paper-plane" size={24} color="#6B7280" />
              <ThemedText style={styles.emptyRecordsText}>暂无发送记录</ThemedText>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSend}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <ThemedText style={styles.submitBtnText}>确认发送</ThemedText>
          )}
        </TouchableOpacity>
      </View>
    </Screen>
  );
}
