import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { getBaseUrl } from '@/services/api';
import { createStyles } from './styles';

interface Group {
  id: string;
  name: string;
  description: string;
  avatarUrl?: string;
  ownerId: string;
  ownerName?: string;
  memberCount: number;
  isJoined: boolean;
  createdAt: string;
}

export default function DiscoverScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useTranslation();
  const router = useSafeRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);

  // 检查登录状态
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated]);

  const fetchGroups = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/api/v1/plaza/groups`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        let groupList = data.data || [];
        
        // 搜索过滤
        if (searchText.trim()) {
          const search = searchText.toLowerCase();
          groupList = groupList.filter((g: Group) => 
            g.name.toLowerCase().includes(search) ||
            g.description?.toLowerCase().includes(search)
          );
        }
        
        setGroups(groupList);
      }
    } catch (error) {
      console.error('Fetch groups error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, searchText]);

  useFocusEffect(
    useCallback(() => {
      fetchGroups();
    }, [fetchGroups])
  );

  const onRefresh = () => {
    setRefreshing(true);
    setSearchText('');
    fetchGroups();
  };

  const handleJoinGroup = async (groupId: string) => {
    setJoiningGroupId(groupId);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/api/v1/plaza/groups/${groupId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (data.success) {
        fetchGroups();
      } else {
        alert(data.message || t('plaza.joinFailed'));
      }
    } catch (error) {
      console.error('Join group error:', error);
      alert(t('common.networkError'));
    } finally {
      setJoiningGroupId(null);
    }
  };

  const getInitial = (name: string) => {
    return name?.charAt(0).toUpperCase() || '?';
  };

  const renderGroup = ({ item }: { item: Group }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => item.isJoined && router.push(`/chat/${item.id}`, { name: item.name })}
      activeOpacity={0.7}
    >
      {/* 群头像 */}
      <View style={styles.groupAvatar}>
        <ThemedText style={styles.groupAvatarText}>
          {getInitial(item.name)}
        </ThemedText>
      </View>

      {/* 群信息 */}
      <View style={styles.groupInfo}>
        <ThemedText variant="bodyMedium" style={styles.groupName} numberOfLines={1}>
          {item.name}
        </ThemedText>
        <ThemedText variant="small" style={styles.groupDesc} numberOfLines={2}>
          {item.description || t('discover.noGroups')}
        </ThemedText>
        <View style={styles.groupMeta}>
          <FontAwesome6 name="users" size={12} color="#6B7280" />
          <ThemedText variant="caption" style={styles.memberCount}>
            {item.memberCount} {t('plaza.members')}
          </ThemedText>
        </View>
      </View>

      {/* 操作按钮 */}
      <View style={styles.groupAction}>
        {item.isJoined ? (
          <View style={styles.joinedBadge}>
            <ThemedText variant="tiny" style={styles.joinedText}>{t('discover.joined')}</ThemedText>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.joinButton}
            onPress={() => handleJoinGroup(item.id)}
            disabled={joiningGroupId === item.id}
          >
            {joiningGroupId === item.id ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <ThemedText variant="tiny" style={styles.joinButtonText}>{t('discover.joinGroup')}</ThemedText>
            )}
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  if (authLoading || loading) {
    return (
      <Screen backgroundColor="#000000" statusBarStyle="light">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      </Screen>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Screen backgroundColor="#000000" statusBarStyle="light">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome6 name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <ThemedText variant="h4" style={styles.headerTitle}>
          {t('discover.title')}
        </ThemedText>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <FontAwesome6 name="magnifying-glass" size={16} color="#6B7280" />
        <TextInput
          style={styles.searchInput}
          placeholder={t('discover.searchGroup')}
          placeholderTextColor="#6B7280"
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={fetchGroups}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchText(''); fetchGroups(); }}>
            <FontAwesome6 name="xmark" size={16} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Group List */}
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroup}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F59E0B"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <FontAwesome6 name="users" size={40} color="#F59E0B" />
            </View>
            <ThemedText variant="h4" style={styles.emptyTitle}>
              {searchText ? t('discover.searchGroup') : t('discover.noGroups')}
            </ThemedText>
            <ThemedText variant="small" style={styles.emptyText}>
              {t('plaza.createGroupHint')}
            </ThemedText>
          </View>
        }
      />
    </Screen>
  );
}
