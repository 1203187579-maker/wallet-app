import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { 
  ScrollView, 
  View, 
  TouchableOpacity, 
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { getBaseUrl } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStyles } from './styles';

type AnnouncementType = 'announcement' | 'intro' | 'tutorial';

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  created_at: string;
}

export default function AnnouncementsScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState<AnnouncementType | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();
      
      const response = await fetch(`${baseUrl}/api/v1/announcements`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      const data = await response.json();
      if (data.success) {
        const list = data.data || [];
        setAnnouncements(list);
        
        // 标记所有公告为已读
        if (list.length > 0) {
          const readIdsStr = await AsyncStorage.getItem('read_announcement_ids');
          const readIds = readIdsStr ? JSON.parse(readIdsStr) : [];
          const allIds = list.map((item: Announcement) => item.id);
          const newReadIds = [...new Set([...readIds, ...allIds])];
          await AsyncStorage.setItem('read_announcement_ids', JSON.stringify(newReadIds));
        }
      }
    } catch (error) {
      console.error('Fetch announcements error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAnnouncements();
    }, [fetchAnnouncements])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnnouncements();
  };

  const filteredAnnouncements = useMemo(() => {
    if (selectedType === 'all') return announcements;
    return announcements.filter(a => a.type === selectedType);
  }, [announcements, selectedType]);

  const getTypeInfo = (type: AnnouncementType) => {
    switch (type) {
      case 'announcement':
        return { icon: 'bullhorn', color: '#F59E0B', label: t('announcements.types.announcement') || '公告' };
      case 'intro':
        return { icon: 'book-open', color: '#3B82F6', label: t('announcements.types.intro') || '平台介绍' };
      case 'tutorial':
        return { icon: 'circle-question', color: '#10B981', label: t('announcements.types.tutorial') || '教程' };
      default:
        return { icon: 'file-lines', color: '#6B7280', label: type };
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome6 name="arrow-left" size={18} color="#FFFFFF" />
        </TouchableOpacity>
        <ThemedText variant="h3" style={styles.headerTitle}>
          {t('announcements.title') || '公告中心'}
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {/* Type Filter */}
      <View style={styles.filterRow}>
        <TouchableOpacity 
          style={[styles.filterBtn, selectedType === 'all' && styles.filterBtnActive]}
          onPress={() => setSelectedType('all')}
        >
          <ThemedText variant="small" style={[styles.filterText, selectedType === 'all' && styles.filterTextActive]}>
            {t('announcements.all') || '全部'}
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterBtn, selectedType === 'announcement' && styles.filterBtnActive]}
          onPress={() => setSelectedType('announcement')}
        >
          <ThemedText variant="small" style={[styles.filterText, selectedType === 'announcement' && styles.filterTextActive]}>
            {t('announcements.types.announcement') || '公告'}
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterBtn, selectedType === 'intro' && styles.filterBtnActive]}
          onPress={() => setSelectedType('intro')}
        >
          <ThemedText variant="small" style={[styles.filterText, selectedType === 'intro' && styles.filterTextActive]}>
            {t('announcements.types.intro') || '介绍'}
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterBtn, selectedType === 'tutorial' && styles.filterBtnActive]}
          onPress={() => setSelectedType('tutorial')}
        >
          <ThemedText variant="small" style={[styles.filterText, selectedType === 'tutorial' && styles.filterTextActive]}>
            {t('announcements.types.tutorial') || '教程'}
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
        {filteredAnnouncements.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome6 name="inbox" size={48} color="#4B5563" />
            <ThemedText variant="small" style={styles.emptyText}>
              {t('announcements.empty') || '暂无公告'}
            </ThemedText>
          </View>
        ) : (
          filteredAnnouncements.map((item) => {
            const typeInfo = getTypeInfo(item.type);
            const isExpanded = expandedId === item.id;
            
            return (
              <TouchableOpacity 
                key={item.id} 
                style={styles.card}
                onPress={() => setExpandedId(isExpanded ? null : item.id)}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.typeTag, { backgroundColor: `${typeInfo.color}20` }]}>
                    <FontAwesome6 name={typeInfo.icon as any} size={12} color={typeInfo.color} />
                    <ThemedText variant="tiny" style={[styles.typeText, { color: typeInfo.color }]}>
                      {typeInfo.label}
                    </ThemedText>
                  </View>
                  <ThemedText variant="caption" style={styles.dateText}>
                    {formatDate(item.created_at)}
                  </ThemedText>
                </View>
                
                <ThemedText variant="smallMedium" style={styles.cardTitle}>
                  {item.title}
                </ThemedText>
                
                {isExpanded && (
                  <View style={styles.cardContent}>
                    <ThemedText variant="small" style={styles.contentText}>
                      {item.content}
                    </ThemedText>
                  </View>
                )}
                
                <View style={styles.cardFooter}>
                  <ThemedText variant="tiny" style={styles.expandHint}>
                    {isExpanded ? (t('common.collapse') || '收起') : (t('common.expand') || '展开')}
                  </ThemedText>
                  <FontAwesome6 
                    name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                    size={12} 
                    color="#6B7280" 
                  />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
