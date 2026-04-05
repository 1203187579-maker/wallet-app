import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';

export default function TabLayout() {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: '#000000',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        height: Platform.OS === 'web' ? 60 : 50 + insets.bottom,
        paddingBottom: Platform.OS === 'web' ? 0 : insets.bottom,
      },
      tabBarActiveTintColor: '#F59E0B',
      tabBarInactiveTintColor: '#6B7280',
      tabBarItemStyle: {
        height: Platform.OS === 'web' ? 60 : undefined,
      },
      tabBarLabelStyle: {
        fontSize: 10,
        fontWeight: '500',
      },
    }}>
      {/* 行情 - 首页 */}
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.market'),
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="chart-line" size={20} color={color} />
          ),
        }}
      />
      {/* 质押 */}
      <Tabs.Screen
        name="stake"
        options={{
          title: t('tabs.stake'),
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="leaf" size={20} color={color} />
          ),
        }}
      />
      {/* C2C */}
      <Tabs.Screen
        name="c2c"
        options={{
          title: t('tabs.c2c'),
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="arrow-right-arrow-left" size={20} color={color} />
          ),
        }}
      />
      {/* 我的 */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="user" size={20} color={color} />
          ),
        }}
      />
      {/* ARA广场 - 隐藏Tab，通过首页入口访问 */}
      <Tabs.Screen
        name="plaza"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
