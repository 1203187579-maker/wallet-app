import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  FlatList,
  Switch,
  Image,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { getBaseUrl } from '@/services/api';
import { createFormDataFile } from '@/utils';
import { createStyles } from './styles';

interface Member {
  id: string;
  userId: string;
  userName: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

interface GroupBot {
  id: string;
  botId: string;
  name: string;
  description: string;
  avatarUrl: string;
  triggerKeywords: string[];
  isActive: boolean;
}

interface AvailableBot {
  id: string;
  name: string;
  description: string;
  triggerKeywords: string[];
}

interface Friend {
  id: string;
  friendId: string;
  friendName: string;
  phone: string;
  avatarUrl: string;
}

interface GroupInfo {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  memberCount: number;
  announcement?: string;
  joinSetting?: 'free' | 'admin_approval' | 'invite_only';
  messageFrequency?: 'unlimited' | 'limited';
  messageFrequencyLimit?: number;
  autoDelete?: boolean;
  autoDeleteDays?: number;
  capacity?: number;
  avatarUrl?: string;
}

interface MemberSettings {
  isPinned: boolean;
  isMuted: boolean;
  nickname?: string;
}

export default function GroupSettingsScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  // 动态路由参数直接从 URL 路径获取
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { user } = useAuth();

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [bots, setBots] = useState<GroupBot[]>([]);
  const [memberSettings, setMemberSettings] = useState<MemberSettings>({ isPinned: false, isMuted: false });
  const [loading, setLoading] = useState(true);

  // Modal states
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const [addBotModalVisible, setAddBotModalVisible] = useState(false);
  const [availableBots, setAvailableBots] = useState<AvailableBot[]>([]);
  const [loadingBots, setLoadingBots] = useState(false);

  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [inviting, setInviting] = useState(false);

  const [announcementModalVisible, setAnnouncementModalVisible] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const [joinSettingModalVisible, setJoinSettingModalVisible] = useState(false);
  const [joinSetting, setJoinSetting] = useState<'free' | 'admin_approval' | 'invite_only'>('admin_approval');

  const [messageFrequencyModalVisible, setMessageFrequencyModalVisible] = useState(false);
  const [messageFrequency, setMessageFrequency] = useState<'unlimited' | 'limited'>('unlimited');

  const [autoDeleteModalVisible, setAutoDeleteModalVisible] = useState(false);
  const [autoDelete, setAutoDelete] = useState(false);
  const [autoDeleteDays, setAutoDeleteDays] = useState(7);

  const [nicknameModalVisible, setNicknameModalVisible] = useState(false);
  const [nickname, setNickname] = useState('');

  const [capacityModalVisible, setCapacityModalVisible] = useState(false);
  const [capacityConfig, setCapacityConfig] = useState<{
    baseCapacity: number;
    pricePerHundred: string;
    currency: string;
  }>({ baseCapacity: 100, pricePerHundred: '10', currency: 'AI' });
  const [expandAmount, setExpandAmount] = useState(100);
  const [araBalance, setAraBalance] = useState('0');
  const [expanding, setExpanding] = useState(false);

  const fetchData = useCallback(async () => {
    console.log('[GroupSettings] fetchData - groupId:', groupId);
    if (!groupId) {
      console.log('[GroupSettings] No groupId, skipping');
      setLoading(false);
      return;
    }

    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();
      
      console.log('[GroupSettings] Fetching settings for group:', groupId);

      const [settingsRes, botsRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/plaza/groups/${groupId}/settings`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${baseUrl}/api/v1/plaza/groups/${groupId}/bots`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      const settingsData = await settingsRes.json();
      console.log('[GroupSettings] Settings API response:', JSON.stringify(settingsData).slice(0, 500));
      if (settingsData.success) {
        setGroup(settingsData.data?.group);
        setMembers(settingsData.data?.members || []);
        
        // 设置成员设置
        const myMember = settingsData.data?.members?.find((m: Member) => 
          normalizeUuid(m.userId) === normalizeUuid(user?.id)
        );
        if (myMember) {
          setMemberSettings({
            isPinned: (myMember as any).is_pinned || false,
            isMuted: (myMember as any).is_muted || false,
            nickname: (myMember as any).nickname || '',
          });
          setNickname((myMember as any).nickname || '');
        }

        // 设置群设置
        const groupData = settingsData.data?.group;
        if (groupData) {
          setAnnouncement(groupData.announcement || '');
          setJoinSetting(groupData.joinSetting || 'admin_approval');
          setMessageFrequency(groupData.messageFrequency || 'unlimited');
          setAutoDelete(groupData.autoDelete || false);
          setAutoDeleteDays(groupData.autoDeleteDays || 7);
        }
      }

      const botsData = await botsRes.json();
      if (botsData.success) {
        setBots(botsData.data || []);
      }
    } catch (error) {
      console.error('Fetch group settings error:', error);
    } finally {
      setLoading(false);
    }
  }, [groupId, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 权限判断
  const normalizeUuid = (uuid: string | undefined) => uuid?.replace(/-/g, '').toLowerCase();
  const normalizedOwnerId = normalizeUuid(group?.ownerId);
  const normalizedUserId = normalizeUuid(user?.id);
  const isOwner = normalizedOwnerId && normalizedUserId && normalizedOwnerId === normalizedUserId;
  const currentMember = members.find(m => normalizeUuid(m.userId) === normalizedUserId);
  const isAdmin = currentMember?.role === 'admin';
  const canManage = isOwner || isAdmin;

  // API 调用
  const updateGroupSettings = async (updates: Record<string, any>) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/api/v1/plaza/groups/${groupId}/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      if (data.success) {
        fetchData();
        return true;
      } else {
        Alert.alert('错误', data.message || '保存失败');
        return false;
      }
    } catch (error) {
      console.error('Update group settings error:', error);
      Alert.alert('错误', '保存失败');
      return false;
    }
  };

  const updateMemberSettings = async (updates: Record<string, any>) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/api/v1/plaza/groups/${groupId}/member-settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      if (data.success) {
        setMemberSettings(prev => ({ ...prev, ...updates }));
        return true;
      } else {
        Alert.alert('错误', data.message || '保存失败');
        return false;
      }
    } catch (error) {
      console.error('Update member settings error:', error);
      Alert.alert('错误', '保存失败');
      return false;
    }
  };

  // 机器人相关
  const fetchAvailableBots = async () => {
    setLoadingBots(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/api/v1/plaza/available-bots`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        const addedBotIds = new Set(bots.map(b => b.botId));
        setAvailableBots((data.data || []).filter((b: AvailableBot) => !addedBotIds.has(b.id)));
      }
    } catch (error) {
      console.error('Fetch available bots error:', error);
    } finally {
      setLoadingBots(false);
    }
  };

  const handleOpenAddBot = () => {
    fetchAvailableBots();
    setAddBotModalVisible(true);
  };

  const handleAddBot = async (botId: string) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/api/v1/plaza/groups/${groupId}/bots`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ botId }),
      });

      const data = await response.json();
      if (data.success) {
        setAddBotModalVisible(false);
        fetchData();
      } else {
        Alert.alert('错误', data.message || '添加失败');
      }
    } catch (error) {
      console.error('Add bot error:', error);
      Alert.alert('错误', '添加失败');
    }
  };

  const handleRemoveBot = (botId: string, botName: string) => {
    Alert.alert('移除机器人', `确定要将机器人「${botName}」移出群组吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('auth_token');
            const baseUrl = getBaseUrl();

            const response = await fetch(`${baseUrl}/api/v1/plaza/groups/${groupId}/bots/${botId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` },
            });

            const data = await response.json();
            if (data.success) {
              fetchData();
            } else {
              Alert.alert('错误', data.message || '移除失败');
            }
          } catch (error) {
            console.error('Remove bot error:', error);
            Alert.alert('错误', '移除失败');
          }
        },
      },
    ]);
  };

  // 邀请好友
  const fetchFriends = async () => {
    setLoadingFriends(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/api/v1/plaza/friends`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        const memberUserIds = new Set(members.map(m => m.userId));
        setFriends((data.data || []).filter((f: Friend) => !memberUserIds.has(f.friendId)));
      }
    } catch (error) {
      console.error('Fetch friends error:', error);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleOpenInvite = () => {
    setSelectedFriends(new Set());
    fetchFriends();
    setInviteModalVisible(true);
  };

  const toggleFriendSelection = (friendId: string) => {
    const newSelected = new Set(selectedFriends);
    if (newSelected.has(friendId)) {
      newSelected.delete(friendId);
    } else {
      newSelected.add(friendId);
    }
    setSelectedFriends(newSelected);
  };

  const handleInviteFriends = async () => {
    if (selectedFriends.size === 0) {
      Alert.alert('提示', '请选择要邀请的好友');
      return;
    }

    setInviting(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/api/v1/plaza/groups/${groupId}/invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ friendIds: Array.from(selectedFriends) }),
      });

      const data = await response.json();
      if (data.success) {
        setInviteModalVisible(false);
        Alert.alert('成功', data.message || '邀请成功');
        fetchData();
      } else {
        Alert.alert('错误', data.message || '邀请失败');
      }
    } catch (error) {
      console.error('Invite friends error:', error);
      Alert.alert('错误', '邀请失败');
    } finally {
      setInviting(false);
    }
  };

  // 公告
  const handleSaveAnnouncement = async () => {
    setSaving(true);
    const success = await updateGroupSettings({ announcement: announcement.trim() });
    setSaving(false);
    if (success) {
      setAnnouncementModalVisible(false);
    }
  };

  // 进群设置
  const handleSaveJoinSetting = async () => {
    setSaving(true);
    const success = await updateGroupSettings({ joinSetting });
    setSaving(false);
    if (success) {
      setJoinSettingModalVisible(false);
    }
  };

  // 发言频率
  const handleSaveMessageFrequency = async () => {
    setSaving(true);
    const success = await updateGroupSettings({ messageFrequency });
    setSaving(false);
    if (success) {
      setMessageFrequencyModalVisible(false);
    }
  };

  // 自动删除
  const handleSaveAutoDelete = async () => {
    setSaving(true);
    const success = await updateGroupSettings({ autoDelete, autoDeleteDays });
    setSaving(false);
    if (success) {
      setAutoDeleteModalVisible(false);
    }
  };

  // 群容量扩容
  const fetchCapacityConfig = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      const [configRes, balanceRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/plaza/capacity-config`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${baseUrl}/api/v1/assets`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      const configData = await configRes.json();
      if (configData.success) {
        setCapacityConfig(configData.data);
      }

      const balanceData = await balanceRes.json();
      if (balanceData.success) {
        const araAsset = balanceData.data?.assets?.find((a: any) => a.token_symbol === 'AI');
        setAraBalance(araAsset?.balance || '0');
      }
    } catch (error) {
      console.error('Fetch capacity config error:', error);
    }
  };

  const handleOpenCapacity = () => {
    setExpandAmount(100);
    fetchCapacityConfig();
    setCapacityModalVisible(true);
  };

  const handleExpandCapacity = async () => {
    if (expandAmount < 100) {
      Alert.alert('错误', '最小扩容数量为100');
      return;
    }

    const totalCost = (expandAmount / 100) * parseFloat(capacityConfig.pricePerHundred);
    const balance = parseFloat(araBalance);

    if (balance < totalCost) {
      Alert.alert('余额不足', `需要 ${totalCost} AI，当前余额 ${balance.toFixed(2)} AI`);
      return;
    }

    setExpanding(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/api/v1/plaza/groups/${groupId}/expand-capacity`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: expandAmount }),
      });

      const data = await response.json();
      if (data.success) {
        setCapacityModalVisible(false);
        Alert.alert('成功', `群容量已扩充 ${expandAmount} 人`);
        fetchData();
      } else {
        Alert.alert('错误', data.message || '扩容失败');
      }
    } catch (error) {
      console.error('Expand capacity error:', error);
      Alert.alert('错误', '扩容失败');
    } finally {
      setExpanding(false);
    }
  };

  // 群昵称
  const handleSaveNickname = async () => {
    setSaving(true);
    const success = await updateMemberSettings({ nickname: nickname.trim() || null });
    setSaving(false);
    if (success) {
      setNicknameModalVisible(false);
    }
  };

  // 编辑群信息
  const handleEditGroup = () => {
    if (group) {
      setEditName(group.name);
      setEditDesc(group.description || '');
      setEditModalVisible(true);
    }
  };

  // 更换群头像
  const handlePickAvatar = async () => {
    if (!isOwner) return;

    // 请求相册权限
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('权限不足', '需要相册权限才能选择头像');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      // 创建 FormData
      const formData = new FormData();
      const file = await createFormDataFile(uri, 'avatar.jpg', 'image/jpeg');
      formData.append('avatar', file as any);

      const response = await fetch(`${baseUrl}/api/v1/plaza/groups/${groupId}/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        fetchData();
        Alert.alert('成功', '群头像已更新');
      } else {
        Alert.alert('错误', data.message || '上传失败');
      }
    } catch (error) {
      console.error('Upload avatar error:', error);
      Alert.alert('错误', '上传失败');
    }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert('错误', '群名称不能为空');
      return;
    }

    setSaving(true);
    const success = await updateGroupSettings({ name: editName.trim(), description: editDesc.trim() });
    setSaving(false);
    if (success) {
      setEditModalVisible(false);
    }
  };

  // 管理成员
  const handleSetAdmin = async (memberUserId: string, makeAdmin: boolean) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/api/v1/plaza/groups/${groupId}/members/${memberUserId}/role`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: makeAdmin ? 'admin' : 'member' }),
      });

      const data = await response.json();
      if (data.success) {
        fetchData();
      } else {
        Alert.alert('错误', data.message || '操作失败');
      }
    } catch (error) {
      console.error('Set admin error:', error);
      Alert.alert('错误', '操作失败');
    }
  };

  const handleKickMember = (memberUserId: string, memberName: string) => {
    Alert.alert('确认踢出', `确定要将 ${memberName} 移出群组吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('auth_token');
            const baseUrl = getBaseUrl();

            const response = await fetch(`${baseUrl}/api/v1/plaza/groups/${groupId}/members/${memberUserId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` },
            });

            const data = await response.json();
            if (data.success) {
              fetchData();
            } else {
              Alert.alert('错误', data.message || '操作失败');
            }
          } catch (error) {
            console.error('Kick member error:', error);
            Alert.alert('错误', '操作失败');
          }
        },
      },
    ]);
  };

  // 清除历史记录
  const handleClearHistory = () => {
    Alert.alert('清除历史记录', '确定要清除本群的所有聊天记录吗？此操作不可撤销。', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('auth_token');
            const baseUrl = getBaseUrl();

            const response = await fetch(`${baseUrl}/api/v1/plaza/groups/${groupId}/messages`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` },
            });

            const data = await response.json();
            if (data.success) {
              Alert.alert('成功', '聊天记录已清除');
            } else {
              Alert.alert('错误', data.message || '清除失败');
            }
          } catch (error) {
            console.error('Clear history error:', error);
            Alert.alert('错误', '清除失败');
          }
        },
      },
    ]);
  };

  // 解散/退出
  const handleDismissGroup = () => {
    Alert.alert('解散群组', '确定要解散群组吗？此操作不可撤销。', [
      { text: '取消', style: 'cancel' },
      {
        text: '解散',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('auth_token');
            const baseUrl = getBaseUrl();

            const response = await fetch(`${baseUrl}/api/v1/plaza/groups/${groupId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` },
            });

            const data = await response.json();
            if (data.success) {
              router.back();
            } else {
              Alert.alert('错误', data.message || '解散失败');
            }
          } catch (error) {
            console.error('Dismiss group error:', error);
            Alert.alert('错误', '解散失败');
          }
        },
      },
    ]);
  };

  const handleLeaveGroup = () => {
    Alert.alert('退出群组', '确定要退出该群组吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('auth_token');
            const baseUrl = getBaseUrl();

            const response = await fetch(`${baseUrl}/api/v1/plaza/groups/${groupId}/leave`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
            });

            const data = await response.json();
            if (data.success) {
              router.back();
            } else {
              Alert.alert('错误', data.message || '退出失败');
            }
          } catch (error) {
            console.error('Leave group error:', error);
            Alert.alert('错误', '退出失败');
          }
        },
      },
    ]);
  };

  const getInitial = (name: string) => name?.charAt(0).toUpperCase() || '?';

  const getJoinSettingText = (setting?: string) => {
    switch (setting) {
      case 'free': return '自由加入';
      case 'admin_approval': return '管理员审核';
      case 'invite_only': return '仅邀请';
      default: return '管理员审核';
    }
  };

  const getMessageFrequencyText = (setting?: string) => setting === 'limited' ? '限制' : '不限制';

  const getAutoDeleteText = (autoDelete?: boolean, days?: number) => {
    if (!autoDelete) return '关闭';
    return `${days || 7}天后删除`;
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

  if (!group) {
    return (
      <Screen backgroundColor="#000000" statusBarStyle="light">
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <ThemedText variant="h4" style={styles.headerTitle}>群设置</ThemedText>
        </View>
        <ThemedText style={styles.emptyText}>群组不存在</ThemedText>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor="#000000" statusBarStyle="light">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome6 name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <ThemedText variant="h4" style={styles.headerTitle}>群设置</ThemedText>
        <TouchableOpacity style={styles.shareButton}>
          <FontAwesome6 name="share-from-square" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Group Info Card */}
        <TouchableOpacity style={styles.groupInfoCard} onPress={isOwner ? handleEditGroup : undefined}>
          <TouchableOpacity style={styles.groupAvatarContainer} onPress={isOwner ? handlePickAvatar : undefined}>
            {group.avatarUrl ? (
              <Image source={{ uri: group.avatarUrl }} style={styles.groupAvatarImage} />
            ) : (
              <View style={styles.groupAvatar}>
                <ThemedText style={styles.groupAvatarText}>{getInitial(group.name)}</ThemedText>
              </View>
            )}
            {isOwner && (
              <View style={styles.avatarEditIcon}>
                <FontAwesome6 name="camera" size={10} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.groupInfoContent}>
            <ThemedText variant="h4" style={styles.groupName}>{group.name}</ThemedText>
            <ThemedText variant="small" style={styles.groupMemberCount}>{members.length} 人</ThemedText>
          </View>
          {isOwner && <FontAwesome6 name="chevron-right" size={16} color="#6B7280" />}
        </TouchableOpacity>

        {/* Settings List */}
        <View style={styles.settingsList}>
          {/* 公告 */}
          <TouchableOpacity style={styles.settingItem} onPress={() => canManage && setAnnouncementModalVisible(true)}>
            <ThemedText variant="body" style={styles.settingLabel}>公告</ThemedText>
            <FontAwesome6 name="chevron-right" size={14} color="#6B7280" />
          </TouchableOpacity>

          {/* 查找聊天记录 */}
          <TouchableOpacity style={styles.settingItem}>
            <ThemedText variant="body" style={styles.settingLabel}>查找聊天记录</ThemedText>
            <FontAwesome6 name="chevron-right" size={14} color="#6B7280" />
          </TouchableOpacity>

          {/* AI助手 */}
          <TouchableOpacity style={styles.settingItem} onPress={canManage ? handleOpenAddBot : undefined}>
            <ThemedText variant="body" style={styles.settingLabel}>AI助手</ThemedText>
            <View style={styles.settingRight}>
              {bots.length > 0 && (
                <ThemedText variant="small" style={styles.settingValue}>{bots.length}个</ThemedText>
              )}
              <FontAwesome6 name="chevron-right" size={14} color="#6B7280" />
            </View>
          </TouchableOpacity>

          {/* 进群设置 */}
          {isOwner && (
            <TouchableOpacity style={styles.settingItemWithDesc} onPress={() => setJoinSettingModalVisible(true)}>
              <View style={styles.settingLeft}>
                <ThemedText variant="body" style={styles.settingLabel}>进群设置</ThemedText>
                <ThemedText variant="caption" style={styles.settingDesc}>设置成员加入的条件</ThemedText>
              </View>
              <View style={styles.settingRight}>
                <ThemedText variant="small" style={styles.settingValue}>{getJoinSettingText(group.joinSetting)}</ThemedText>
                <FontAwesome6 name="chevron-right" size={14} color="#6B7280" />
              </View>
            </TouchableOpacity>
          )}

          {/* 发言频率 */}
          {isOwner && (
            <TouchableOpacity style={styles.settingItemWithDesc} onPress={() => setMessageFrequencyModalVisible(true)}>
              <View style={styles.settingLeft}>
                <ThemedText variant="body" style={styles.settingLabel}>发言频率</ThemedText>
                <ThemedText variant="caption" style={styles.settingDesc}>发言频率限制</ThemedText>
              </View>
              <View style={styles.settingRight}>
                <ThemedText variant="small" style={styles.settingValue}>{getMessageFrequencyText(group.messageFrequency)}</ThemedText>
                <FontAwesome6 name="chevron-right" size={14} color="#6B7280" />
              </View>
            </TouchableOpacity>
          )}

          {/* 自动删除 */}
          {isOwner && (
            <TouchableOpacity style={styles.settingItemWithDesc} onPress={() => setAutoDeleteModalVisible(true)}>
              <View style={styles.settingLeft}>
                <ThemedText variant="body" style={styles.settingLabel}>自动删除</ThemedText>
                <ThemedText variant="caption" style={styles.settingDesc}>定时销毁聊天记录</ThemedText>
              </View>
              <View style={styles.settingRight}>
                <ThemedText variant="small" style={styles.settingValue}>{getAutoDeleteText(group.autoDelete, group.autoDeleteDays)}</ThemedText>
                <FontAwesome6 name="chevron-right" size={14} color="#6B7280" />
              </View>
            </TouchableOpacity>
          )}

          {/* 群容量 */}
          <TouchableOpacity style={styles.settingItemWithDesc} onPress={handleOpenCapacity}>
            <View style={styles.settingLeft}>
              <ThemedText variant="body" style={styles.settingLabel}>群容量</ThemedText>
              <ThemedText variant="caption" style={styles.settingDesc}>100人以上需花费AI扩容</ThemedText>
            </View>
            <View style={styles.settingRight}>
              <ThemedText variant="small" style={styles.settingValue}>{members.length}/{group.capacity || 100}</ThemedText>
              <FontAwesome6 name="chevron-right" size={14} color="#6B7280" />
            </View>
          </TouchableOpacity>

          {/* 置顶 */}
          <View style={styles.settingItem}>
            <ThemedText variant="body" style={styles.settingLabel}>置顶</ThemedText>
            <Switch
              value={memberSettings.isPinned}
              onValueChange={(value) => { updateMemberSettings({ isPinned: value }); }}
              trackColor={{ false: '#374151', true: '#F59E0B' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* 消息免打扰 */}
          <View style={styles.settingItem}>
            <ThemedText variant="body" style={styles.settingLabel}>消息免打扰</ThemedText>
            <Switch
              value={memberSettings.isMuted}
              onValueChange={(value) => { updateMemberSettings({ isMuted: value }); }}
              trackColor={{ false: '#374151', true: '#F59E0B' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* 我在本群的昵称 */}
          <TouchableOpacity style={styles.settingItem} onPress={() => setNicknameModalVisible(true)}>
            <ThemedText variant="body" style={styles.settingLabel}>我在本群的昵称</ThemedText>
            <View style={styles.settingRight}>
              {memberSettings.nickname && (
                <ThemedText variant="small" style={styles.settingValue}>{memberSettings.nickname}</ThemedText>
              )}
              <FontAwesome6 name="chevron-right" size={14} color="#6B7280" />
            </View>
          </TouchableOpacity>

          {/* 邀请好友 */}
          {isOwner && (
            <TouchableOpacity style={styles.settingItem} onPress={handleOpenInvite}>
              <ThemedText variant="body" style={styles.settingLabel}>邀请好友</ThemedText>
              <FontAwesome6 name="chevron-right" size={14} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerSection}>
          {isOwner && (
            <TouchableOpacity style={styles.dangerItem} onPress={handleClearHistory}>
              <ThemedText variant="body" style={styles.dangerText}>清除历史记录</ThemedText>
            </TouchableOpacity>
          )}
          {isOwner ? (
            <TouchableOpacity style={styles.dangerItem} onPress={handleDismissGroup}>
              <ThemedText variant="body" style={styles.dangerText}>解散群组</ThemedText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.dangerItem} onPress={handleLeaveGroup}>
              <ThemedText variant="body" style={styles.dangerText}>退出</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* ==================== Modals ==================== */}

      {/* Edit Group Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText variant="h4" style={styles.modalTitle}>编辑群信息</ThemedText>
              <TouchableOpacity style={styles.modalClose} onPress={() => setEditModalVisible(false)}>
                <FontAwesome6 name="xmark" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="群名称"
              placeholderTextColor="#6B7280"
              value={editName}
              onChangeText={setEditName}
              maxLength={50}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="群简介（选填）"
              placeholderTextColor="#6B7280"
              value={editDesc}
              onChangeText={setEditDesc}
              multiline
              maxLength={200}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setEditModalVisible(false)}>
                <ThemedText variant="bodyMedium" style={styles.cancelButtonText}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.submitButton]} onPress={handleSaveEdit} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#000000" /> : <ThemedText variant="bodyMedium" style={styles.submitButtonText}>保存</ThemedText>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Announcement Modal */}
      <Modal visible={announcementModalVisible} transparent animationType="fade" onRequestClose={() => setAnnouncementModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText variant="h4" style={styles.modalTitle}>群公告</ThemedText>
              <TouchableOpacity style={styles.modalClose} onPress={() => setAnnouncementModalVisible(false)}>
                <FontAwesome6 name="xmark" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="输入群公告内容..."
              placeholderTextColor="#6B7280"
              value={announcement}
              onChangeText={setAnnouncement}
              multiline
              maxLength={500}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setAnnouncementModalVisible(false)}>
                <ThemedText variant="bodyMedium" style={styles.cancelButtonText}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.submitButton]} onPress={handleSaveAnnouncement} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#000000" /> : <ThemedText variant="bodyMedium" style={styles.submitButtonText}>保存</ThemedText>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Join Setting Modal */}
      <Modal visible={joinSettingModalVisible} transparent animationType="fade" onRequestClose={() => setJoinSettingModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText variant="h4" style={styles.modalTitle}>进群设置</ThemedText>
              <TouchableOpacity style={styles.modalClose} onPress={() => setJoinSettingModalVisible(false)}>
                <FontAwesome6 name="xmark" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.optionItem, joinSetting === 'free' && styles.optionItemSelected]} onPress={() => setJoinSetting('free')}>
              <ThemedText variant="body" style={[styles.optionText, joinSetting === 'free' && styles.optionTextSelected]}>自由加入</ThemedText>
              {joinSetting === 'free' && <FontAwesome6 name="check" size={16} color="#F59E0B" />}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionItem, joinSetting === 'admin_approval' && styles.optionItemSelected]} onPress={() => setJoinSetting('admin_approval')}>
              <ThemedText variant="body" style={[styles.optionText, joinSetting === 'admin_approval' && styles.optionTextSelected]}>管理员审核</ThemedText>
              {joinSetting === 'admin_approval' && <FontAwesome6 name="check" size={16} color="#F59E0B" />}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionItem, joinSetting === 'invite_only' && styles.optionItemSelected]} onPress={() => setJoinSetting('invite_only')}>
              <ThemedText variant="body" style={[styles.optionText, joinSetting === 'invite_only' && styles.optionTextSelected]}>仅邀请</ThemedText>
              {joinSetting === 'invite_only' && <FontAwesome6 name="check" size={16} color="#F59E0B" />}
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setJoinSettingModalVisible(false)}>
                <ThemedText variant="bodyMedium" style={styles.cancelButtonText}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.submitButton]} onPress={handleSaveJoinSetting} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#000000" /> : <ThemedText variant="bodyMedium" style={styles.submitButtonText}>保存</ThemedText>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Message Frequency Modal */}
      <Modal visible={messageFrequencyModalVisible} transparent animationType="fade" onRequestClose={() => setMessageFrequencyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText variant="h4" style={styles.modalTitle}>发言频率</ThemedText>
              <TouchableOpacity style={styles.modalClose} onPress={() => setMessageFrequencyModalVisible(false)}>
                <FontAwesome6 name="xmark" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.optionItem, messageFrequency === 'unlimited' && styles.optionItemSelected]} onPress={() => setMessageFrequency('unlimited')}>
              <ThemedText variant="body" style={[styles.optionText, messageFrequency === 'unlimited' && styles.optionTextSelected]}>不限制</ThemedText>
              {messageFrequency === 'unlimited' && <FontAwesome6 name="check" size={16} color="#F59E0B" />}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionItem, messageFrequency === 'limited' && styles.optionItemSelected]} onPress={() => setMessageFrequency('limited')}>
              <ThemedText variant="body" style={[styles.optionText, messageFrequency === 'limited' && styles.optionTextSelected]}>限制（每分钟10条）</ThemedText>
              {messageFrequency === 'limited' && <FontAwesome6 name="check" size={16} color="#F59E0B" />}
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setMessageFrequencyModalVisible(false)}>
                <ThemedText variant="bodyMedium" style={styles.cancelButtonText}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.submitButton]} onPress={handleSaveMessageFrequency} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#000000" /> : <ThemedText variant="bodyMedium" style={styles.submitButtonText}>保存</ThemedText>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Auto Delete Modal */}
      <Modal visible={autoDeleteModalVisible} transparent animationType="fade" onRequestClose={() => setAutoDeleteModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText variant="h4" style={styles.modalTitle}>自动删除</ThemedText>
              <TouchableOpacity style={styles.modalClose} onPress={() => setAutoDeleteModalVisible(false)}>
                <FontAwesome6 name="xmark" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.optionItem, !autoDelete && styles.optionItemSelected]} onPress={() => setAutoDelete(false)}>
              <ThemedText variant="body" style={[styles.optionText, !autoDelete && styles.optionTextSelected]}>关闭</ThemedText>
              {!autoDelete && <FontAwesome6 name="check" size={16} color="#F59E0B" />}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionItem, autoDelete && autoDeleteDays === 7 && styles.optionItemSelected]} onPress={() => { setAutoDelete(true); setAutoDeleteDays(7); }}>
              <ThemedText variant="body" style={[styles.optionText, autoDelete && autoDeleteDays === 7 && styles.optionTextSelected]}>7天后删除</ThemedText>
              {autoDelete && autoDeleteDays === 7 && <FontAwesome6 name="check" size={16} color="#F59E0B" />}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionItem, autoDelete && autoDeleteDays === 30 && styles.optionItemSelected]} onPress={() => { setAutoDelete(true); setAutoDeleteDays(30); }}>
              <ThemedText variant="body" style={[styles.optionText, autoDelete && autoDeleteDays === 30 && styles.optionTextSelected]}>30天后删除</ThemedText>
              {autoDelete && autoDeleteDays === 30 && <FontAwesome6 name="check" size={16} color="#F59E0B" />}
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setAutoDeleteModalVisible(false)}>
                <ThemedText variant="bodyMedium" style={styles.cancelButtonText}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.submitButton]} onPress={handleSaveAutoDelete} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#000000" /> : <ThemedText variant="bodyMedium" style={styles.submitButtonText}>保存</ThemedText>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Nickname Modal */}
      <Modal visible={nicknameModalVisible} transparent animationType="fade" onRequestClose={() => setNicknameModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText variant="h4" style={styles.modalTitle}>群昵称</ThemedText>
              <TouchableOpacity style={styles.modalClose} onPress={() => setNicknameModalVisible(false)}>
                <FontAwesome6 name="xmark" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="输入群昵称（选填）"
              placeholderTextColor="#6B7280"
              value={nickname}
              onChangeText={setNickname}
              maxLength={20}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setNicknameModalVisible(false)}>
                <ThemedText variant="bodyMedium" style={styles.cancelButtonText}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.submitButton]} onPress={handleSaveNickname} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#000000" /> : <ThemedText variant="bodyMedium" style={styles.submitButtonText}>保存</ThemedText>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Capacity Expand Modal */}
      <Modal visible={capacityModalVisible} transparent animationType="fade" onRequestClose={() => setCapacityModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText variant="h4" style={styles.modalTitle}>群容量扩容</ThemedText>
              <TouchableOpacity style={styles.modalClose} onPress={() => setCapacityModalVisible(false)}>
                <FontAwesome6 name="xmark" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.capacityInfo}>
              <View style={styles.capacityInfoRow}>
                <ThemedText variant="body" style={styles.capacityInfoLabel}>当前成员</ThemedText>
                <ThemedText variant="h4" style={styles.capacityInfoValue}>{members.length}/{group?.capacity || 100}</ThemedText>
              </View>
              <View style={styles.capacityInfoRow}>
                <ThemedText variant="body" style={styles.capacityInfoLabel}>AI余额</ThemedText>
                <ThemedText variant="body" style={styles.capacityInfoValue}>{parseFloat(araBalance).toFixed(2)} AI</ThemedText>
              </View>
            </View>

            <ThemedText variant="small" style={styles.sectionLabel}>扩容数量（最小100人）</ThemedText>
            <View style={styles.expandAmountRow}>
              <TouchableOpacity 
                style={styles.amountButton} 
                onPress={() => setExpandAmount(Math.max(100, expandAmount - 100))}
              >
                <FontAwesome6 name="minus" size={16} color="#F59E0B" />
              </TouchableOpacity>
              <TextInput
                style={styles.expandAmountInput}
                placeholder="100"
                placeholderTextColor="#6B7280"
                value={String(expandAmount)}
                onChangeText={(text) => setExpandAmount(Math.max(100, parseInt(text) || 100))}
                keyboardType="number-pad"
              />
              <TouchableOpacity 
                style={styles.amountButton} 
                onPress={() => setExpandAmount(expandAmount + 100)}
              >
                <FontAwesome6 name="plus" size={16} color="#F59E0B" />
              </TouchableOpacity>
            </View>

            <View style={styles.capacityCostInfo}>
              <ThemedText variant="caption" style={styles.capacityCostText}>
                扩容费用：{(expandAmount / 100) * parseFloat(capacityConfig.pricePerHundred)} AI
              </ThemedText>
              <ThemedText variant="caption" style={styles.capacityCostHint}>
                每100人 {capacityConfig.pricePerHundred} AI
              </ThemedText>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setCapacityModalVisible(false)}>
                <ThemedText variant="bodyMedium" style={styles.cancelButtonText}>取消</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.submitButton]} onPress={handleExpandCapacity} disabled={expanding}>
                {expanding ? <ActivityIndicator size="small" color="#000000" /> : <ThemedText variant="bodyMedium" style={styles.submitButtonText}>确认扩容</ThemedText>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Bot Modal */}
      <Modal visible={addBotModalVisible} transparent animationType="fade" onRequestClose={() => setAddBotModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText variant="h4" style={styles.modalTitle}>AI助手</ThemedText>
              <TouchableOpacity style={styles.modalClose} onPress={() => setAddBotModalVisible(false)}>
                <FontAwesome6 name="xmark" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            {loadingBots ? (
              <ActivityIndicator size="large" color="#F59E0B" style={{ marginVertical: 40 }} />
            ) : (
              <>
                {availableBots.length > 0 && (
                  <>
                    <ThemedText variant="small" style={styles.sectionLabel}>可添加</ThemedText>
                    <FlatList
                      data={availableBots}
                      keyExtractor={(item) => item.id}
                      style={{ maxHeight: 200 }}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={styles.botOption} onPress={() => handleAddBot(item.id)}>
                          <View style={styles.botOptionIcon}>
                            <FontAwesome6 name="robot" size={24} color="#F59E0B" />
                          </View>
                          <View style={styles.botOptionInfo}>
                            <ThemedText variant="body" style={styles.botOptionName}>{item.name}</ThemedText>
                            <ThemedText variant="caption" style={styles.botOptionDesc}>{item.description || '暂无描述'}</ThemedText>
                          </View>
                          <FontAwesome6 name="plus" size={16} color="#F59E0B" />
                        </TouchableOpacity>
                      )}
                    />
                  </>
                )}
                {bots.length > 0 && (
                  <>
                    <ThemedText variant="small" style={styles.sectionLabel}>已添加</ThemedText>
                    {bots.map((bot) => (
                      <TouchableOpacity key={bot.id} style={styles.botOption} onPress={canManage ? () => handleRemoveBot(bot.id, bot.name) : undefined}>
                        <View style={styles.botOptionIcon}>
                          <FontAwesome6 name="robot" size={24} color="#22C55E" />
                        </View>
                        <View style={styles.botOptionInfo}>
                          <ThemedText variant="body" style={styles.botOptionName}>{bot.name}</ThemedText>
                          <ThemedText variant="caption" style={styles.botOptionDesc}>触发词: {bot.triggerKeywords?.slice(0, 3).join('、') || '无'}</ThemedText>
                        </View>
                        {canManage && <FontAwesome6 name="trash" size={16} color="#EF4444" />}
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Invite Friends Modal */}
      <Modal visible={inviteModalVisible} transparent animationType="fade" onRequestClose={() => setInviteModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText variant="h4" style={styles.modalTitle}>邀请好友进群</ThemedText>
              <TouchableOpacity style={styles.modalClose} onPress={() => setInviteModalVisible(false)}>
                <FontAwesome6 name="xmark" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            {loadingFriends ? (
              <ActivityIndicator size="large" color="#F59E0B" style={{ marginVertical: 40 }} />
            ) : friends.length === 0 ? (
              <View style={styles.emptyModal}>
                <FontAwesome6 name="users" size={40} color="#6B7280" />
                <ThemedText variant="body" style={styles.emptyModalText}>暂无可邀请的好友</ThemedText>
              </View>
            ) : (
              <>
                <ThemedText variant="caption" style={styles.selectedCount}>已选择 {selectedFriends.size} 人</ThemedText>
                <FlatList
                  data={friends}
                  keyExtractor={(item) => item.friendId}
                  style={{ maxHeight: 350 }}
                  renderItem={({ item }) => {
                    const isSelected = selectedFriends.has(item.friendId);
                    return (
                      <TouchableOpacity style={[styles.friendOption, isSelected && styles.friendOptionSelected]} onPress={() => toggleFriendSelection(item.friendId)}>
                        <View style={styles.friendAvatar}>
                          <ThemedText style={styles.friendAvatarText}>{getInitial(item.friendName)}</ThemedText>
                        </View>
                        <ThemedText variant="body" style={styles.friendName}>{item.friendName}</ThemedText>
                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                          {isSelected && <FontAwesome6 name="check" size={12} color="#000000" />}
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setInviteModalVisible(false)}>
                    <ThemedText variant="bodyMedium" style={styles.cancelButtonText}>取消</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalButton, styles.submitButton, selectedFriends.size === 0 && styles.disabledButton]} onPress={handleInviteFriends} disabled={selectedFriends.size === 0 || inviting}>
                    {inviting ? <ActivityIndicator size="small" color="#000000" /> : <ThemedText variant="bodyMedium" style={styles.submitButtonText}>邀请 ({selectedFriends.size})</ThemedText>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
