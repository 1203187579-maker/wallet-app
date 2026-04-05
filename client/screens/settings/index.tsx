import React, { useMemo } from 'react';
import { 
  ScrollView, 
  View, 
  TouchableOpacity,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, useTranslationState } from '@/hooks/useTranslation';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { languageNames, supportedLanguages } from '@/i18n';
import { createStyles } from './styles';

export default function SettingsScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { locale, setLocale } = useTranslationState();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();

  const handleLanguageSelect = async (lang: string) => {
    await setLocale(lang);
  };

  const languageOptions = supportedLanguages.map(lang => ({
    code: lang,
    name: languageNames[lang]?.nativeName || lang,
    englishName: languageNames[lang]?.englishName || lang,
  }));

  return (
    <Screen backgroundColor="#000000" statusBarStyle="light">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <ThemedText variant="h3" style={styles.headerTitle}>
            {t('settings.title')}
          </ThemedText>
        </View>

        {/* Language Section */}
        <View style={styles.section}>
          <ThemedText variant="caption" style={styles.sectionTitle}>
            {t('language.title')}
          </ThemedText>
          <View style={styles.card}>
            {languageOptions.map((option, index) => (
              <TouchableOpacity
                key={option.code}
                style={[
                  styles.menuItem,
                  index === languageOptions.length - 1 && styles.menuItemLast,
                ]}
                onPress={() => handleLanguageSelect(option.code)}
              >
                <View style={styles.menuLeft}>
                  <View style={styles.menuIcon}>
                    <FontAwesome6 
                      name={option.code === 'zh-CN' ? 'language' : 'globe'} 
                      size={16} 
                      color="#F59E0B" 
                    />
                  </View>
                  <View>
                    <ThemedText variant="smallMedium" style={styles.menuText}>
                      {option.name}
                    </ThemedText>
                    <ThemedText variant="caption" style={{ color: '#6B7280', marginTop: 2 }}>
                      {option.englishName}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.menuRight}>
                  {locale === option.code && (
                    <FontAwesome6 name="check" size={18} color="#F59E0B" style={styles.checkIcon} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Version */}
        <ThemedText variant="caption" style={styles.versionText}>
          {t('profile.version')} 1.0.0
        </ThemedText>
      </ScrollView>
    </Screen>
  );
}
