import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
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
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  createdAt: string;
}

interface Conversation {
  id: string;
  type: 'group' | 'private' | 'notification';
  name: string;
  avatar?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline?: boolean;
  members?: string[];
}

type TabType = 'all' | 'groups' | 'private' | 'notifications';

export default function PlazaScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useTranslation();
  const router = useSafeRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [groups, setGroups] = useState<Group[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // 检查登录状态
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated]);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      console.log('[Plaza] Token exists:', !!token);

      // 获取群组列表
      const groupsResponse = await fetch(`${baseUrl}/api/v1/plaza/my-groups`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const groupsData = await groupsResponse.json();
      console.log('[Plaza] Groups response:', JSON.stringify(groupsData).slice(0, 500));
      
      if (groupsData.success) {
        const groupList = groupsData.data || [];
        console.log('[Plaza] Groups count:', groupList.length);
        setGroups(groupList);

        // 转换为会话格式
        const convList: Conversation[] = groupList.map((g: Group) => ({
          id: g.id,
          type: 'group' as const,
          name: g.name,
          lastMessage: g.description || '暂无消息',
          lastMessageTime: g.createdAt,
          unreadCount: g.unreadCount || 0,
          members: [],
        }));
        setConversations(convList);
      } else {
        console.log('[Plaza] API error:', groupsData.message);
      }
    } catch (error) {
      console.error('Fetch data error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      alert(t('plaza.groupName'));
      return;
    }

    setCreating(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/api/v1/plaza/groups`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDesc.trim(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setCreateModalVisible(false);
        setNewGroupName('');
        setNewGroupDesc('');
        fetchData();
      } else {
        alert(data.message || t('plaza.groupCreateFailed'));
      }
    } catch (error) {
      console.error('Create group error:', error);
      alert(t('common.networkError'));
    } finally {
      setCreating(false);
    }
  };

  const getInitial = (name: string) => {
    return name?.charAt(0).toUpperCase() || '?';
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (days < 7) {
      return `${days}天前`;
    } else if (date.getFullYear() === now.getFullYear()) {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    } else {
      return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
    }
  };

  // 根据Tab过滤会话
  const filteredConversations = useMemo(() => {
    switch (activeTab) {
      case 'groups':
        return conversations.filter(c => c.type === 'group');
      case 'private':
        return conversations.filter(c => c.type === 'private');
      case 'notifications':
        return conversations.filter(c => c.type === 'notification');
      default:
        return conversations;
    }
  }, [conversations, activeTab]);

  // 计算各Tab的未读数
  const tabUnreadCounts = useMemo(() => ({
    all: conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    groups: conversations.filter(c => c.type === 'group').reduce((sum, c) => sum + c.unreadCount, 0),
    private: conversations.filter(c => c.type === 'private').reduce((sum, c) => sum + c.unreadCount, 0),
    notifications: conversations.filter(c => c.type === 'notification').reduce((sum, c) => sum + c.unreadCount, 0),
  }), [conversations]);

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => item.type === 'group' && router.push(`/chat/${item.id}` as `/${string}`)}
      activeOpacity={0.7}
    >
      {/* 头像 */}
      <View style={styles.avatarContainer}>
        {item.type === 'group' ? (
          <View style={styles.groupAvatar}>
            <ThemedText style={styles.groupAvatarText}>
              {getInitial(item.name)}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.singleAvatar}>
            <FontAwesome6 
              name={item.type === 'notification' ? 'bell' : 'user'} 
              size={20} 
              color="#F59E0B" 
            />
          </View>
        )}
        {item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <ThemedText style={styles.unreadText}>
              {item.unreadCount > 99 ? '99+' : item.unreadCount}
            </ThemedText>
          </View>
        )}
      </View>

      {/* 内容 */}
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <ThemedText variant="bodyMedium" style={styles.conversationName} numberOfLines={1}>
            {item.name}
          </ThemedText>
          <ThemedText variant="caption" style={styles.conversationTime}>
            {formatTime(item.lastMessageTime)}
          </ThemedText>
        </View>
        <ThemedText variant="small" style={styles.conversationMessage} numberOfLines={1}>
          {item.lastMessage}
        </ThemedText>
      </View>
    </TouchableOpacity>
  );

  // 计算总未读数
  const totalUnread = tabUnreadCounts.all;

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
        <ThemedText variant="h3" style={styles.headerTitle}>
          {t('plaza.title')}
        </ThemedText>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerBtn}
            onPress={() => router.push('/discover')}
          >
            <FontAwesome6 name="compass" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerBtn}
            onPress={() => setCreateModalVisible(true)}
          >
            <FontAwesome6 name="plus" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
          {[
            { key: 'all', label: t('plaza.all') },
            { key: 'groups', label: t('plaza.groups') },
            { key: 'private', label: t('plaza.private') },
            { key: 'notifications', label: t('plaza.notifications') },
          ].map((tab) => {
            const unread = tabUnreadCounts[tab.key as TabType];
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive ? styles.tabActive : styles.tabInactive]}
                onPress={() => setActiveTab(tab.key as TabType)}
              >
                <ThemedText
                  variant="smallMedium"
                  style={[styles.tabText, isActive ? styles.tabTextActive : styles.tabTextInactive]}
                >
                  {tab.label}{unread > 0 ? ` ${unread}` : ''}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Conversation List */}
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversation}
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
              <FontAwesome6 name="comments" size={48} color="#F59E0B" />
            </View>
            <ThemedText variant="h4" style={styles.emptyTitle}>
              {activeTab === 'groups' ? t('plaza.noGroups') : 
               activeTab === 'private' ? t('plaza.noPrivate') :
               activeTab === 'notifications' ? t('plaza.noNotifications') : t('plaza.noConversation')}
            </ThemedText>
            <ThemedText variant="small" style={styles.emptyText}>
              {activeTab === 'groups' ? t('plaza.createGroupHint') : t('plaza.discoverMore')}
            </ThemedText>
            {activeTab === 'groups' && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setCreateModalVisible(true)}
              >
                <ThemedText variant="bodyMedium" style={styles.emptyButtonText}>
                  {t('plaza.createGroup')}
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Create Group Modal */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText variant="h4" style={styles.modalTitle}>{t('plaza.createGroup')}</ThemedText>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setCreateModalVisible(false)}
              >
                <FontAwesome6 name="xmark" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder={t('plaza.groupName')}
              placeholderTextColor="#6B7280"
              value={newGroupName}
              onChangeText={setNewGroupName}
              maxLength={50}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('plaza.groupDesc')}
              placeholderTextColor="#6B7280"
              value={newGroupDesc}
              onChangeText={setNewGroupDesc}
              multiline
              maxLength={200}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setCreateModalVisible(false)}
              >
                <ThemedText variant="bodyMedium" style={styles.cancelButtonText}>
                  {t('common.cancel')}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleCreateGroup}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <ThemedText variant="bodyMedium" style={styles.submitButtonText}>
                    {t('common.confirm')}
                  </ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
