import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Link } from 'expo-router';
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

interface Message {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType: 'text' | 'red_packet' | 'system';
  redPacket?: {
    amount: string;
    message: string;
    claimed: boolean;
  };
  createdAt: string;
}

export default function ChatScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // 动态路由参数直接从 URL 路径获取
  const { groupId, name } = useLocalSearchParams<{ groupId: string; name?: string }>();
  const router = useSafeRouter();
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [groupName, setGroupName] = useState(name || '群聊');
  const [memberCount, setMemberCount] = useState(0);

  const fetchMessages = useCallback(async () => {
    if (!groupId) return;

    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      // 获取消息
      const messagesResponse = await fetch(
        `${baseUrl}/api/v1/plaza/groups/${groupId}/messages`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      const messagesData = await messagesResponse.json();
      console.log('[Chat] Messages response:', JSON.stringify(messagesData).slice(0, 500));
      
      if (messagesData.success) {
        // 后端返回的字段是 message，转换为 content
        const formattedMessages = (messagesData.data || []).map((msg: any) => ({
          id: msg.id,
          groupId: groupId,
          senderId: msg.senderId,
          senderName: msg.senderType === 'system' ? '系统' : (msg.senderName || '未知用户'),
          content: msg.message || msg.content || '',
          messageType: msg.messageType || 'text',
          redPacket: msg.extraData?.redPacket,
          createdAt: msg.createdAt,
        }));
        setMessages(formattedMessages);
      }

      // 获取群组信息（成员数量）
      const settingsResponse = await fetch(
        `${baseUrl}/api/v1/plaza/groups/${groupId}/settings`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      const settingsData = await settingsResponse.json();
      if (settingsData.success) {
        setGroupName(settingsData.data?.group?.name || groupName);
        setMemberCount(settingsData.data?.group?.memberCount || 0);
      }
    } catch (error) {
      console.error('Fetch messages error:', error);
    } finally {
      setLoading(false);
    }
  }, [groupId, groupName]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || sending) return;

    setSending(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      console.log('[Chat] Sending message to group:', groupId);

      const response = await fetch(
        `${baseUrl}/api/v1/plaza/groups/${groupId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: inputText.trim(),
            messageType: 'text',
          }),
        }
      );

      const data = await response.json();
      console.log('[Chat] Send response:', JSON.stringify(data));
      
      if (data.success) {
        setInputText('');
        fetchMessages();
      } else {
        console.error('[Chat] Send failed:', data.message);
      }
    } catch (error) {
      console.error('Send message error:', error);
    } finally {
      setSending(false);
    }
  };

  const handleClaimRedPacket = async (messageId: string) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      const response = await fetch(
        `${baseUrl}/api/v1/plaza/red-packet/${messageId}/claim`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      const data = await response.json();
      if (data.success) {
        fetchMessages();
        // 可以显示抢到的金额
      }
    } catch (error) {
      console.error('Claim red packet error:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.senderId === user?.id;
    const isRedPacket = item.messageType === 'red_packet';
    const isSystem = item.messageType === 'system';

    if (isSystem) {
      return (
        <View style={[styles.messageContainer, { alignItems: 'center' }]}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
            <ThemedText variant="small" style={{ color: '#9CA3AF' }}>
              {item.content}
            </ThemedText>
          </View>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {!isMyMessage && (
          <ThemedText variant="caption" style={styles.senderName}>
            {item.senderName}
          </ThemedText>
        )}

        {isRedPacket && item.redPacket ? (
          <TouchableOpacity
            style={[
              styles.redPacketCard,
              item.redPacket.claimed && styles.redPacketClaimed,
            ]}
            onPress={() => !item.redPacket?.claimed && handleClaimRedPacket(item.id)}
            disabled={item.redPacket.claimed}
          >
            <View style={styles.redPacketIcon}>
              <FontAwesome6 name="envelope" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.redPacketInfo}>
              <ThemedText variant="smallMedium" style={styles.redPacketTitle}>
                {item.redPacket.message || '恭喜发财，大吉大利'}
              </ThemedText>
              <ThemedText variant="caption" style={styles.redPacketDesc}>
                {item.redPacket.claimed ? '已领取' : '点击领取'}
              </ThemedText>
            </View>
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.messageBubble,
              isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
            ]}
          >
            <ThemedText
              variant="body"
              style={[
                styles.messageText,
                isMyMessage ? styles.myMessageText : styles.otherMessageText,
              ]}
            >
              {item.content}
            </ThemedText>
          </View>
        )}

        <ThemedText variant="tiny" style={styles.messageTime}>
          {formatTime(item.createdAt)}
        </ThemedText>
      </View>
    );
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
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <ThemedText variant="bodyMedium" style={styles.headerTitle}>
              {groupName}
            </ThemedText>
            {memberCount > 0 && (
              <ThemedText variant="caption" style={styles.memberCount}>
                {memberCount} 人
              </ThemedText>
            )}
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/red-packet/send', { groupId })}
            >
              <FontAwesome6 name="envelope" size={20} color="#F59E0B" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => router.push(`/group-settings/${groupId}` as `/${string}`)}
            >
              <FontAwesome6 name="ellipsis-vertical" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          inverted={false}
        />

        {/* Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="输入消息..."
              placeholderTextColor="#6B7280"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <FontAwesome6 name="paper-plane" size={18} color="#000000" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
