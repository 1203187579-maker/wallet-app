import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { getBaseUrl } from '@/services/api';
import { createStyles } from './styles';

export default function SendRedPacketScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ groupId: string }>();
  const { user } = useAuth();

  const [amount, setAmount] = useState('');
  const [count, setCount] = useState('1');
  const [message, setMessage] = useState('恭喜发财，大吉大利');
  const [sending, setSending] = useState(false);
  const [balance, setBalance] = useState('0.00');

  const groupId = params.groupId;

  const handleSend = async () => {
    if (!amount || parseFloat(amount) <= 0 || !groupId || sending) return;

    setSending(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/api/v1/plaza/red-packet/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupId,
          amount: amount,
          count: parseInt(count) || 1,
          message: message || '恭喜发财，大吉大利',
        }),
      });

      const data = await response.json();
      if (data.success) {
        router.back();
      }
    } catch (error) {
      console.error('Send red packet error:', error);
    } finally {
      setSending(false);
    }
  };

  const isValid = amount && parseFloat(amount) > 0;

  return (
    <Screen backgroundColor="#000000" statusBarStyle="light">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome6 name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <ThemedText variant="h4" style={styles.headerTitle}>
          发AI红包
        </ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Amount Card */}
        <View style={styles.card}>
          <ThemedText variant="small" style={styles.cardTitle}>
            红包金额 (AI)
          </ThemedText>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="rgba(255,255,255,0.3)"
          />
          <ThemedText variant="body" style={styles.amountUnit}>
            AI
          </ThemedText>
          <ThemedText variant="caption" style={styles.balanceText}>
            可用余额: {balance} AI
          </ThemedText>
        </View>

        {/* Count Input */}
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <ThemedText variant="small" style={styles.inputLabel}>
              红包个数
            </ThemedText>
            <TextInput
              style={styles.input}
              value={count}
              onChangeText={setCount}
              keyboardType="number-pad"
              placeholder="红包个数"
              placeholderTextColor="#6B7280"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText variant="small" style={styles.inputLabel}>
              祝福语
            </ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={message}
              onChangeText={setMessage}
              placeholder="恭喜发财，大吉大利"
              placeholderTextColor="#6B7280"
              multiline
              maxLength={50}
            />
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoRow}>
          <ThemedText variant="small" style={styles.infoLabel}>
            发送方式
          </ThemedText>
          <ThemedText variant="small" style={styles.infoValue}>
            拼手气红包
          </ThemedText>
        </View>

        <View style={styles.infoRow}>
          <ThemedText variant="small" style={styles.infoLabel}>
            发送范围
          </ThemedText>
          <ThemedText variant="small" style={styles.infoValue}>
            当前群聊
          </ThemedText>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, !isValid && styles.submitButtonDisabled]}
          onPress={handleSend}
          disabled={!isValid || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <ThemedText variant="bodyMedium" style={styles.submitButtonText}>
              发送红包
            </ThemedText>
          )}
        </TouchableOpacity>

        <ThemedText variant="caption" style={styles.tip}>
          红包金额将随机分配给领取者
        </ThemedText>
      </ScrollView>
    </Screen>
  );
}
