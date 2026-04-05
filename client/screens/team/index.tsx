import React, { useMemo, useState, useCallback } from 'react';
import { 
  ScrollView, 
  View, 
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/AuthContext';
import { getBaseUrl } from '@/services/api';
import { createStyles } from './styles';

type TeamMember = {
  id: string;
  phone?: string;
  nickname?: string;
  avatar_url?: string;
  created_at: string;
  is_kyc_verified?: boolean;
  referral_stats?: {
    direct_count: number;
    direct_stake: string;
    team_count: number;
    team_stake: string;
  };
};

type ReferralStats = {
  direct_count: number;
  direct_stake: string;
  team_count: number;
  team_stake: string;
  total_reward: string;
  level: number;
};

export default function TeamScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { user, isAuthenticated, isLoading: authLoading, referralStats } = useAuth();
  
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();
      
      const [statsRes, teamRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/referral/stats`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${baseUrl}/api/v1/referral/team`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      const statsData = await statsRes.json();
      const teamData = await teamRes.json();

      if (statsData.success) {
        setStats(statsData.data?.stats || null);
      }
      if (teamData.success) {
        setTeamMembers(teamData.data?.team || []);
      }
    } catch (error) {
      console.error('Load team data error:', error);
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

  if (authLoading || loading) {
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
            onRefresh={onRefresh}
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
            {t('profile.myTeam')}
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <ThemedText variant="stat" style={styles.statValue}>
              {stats?.direct_count || referralStats?.direct_count || 0}
            </ThemedText>
            <ThemedText variant="caption" style={styles.statLabel}>
              直推人数
            </ThemedText>
          </View>
          <View style={styles.statCard}>
            <ThemedText variant="stat" style={styles.statValue}>
              {stats?.team_count || referralStats?.team_count || 0}
            </ThemedText>
            <ThemedText variant="caption" style={styles.statLabel}>
              团队人数
            </ThemedText>
          </View>
          <View style={styles.statCard}>
            <ThemedText variant="stat" style={[styles.statValue, { color: '#10B981' }]}>
              ${parseFloat(stats?.total_reward || '0').toFixed(2)}
            </ThemedText>
            <ThemedText variant="caption" style={styles.statLabel}>
              累计收益
            </ThemedText>
          </View>
        </View>

        {/* Stake Stats */}
        <View style={styles.stakeRow}>
          <View style={styles.stakeItem}>
            <ThemedText variant="small" style={styles.stakeLabel}>直推质押</ThemedText>
            <ThemedText variant="smallMedium" style={styles.stakeValue}>
              ${parseFloat(stats?.direct_stake || '0').toFixed(2)}
            </ThemedText>
          </View>
          <View style={styles.stakeDivider} />
          <View style={styles.stakeItem}>
            <ThemedText variant="small" style={styles.stakeLabel}>团队质押</ThemedText>
            <ThemedText variant="smallMedium" style={styles.stakeValue}>
              ${parseFloat(stats?.team_stake || '0').toFixed(2)}
            </ThemedText>
          </View>
        </View>

        {/* Team List */}
        <View style={styles.sectionHeader}>
          <ThemedText variant="smallMedium" style={styles.sectionTitle}>
            直推列表 ({teamMembers.length})
          </ThemedText>
        </View>

        {teamMembers.length > 0 ? (
          teamMembers.map((member, index) => (
            <View key={member.id} style={styles.memberItem}>
              <View style={styles.memberAvatar}>
                <FontAwesome6 name="user" size={16} color="#F59E0B" />
              </View>
              <View style={styles.memberInfo}>
                <ThemedText variant="smallMedium" style={styles.memberName}>
                  {member.nickname || member.phone?.slice(-4) || '用户'}
                </ThemedText>
                <ThemedText variant="caption" style={styles.memberDate}>
                  {new Date(member.created_at).toLocaleDateString()}
                </ThemedText>
              </View>
              <View style={styles.memberStats}>
                {member.is_kyc_verified && (
                  <View style={styles.kycBadge}>
                    <FontAwesome6 name="shield-check" size={10} color="#22C55E" />
                  </View>
                )}
                <ThemedText variant="caption" style={styles.memberStake}>
                  ${parseFloat(member.referral_stats?.direct_stake || '0').toFixed(0)}
                </ThemedText>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <FontAwesome6 name="users" size={32} color="#6B7280" />
            <ThemedText variant="small" style={styles.emptyText}>
              暂无团队成员
            </ThemedText>
            <ThemedText variant="caption" style={styles.emptyHint}>
              分享邀请码邀请好友加入
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
