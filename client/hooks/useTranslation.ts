import { useState, useEffect, useCallback } from 'react';
import { i18n, setLanguage, getCurrentLanguage, initLanguage, supportedLanguages, languageNames } from '@/i18n';
import { defaultLanguage } from '@/i18n';

// 全局状态
let globalLocale = defaultLanguage;
const listeners: Set<(locale: string) => void> = new Set();

function notifyListeners(locale: string) {
  globalLocale = locale;
  listeners.forEach(listener => listener(locale));
}

interface UseTranslationReturn {
  t: (key: string, options?: Record<string, any>) => string;
  locale: string;
  setLocale: (locale: string) => Promise<void>;
  supportedLanguages: string[];
  languageNames: Record<string, { nativeName: string; englishName: string }>;
}

export function useTranslation(): UseTranslationReturn {
  const [locale, setLocaleState] = useState<string>(defaultLanguage);

  useEffect(() => {
    // 初始化语言（默认中文，或读取用户保存的语言）
    initLanguage().then((lang) => {
      globalLocale = lang;
      setLocaleState(lang);
    });

    // 订阅语言变化
    listeners.add(setLocaleState);

    return () => {
      listeners.delete(setLocaleState);
    };
  }, []);

  const handleSetLocale = useCallback(async (newLocale: string) => {
    await setLanguage(newLocale);
    notifyListeners(newLocale);
  }, []);

  const t = useCallback((key: string, options?: Record<string, any>): string => {
    return i18n.t(key, options);
  }, [locale]);

  return {
    t,
    locale,
    setLocale: handleSetLocale,
    supportedLanguages,
    languageNames,
  };
}

// 状态 Hook - 用于需要响应语言变化的组件
export function useTranslationState() {
  const [locale, setLocaleState] = useState<string>(defaultLanguage);

  useEffect(() => {
    initLanguage().then((lang) => {
      globalLocale = lang;
      setLocaleState(lang);
    });

    // 订阅语言变化
    listeners.add(setLocaleState);

    return () => {
      listeners.delete(setLocaleState);
    };
  }, []);

  const setLocale = useCallback(async (newLocale: string) => {
    await setLanguage(newLocale);
    notifyListeners(newLocale);
  }, []);

  return {
    locale,
    setLocale,
  };
}
