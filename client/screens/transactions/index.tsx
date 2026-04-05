import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { assetApi, Transaction } from '@/services/api';

// 交易类型映射
const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; isPositive: boolean }> = {
  deposit: { label: '转入', icon: 'arrow-down', color: '#22C55E', isPositive: true },
  withdraw: { label: '转出', icon: 'arrow-up', color: '#EF4444', isPositive: false },
  transfer: { label: '转账', icon: 'arrow-right-arrow-left', color: '#3B82F6', isPositive: false },
  stake: { label: '质押', icon: 'lock', color: '#A855F7', isPositive: false },
  redeem: { label: '赎回', icon: 'unlock', color: '#22C55E', isPositive: true },
  reward: { label: '奖励', icon: 'gift', color: '#22C55E', isPositive: true },
  c2c_buy: { label: '买入', icon: 'cart-shopping', color: '#22C55E', isPositive: true },
  c2c_sell: { label: '卖出', icon: 'tag', color: '#EF4444', isPositive: false },
  airdrop: { label: '空投', icon: 'parachute-box', color: '#22C55E', isPositive: true },
  admin_deposit: { label: '转入', icon: 'arrow-down', color: '#22C55E', isPositive: true },
  admin_deduct: { label: '扣减', icon: 'arrow-up', color: '#EF4444', isPositive: false },
};

const FILTER_OPTIONS = [
  { key: 'all', label: '全部' },
  { key: 'stake', label: '质押' },
  { key: 'reward', label: '奖励' },
  { key: 'transfer', label: '转账' },
  { key: 'deposit', label: '转入', types: ['deposit', 'admin_deposit'] },
  { key: 'withdraw', label: '转出', types: ['withdraw', 'admin_deduct'] },
];

export default function TransactionsScreen() {
  const styles = useMemo(() => createStyles({} as any), []);
  const { isAuthenticated } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showFilter, setShowFilter] = useState(false);

  const fetchTransactions = useCallback(async () => {
    try {
      const filterOption = FILTER_OPTIONS.find(opt => opt.key === activeFilter);
      // 如果筛选选项有多个类型，获取全部然后前端过滤
      const hasMultipleTypes = filterOption?.types && filterOption.types.length > 1;
      const type = (activeFilter === 'all' || hasMultipleTypes) ? undefined : activeFilter;
      
      const response = await assetApi.getTransactions({ type, page: 1, limit: 50 });
      if (response.success && response.data) {
        // 如果有多个类型，前端过滤
        if (hasMultipleTypes) {
          const filtered = (response.data.transactions || []).filter((tx: Transaction) => 
            filterOption!.types!.includes(tx.type)
          );
          setTransactions(filtered);
        } else {
          setTransactions(response.data.transactions || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTransactions();
    }
  }, [isAuthenticated, fetchTransactions]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTransactions();
  }, [fetchTransactions]);

  const handleFilterSelect = (key: string) => {
    setActiveFilter(key);
    setShowFilter(false);
  };

  // 按日期分组
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: Transaction[] } = {};
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    transactions.forEach((tx) => {
      const txDate = new Date(tx.created_at);
      let groupKey: string;

      if (txDate.toDateString() === today.toDateString()) {
        groupKey = '今天';
      } else if (txDate.toDateString() === yesterday.toDateString()) {
        groupKey = '昨天';
      } else {
        groupKey = txDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(tx);
    });

    return groups;
  }, [transactions]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatAmount = (amount: string) => {
    const num = Math.abs(parseFloat(amount));
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(4);
  };

  const getCurrentFilterLabel = () => {
    const found = FILTER_OPTIONS.find(opt => opt.key === activeFilter);
    return found ? found.label : '全部';
  };

  if (!isAuthenticated) {
    return (
      <Screen backgroundColor="#000000" statusBarStyle="light">
        <View style={styles.emptyContainer}>
          <FontAwesome6 name="lock" size={40} color="#6B7280" />
          <Text style={styles.emptyText}>请先登录</Text>
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
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#F59E0B" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 标题和筛选按钮 */}
        <View style={styles.header}>
          <ThemedText variant="h2" style={{ color: '#FFFFFF' }}>资产明细</ThemedText>
          <TouchableOpacity 
            style={styles.filterToggle}
            onPress={() => setShowFilter(!showFilter)}
          >
            <Text style={styles.filterToggleText}>{getCurrentFilterLabel()}</Text>
            <FontAwesome6 
              name={showFilter ? "chevron-up" : "chevron-down"} 
              size={12} 
              color="#F59E0B" 
            />
          </TouchableOpacity>
        </View>

        {/* 筛选选项 */}
        {showFilter && (
          <View style={styles.filterWrap}>
            <View style={styles.filterRow}>
              {FILTER_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.filterButton, activeFilter === opt.key && styles.filterButtonActive]}
                  onPress={() => handleFilterSelect(opt.key)}
                >
                  <Text style={[styles.filterButtonText, activeFilter === opt.key && styles.filterButtonTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* 列表 */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F59E0B" />
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome6 name="receipt" size={40} color="#6B7280" style={styles.emptyIcon} />
            <Text style={styles.emptyText}>暂无记录</Text>
          </View>
        ) : (
          Object.entries(groupedTransactions).map(([date, txs]) => (
            <View key={date} style={styles.dateGroup}>
              {/* 日期标题 */}
              <View style={styles.dateHeader}>
                <View style={styles.dateLine} />
                <Text style={styles.dateText}>{date}</Text>
                <View style={styles.dateLine} />
              </View>

              {/* 时间线 */}
              {txs.map((tx, index) => {
                const config = TYPE_CONFIG[tx.type] || { label: tx.type, icon: 'circle', color: '#6B7280', isPositive: false };
                const isLast = index === txs.length - 1;

                return (
                  <View key={tx.id} style={styles.timelineRow}>
                    {/* 左侧时间线 */}
                    <View style={styles.timelineLeft}>
                      <Text style={styles.timeText}>{formatTime(tx.created_at)}</Text>
                      <View style={styles.timelineDotWrap}>
                        <View style={[styles.timelineDot, { backgroundColor: config.color }]} />
                        {!isLast && <View style={styles.timelineLine} />}
                      </View>
                    </View>

                    {/* 右侧卡片 */}
                    <View style={styles.timelineCard}>
                      <View style={styles.cardTop}>
                        <View style={styles.cardLeft}>
                          <View style={[styles.typeIcon, { backgroundColor: config.color + '20' }]}>
                            <FontAwesome6 name={config.icon as any} size={16} color={config.color} />
                          </View>
                          <Text style={styles.typeText}>{config.label}</Text>
                        </View>
                        <Text style={[styles.amountText, { color: config.isPositive ? '#22C55E' : '#EF4444' }]}>
                          {config.isPositive ? '+' : '-'}{formatAmount(tx.amount)} {tx.token_symbol}
                        </Text>
                      </View>
                      {tx.note && (
                        <Text style={styles.noteText}>{tx.note}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
