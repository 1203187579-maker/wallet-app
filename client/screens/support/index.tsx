import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
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

interface Message {
  id: string;
  senderType: 'user' | 'admin' | 'ai';
  senderId?: string;
  message: string;
  messageType: string;
  isRead: boolean;
  createdAt: string;
}

export default function SupportScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);

  const fetchMessages = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/api/v1/support/messages`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setMessages(data.data || []);
        // 标记已读
        markAsRead();
      }
    } catch (error) {
      console.error('Fetch messages error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const markAsRead = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      await fetch(`${baseUrl}/api/v1/support/mark-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Mark read error:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMessages();
    }, [fetchMessages])
  );

  useEffect(() => {
    // 滚动到底部
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMessages();
  };

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/api/v1/support/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: messageText }),
      });

      const data = await response.json();
      if (data.success) {
        if (data.data.aiReplied && data.data.allMessages) {
          // AI已回复，显示AI正在输入
          setAiTyping(true);
          setTimeout(() => {
            setMessages(data.data.allMessages);
            setAiTyping(false);
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }, 500);
        } else {
          // 没有AI回复，只显示用户消息
          setMessages(prev => [...prev, data.data.message]);
        }
      }
    } catch (error) {
      console.error('Send message error:', error);
    } finally {
      setSending(false);
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

  const getSenderLabel = (senderType: string) => {
    switch (senderType) {
      case 'ai':
        return 'AI助手';
      case 'admin':
        return '客服';
      default:
        return '';
    }
  };

  const renderMessage = (msg: Message, index: number) => {
    const isUser = msg.senderType === 'user';
    const showSender = !isUser;

    return (
      <View
        key={msg.id}
        style={[
          styles.messageWrapper,
          isUser ? styles.userMessageWrapper : styles.otherMessageWrapper,
        ]}
      >
        {showSender && (
          <ThemedText variant="tiny" style={styles.senderLabel}>
            {getSenderLabel(msg.senderType)}
          </ThemedText>
        )}
        <View
          style={[
            styles.messageBubble,
            isUser
              ? styles.userBubble
              : msg.senderType === 'admin'
              ? styles.adminBubble
              : styles.aiBubble,
          ]}
        >
          <ThemedText
            variant="small"
            style={[
              styles.messageText,
              isUser ? styles.userMessageText : styles.otherMessageText,
            ]}
          >
            {msg.message}
          </ThemedText>
        </View>
        <ThemedText variant="tiny" style={styles.timeText}>
          {formatTime(msg.createdAt)}
        </ThemedText>
      </View>
    );
  };

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <ThemedText variant="h4">客服中心</ThemedText>
          </View>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <ThemedText variant="tiny" style={styles.statusText}>在线</ThemedText>
          </View>
        </View>

        {/* Messages */}
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <FontAwesome6 name="headset" size={36} color={theme.primary} />
            </View>
            <ThemedText variant="h4" style={styles.emptyTitle}>
              欢迎来到客服中心
            </ThemedText>
            <ThemedText variant="small" color={theme.textSecondary} style={styles.emptyText}>
              有任何问题都可以向我们咨询，\n我们会尽快为您解答
            </ThemedText>
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.primary}
              />
            }
          >
            {messages.map(renderMessage)}
            {aiTyping && (
              <View style={[styles.messageWrapper, styles.otherMessageWrapper]}>
                <ThemedText variant="tiny" style={styles.senderLabel}>
                  AI助手
                </ThemedText>
                <View style={[styles.messageBubble, styles.aiBubble]}>
                  <View style={styles.typingIndicator}>
                    <ActivityIndicator size="small" color={theme.textMuted} />
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="输入消息..."
              placeholderTextColor={theme.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!sending}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <FontAwesome6 name="paper-plane" size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
