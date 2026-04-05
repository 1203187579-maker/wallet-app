import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 导入翻译文件
import zhCN from './translations/zh-CN';
import enUS from './translations/en-US';
import jaJP from './translations/ja-JP';
import koKR from './translations/ko-KR';
import hiIN from './translations/hi-IN';

// 语言配置
export const translations = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'ja-JP': jaJP,
  'ko-KR': koKR,
  'hi-IN': hiIN,
};

// 语言名称映射
export const languageNames: Record<string, { nativeName: string; englishName: string }> = {
  'zh-CN': { nativeName: '中文', englishName: 'Chinese' },
  'en-US': { nativeName: 'English', englishName: 'English' },
  'ja-JP': { nativeName: '日本語', englishName: 'Japanese' },
  'ko-KR': { nativeName: '한국어', englishName: 'Korean' },
  'hi-IN': { nativeName: 'हिन्दी', englishName: 'Hindi' },
};

// 支持的语言列表
export const supportedLanguages = Object.keys(translations);

// 默认语言
export const defaultLanguage = 'zh-CN';

// 创建 I18n 实例
const i18n = new I18n(translations);
// 设置默认语言
i18n.locale = defaultLanguage;
i18n.defaultLocale = defaultLanguage;

// 获取系统语言
function getSystemLanguage(): string {
  const locales = getLocales();
  if (locales && locales.length > 0) {
    const locale = locales[0].languageTag || locales[0].languageCode || '';
    // 匹配支持的语言
    if (locale.startsWith('zh')) return 'zh-CN';
    if (locale.startsWith('en')) return 'en-US';
    if (locale.startsWith('ja')) return 'ja-JP';
    if (locale.startsWith('ko')) return 'ko-KR';
    if (locale.startsWith('hi')) return 'hi-IN';
  }
  return defaultLanguage;
}

// 存储键
const LANGUAGE_STORAGE_KEY = '@app_language';

// 初始化语言设置
export async function initLanguage(): Promise<string> {
  try {
    // 先尝试从存储中读取用户设置的语言
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage && supportedLanguages.includes(savedLanguage)) {
      i18n.locale = savedLanguage;
      return savedLanguage;
    }
  } catch (error) {
    console.error('Failed to load saved language:', error);
  }

  // 默认使用中文（不再跟随系统语言）
  i18n.locale = defaultLanguage;
  return defaultLanguage;
}

// 设置语言
export async function setLanguage(locale: string): Promise<void> {
  if (!supportedLanguages.includes(locale)) {
    console.warn(`Language ${locale} is not supported`);
    return;
  }

  i18n.locale = locale;
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
}

// 获取当前语言
export function getCurrentLanguage(): string {
  return i18n.locale;
}

// 翻译函数
export function t(key: string, options?: Record<string, any>): string {
  return i18n.t(key, options);
}

// 导出 i18n 实例供 Hook 使用
export { i18n };
