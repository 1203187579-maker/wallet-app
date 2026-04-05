import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
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
import { useAuth } from '@/contexts/AuthContext';
import { getBaseUrl } from '@/services/api';
import { createStyles } from './styles';

interface FriendRequest {
  id: string;
  userId: string;
  userName: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

interface Friend {
  id: string;
  friendId: string;
  friendName: string;
  createdAt: string;
}

export default function FriendsScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [adding, setAdding] = useState(false);

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

      // Fetch friends
      const friendsRes = await fetch(`${baseUrl}/api/v1/plaza/friends`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const friendsData = await friendsRes.json();

      // Fetch friend requests
      const requestsRes = await fetch(`${baseUrl}/api/v1/plaza/friends/requests`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const requestsData = await requestsRes.json();

      if (friendsData.success) {
        setFriends(friendsData.data || []);
      }
      if (requestsData.success) {
        setRequests(requestsData.data || []);
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

  const handleAddFriend = async () => {
    if (!searchText.trim() || adding) return;

    setAdding(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/api/v1/plaza/friends/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          friendCode: searchText.trim(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setAddModalVisible(false);
        setSearchText('');
        // Show success message
      }
    } catch (error) {
      console.error('Add friend error:', error);
    } finally {
      setAdding(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      const response = await fetch(
        `${baseUrl}/api/v1/plaza/friends/requests/${requestId}/accept`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      const data = await response.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Accept request error:', error);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      const response = await fetch(
        `${baseUrl}/api/v1/plaza/friends/requests/${requestId}/reject`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      const data = await response.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Reject request error:', error);
    }
  };

  const getInitial = (name: string) => {
    return name?.charAt(0).toUpperCase() || '?';
  };

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
          好友管理
        </ThemedText>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' ? styles.activeTab : styles.inactiveTab]}
          onPress={() => setActiveTab('friends')}
        >
          <ThemedText
            variant="smallMedium"
            style={[styles.tabText, activeTab === 'friends' ? styles.activeTabText : styles.inactiveTabText]}
          >
            好友列表 ({friends.length})
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' ? styles.activeTab : styles.inactiveTab]}
          onPress={() => setActiveTab('requests')}
        >
          <ThemedText
            variant="smallMedium"
            style={[styles.tabText, activeTab === 'requests' ? styles.activeTabText : styles.inactiveTabText]}
          >
            好友请求 ({requests.filter(r => r.status === 'pending').length})
          </ThemedText>
        </TouchableOpacity>
      </View>

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
        {activeTab === 'friends' ? (
          friends.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <FontAwesome6 name="user-group" size={36} color="#F59E0B" />
              </View>
              <ThemedText variant="h4" style={styles.emptyTitle}>
                还没有好友
              </ThemedText>
              <ThemedText variant="small" style={styles.emptyText}>
                快去添加好友吧
              </ThemedText>
            </View>
          ) : (
            <View style={styles.friendList}>
              {friends.map((friend) => (
                <TouchableOpacity key={friend.id} style={styles.friendCard}>
                  <View style={styles.friendAvatar}>
                    <ThemedText style={styles.friendAvatarText}>
                      {getInitial(friend.friendName)}
                    </ThemedText>
                  </View>
                  <View style={styles.friendInfo}>
                    <ThemedText variant="bodyMedium" style={styles.friendName}>
                      {friend.friendName}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )
        ) : (
          requests.filter(r => r.status === 'pending').length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <FontAwesome6 name="bell" size={36} color="#F59E0B" />
              </View>
              <ThemedText variant="h4" style={styles.emptyTitle}>
                没有好友请求
              </ThemedText>
              <ThemedText variant="small" style={styles.emptyText}>
                新的好友请求会显示在这里
              </ThemedText>
            </View>
          ) : (
            <View style={styles.friendList}>
              {requests.filter(r => r.status === 'pending').map((request) => (
                <View key={request.id} style={styles.friendCard}>
                  <View style={styles.friendAvatar}>
                    <ThemedText style={styles.friendAvatarText}>
                      {getInitial(request.userName)}
                    </ThemedText>
                  </View>
                  <View style={styles.friendInfo}>
                    <ThemedText variant="bodyMedium" style={styles.friendName}>
                      {request.userName}
                    </ThemedText>
                  </View>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.acceptButton]}
                      onPress={() => handleAcceptRequest(request.id)}
                    >
                      <ThemedText variant="tiny" style={[styles.actionButtonText, styles.acceptText]}>
                        接受
                      </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => handleRejectRequest(request.id)}
                    >
                      <ThemedText variant="tiny" style={[styles.actionButtonText, styles.rejectText]}>
                        拒绝
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )
        )}

        {/* Add Friend Button */}
        <TouchableOpacity
          style={styles.addFriendButton}
          onPress={() => setAddModalVisible(true)}
        >
          <FontAwesome6 name="user-plus" size={18} color="#000000" />
          <ThemedText variant="bodyMedium" style={styles.addFriendButtonText}>
            添加好友
          </ThemedText>
        </TouchableOpacity>
      </ScrollView>

      {/* Add Friend Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText variant="h4" style={styles.modalTitle}>添加好友</ThemedText>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setAddModalVisible(false)}
              >
                <FontAwesome6 name="xmark" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="输入好友ID或手机号"
              placeholderTextColor="#6B7280"
              value={searchText}
              onChangeText={setSearchText}
            />

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleAddFriend}
              disabled={adding}
            >
              {adding ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <ThemedText variant="bodyMedium" style={styles.submitButtonText}>
                  发送好友请求
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
