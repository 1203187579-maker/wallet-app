import React, { useState, useMemo } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  Text,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { createStyles } from './styles';

interface TradeModalProps {
  visible: boolean;
  coinId: string;
  coinName: string;
  currentPrice: number;
  usdtBalance: number;
  coinBalance: number;
  isTradingEnabled: boolean;
  onClose: () => void;
  onTrade: (type: 'buy' | 'sell', amount: number, price: number) => Promise<void>;
}

export default function TradeModal({
  visible,
  coinId,
  coinName,
  currentPrice,
  usdtBalance,
  coinBalance,
  isTradingEnabled,
  onClose,
  onTrade,
}: TradeModalProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const numericAmount = parseFloat(amount) || 0;
  const totalValue = numericAmount * currentPrice;
  const fee = totalValue * 0.001; // 0.1% 手续费

  const maxAmount = tradeType === 'buy' 
    ? usdtBalance / currentPrice 
    : coinBalance;

  const handleMax = () => {
    setAmount(maxAmount.toFixed(8));
  };

  const handleSubmit = async () => {
    if (numericAmount <= 0) {
      setError('请输入有效金额');
      return;
    }

    if (tradeType === 'buy' && totalValue > usdtBalance) {
      setError('USDT余额不足');
      return;
    }

    if (tradeType === 'sell' && numericAmount > coinBalance) {
      setError(`${coinName}余额不足`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onTrade(tradeType, numericAmount, currentPrice);
      setAmount('');
      onClose();
    } catch (err: any) {
      setError(err.message || '交易失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setError('');
    onClose();
  };

  if (!isTradingEnabled) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.header}>
                  <Text style={styles.headerTitle}>交易</Text>
                  <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                    <Text style={styles.closeIcon}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.content}>
                  <Text style={styles.disabledMessage}>
                    该币种交易功能已关闭
                  </Text>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                {/* Header */}
                <View style={styles.header}>
                  <Text style={styles.headerTitle}>交易 {coinName}</Text>
                  <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                    <Text style={styles.closeIcon}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Buy/Sell Tabs */}
                <View style={styles.tabContainer}>
                  <TouchableOpacity
                    style={[styles.tab, tradeType === 'buy' && styles.tabActive]}
                    onPress={() => {
                      setTradeType('buy');
                      setAmount('');
                      setError('');
                    }}
                  >
                    <Text style={[
                      styles.tabText,
                      tradeType === 'buy' && styles.tabTextBuy
                    ]}>
                      买入
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tab, tradeType === 'sell' && styles.tabActive]}
                    onPress={() => {
                      setTradeType('sell');
                      setAmount('');
                      setError('');
                    }}
                  >
                    <Text style={[
                      styles.tabText,
                      tradeType === 'sell' && styles.tabTextSell
                    ]}>
                      卖出
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.content}>
                  {/* Amount Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>数量 ({coinName})</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.input}
                        value={amount}
                        onChangeText={setAmount}
                        placeholder="0.00"
                        placeholderTextColor="#6B7280"
                        keyboardType="decimal-pad"
                        editable={!loading}
                      />
                      <TouchableOpacity style={styles.maxButton} onPress={handleMax}>
                        <Text style={styles.maxButtonText}>最大</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Price Info */}
                  <View style={styles.priceInfo}>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>价格</Text>
                      <Text style={styles.priceValue}>{currentPrice.toFixed(4)} USDT</Text>
                    </View>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>交易额</Text>
                      <Text style={[styles.priceValue, styles.priceValueHighlight]}>
                        {totalValue.toFixed(2)} USDT
                      </Text>
                    </View>
                    <View style={[styles.priceRow, styles.priceRowLast]}>
                      <Text style={styles.priceLabel}>手续费 (0.1%)</Text>
                      <Text style={styles.priceValue}>{fee.toFixed(4)} USDT</Text>
                    </View>
                  </View>

                  {/* Balance */}
                  <View style={styles.balanceInfo}>
                    <Text style={styles.balanceLabel}>
                      可用 {tradeType === 'buy' ? 'USDT' : coinName}
                    </Text>
                    <Text style={styles.balanceValue}>
                      {tradeType === 'buy' 
                        ? usdtBalance.toFixed(2) 
                        : coinBalance.toFixed(8)}
                    </Text>
                  </View>

                  {/* Error Message */}
                  {error ? (
                    <Text style={styles.errorMessage}>{error}</Text>
                  ) : null}

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      tradeType === 'buy' ? styles.submitButtonBuy : styles.submitButtonSell,
                      loading && styles.submitButtonDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={loading}
                  >
                    {loading ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator color="#FFFFFF" size="small" />
                        <Text style={styles.loadingText}>处理中...</Text>
                      </View>
                    ) : (
                      <Text style={styles.submitButtonText}>
                        {tradeType === 'buy' ? '买入' : '卖出'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
