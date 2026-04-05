import React, { useMemo, useState } from 'react';
import { 
  View, 
  TouchableOpacity, 
  TextInput, 
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/AuthContext';
import { createStyles } from './styles';
import { showAlert, alert } from '@/utils/alert';

type WalletMode = 'select' | 'create' | 'import' | 'backup';

export default function LoginScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { walletCreate, walletImport } = useAuth();
  
  const [mode, setMode] = useState<WalletMode>('select');
  const [mnemonic, setMnemonic] = useState('');
  const [importMnemonic, setImportMnemonic] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [importType, setImportType] = useState<'mnemonic' | 'privateKey'>('mnemonic');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [backupConfirmChecked, setBackupConfirmChecked] = useState(false);

  const handleCreateWallet = async () => {
    setError('');
    setSubmitting(true);
    
    try {
      // 调用后端创建钱包
      const result = await walletCreate(password, referralCode || undefined);
      
      if (result.success && result.mnemonic) {
        setMnemonic(result.mnemonic);
        setMode('backup');
      } else {
        setError(result.error || '创建钱包失败');
      }
    } catch (err: any) {
      setError(err.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackupConfirm = () => {
    if (!backupConfirmChecked) {
      showAlert(t('common.notice'), t('auth.backupConfirm'));
      return;
    }
    // 备份确认后进入首页
    router.replace('/');
  };

  const handleImport = async () => {
    setError('');
    
    const key = importType === 'mnemonic' ? importMnemonic : privateKey;
    if (!key.trim()) {
      setError(importType === 'mnemonic' ? '请输入助记词' : '请输入私钥');
      return;
    }
    if (!password.trim()) {
      setError('请输入钱包密码');
      return;
    }

    setSubmitting(true);
    try {
      const result = await walletImport({
        mnemonic: importType === 'mnemonic' ? importMnemonic : undefined,
        private_key: importType === 'privateKey' ? privateKey : undefined,
        password,
      });
      
      if (result.success) {
        router.replace('/');
      } else {
        setError(result.error || '导入失败');
      }
    } catch (err: any) {
      setError(err.message || '导入失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 选择模式
  const renderSelectMode = () => (
    <View style={styles.selectContainer}>
      <View style={styles.logoContainer}>
        <View style={styles.logoIcon}>
          <FontAwesome6 name="rocket" size={40} color={theme.primary} />
        </View>
        <ThemedText variant="h2" color={theme.textPrimary} style={styles.logoText}>
          BoostAra
        </ThemedText>
        <ThemedText variant="label" color={theme.textMuted}>
          {t('auth.appSubtitle')}
        </ThemedText>
      </View>

      <View style={styles.buttonGroup}>
        <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={() => setMode('create')}
        >
          <FontAwesome6 name="plus-circle" size={20} color={theme.buttonPrimaryText} style={styles.buttonIcon} />
          <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
            {t('auth.createWallet')}
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => setMode('import')}>
          <FontAwesome6 name="arrow-right-to-bracket" size={20} color={theme.primary} style={styles.buttonIcon} />
          <ThemedText variant="smallMedium" color={theme.primary}>
            {t('auth.importWallet')}
          </ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <ThemedText variant="caption" color={theme.textMuted}>
          {t('auth.firstTimeHint')}
        </ThemedText>
      </View>
    </View>
  );

  // 备份助记词
  const renderBackupMode = () => (
    <View style={styles.backupContainer}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => setMode('select')}>
          <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
        </TouchableOpacity>
        <ThemedText variant="title" color={theme.textPrimary}>{t('auth.backupMnemonic')}</ThemedText>
        <View style={{ width: 20 }} />
      </View>

      <View style={styles.warningCard}>
        <FontAwesome6 name="triangle-exclamation" size={24} color={theme.primary} />
        <ThemedText variant="small" color={theme.textSecondary} style={styles.warningText}>
          {t('auth.backupWarning')}
        </ThemedText>
      </View>

      <View style={styles.mnemonicCard}>
        <ThemedText variant="caption" color={theme.textMuted} style={styles.mnemonicLabel}>
          {t('auth.mnemonicLabel')}
        </ThemedText>
        <View style={styles.mnemonicWords}>
          {mnemonic.split(' ').map((word, index) => (
            <View key={index} style={styles.wordChip}>
              <ThemedText variant="caption" color={theme.textMuted}>{index + 1}.</ThemedText>
              <ThemedText variant="smallMedium" color={theme.textPrimary}>{word}</ThemedText>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity 
        style={styles.checkboxRow} 
        onPress={() => setBackupConfirmChecked(!backupConfirmChecked)}
      >
        <View style={[styles.checkbox, backupConfirmChecked && styles.checkboxChecked]}>
          {backupConfirmChecked && (
            <FontAwesome6 name="check" size={12} color={theme.buttonPrimaryText} />
          )}
        </View>
        <ThemedText variant="small" color={theme.textSecondary}>
          {t('auth.backupConfirmed')}
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.primaryButton, !backupConfirmChecked && styles.buttonDisabled]} 
        onPress={handleBackupConfirm}
      >
        <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
          {t('auth.enterWallet')}
        </ThemedText>
      </TouchableOpacity>
    </View>
  );

  // 创建钱包（设置密码）
  const renderCreateMode = () => (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        contentContainerStyle={styles.formContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => setMode('select')}>
            <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <ThemedText variant="title" color={theme.textPrimary}>{t('auth.createWallet')}</ThemedText>
          <View style={{ width: 20 }} />
        </View>

        <View style={styles.formCard}>
          <ThemedText variant="label" color={theme.textSecondary} style={styles.formLabel}>
            {t('auth.setWalletPassword')}
          </ThemedText>

          <View style={styles.inputGroup}>
            <View style={styles.inputWrapper}>
              <FontAwesome6 name="lock" size={16} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.passwordPlaceholder')}
                placeholderTextColor={theme.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <View style={styles.inputWrapper}>
              <FontAwesome6 name="lock" size={16} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.confirmPassword')}
                placeholderTextColor={theme.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>

            <View style={styles.inputWrapper}>
              <FontAwesome6 name="user-plus" size={16} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.referralCodeOptional')}
                placeholderTextColor={theme.textMuted}
                value={referralCode}
                onChangeText={setReferralCode}
                autoCapitalize="characters"
              />
            </View>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <FontAwesome6 name="circle-exclamation" size={14} color={theme.error} />
              <ThemedText variant="caption" color={theme.error} style={styles.errorText}>
                {error}
              </ThemedText>
            </View>
          ) : null}

          <TouchableOpacity 
            style={[styles.primaryButton, submitting && styles.buttonDisabled]}
            onPress={handleCreateWallet}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={theme.buttonPrimaryText} />
            ) : (
              <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
                {t('auth.createWallet')}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // 导入钱包
  const renderImportMode = () => (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        contentContainerStyle={styles.formContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => setMode('select')}>
            <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <ThemedText variant="title" color={theme.textPrimary}>{t('auth.importWallet')}</ThemedText>
          <View style={{ width: 20 }} />
        </View>

        {/* 导入方式选择 */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, importType === 'mnemonic' && styles.tabActive]}
            onPress={() => setImportType('mnemonic')}
          >
            <ThemedText 
              variant="smallMedium" 
              color={importType === 'mnemonic' ? theme.primary : theme.textMuted}
            >
              {t('auth.mnemonic')}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, importType === 'privateKey' && styles.tabActive]}
            onPress={() => setImportType('privateKey')}
          >
            <ThemedText 
              variant="smallMedium" 
              color={importType === 'privateKey' ? theme.primary : theme.textMuted}
            >
              {t('auth.privateKey')}
            </ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.formCard}>
          {importType === 'mnemonic' ? (
            <View style={styles.textAreaWrapper}>
              <TextInput
                style={styles.textArea}
                placeholder={t('auth.mnemonicPlaceholder')}
                placeholderTextColor={theme.textMuted}
                value={importMnemonic}
                onChangeText={setImportMnemonic}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          ) : (
            <View style={styles.inputWrapper}>
              <FontAwesome6 name="key" size={16} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.privateKeyPlaceholder')}
                placeholderTextColor={theme.textMuted}
                value={privateKey}
                onChangeText={setPrivateKey}
              />
            </View>
          )}

          <View style={styles.inputWrapper}>
            <FontAwesome6 name="lock" size={16} color={theme.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('auth.walletPassword')}
              placeholderTextColor={theme.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <FontAwesome6 name="circle-exclamation" size={14} color={theme.error} />
              <ThemedText variant="caption" color={theme.error} style={styles.errorText}>
                {error}
              </ThemedText>
            </View>
          ) : null}

          <TouchableOpacity 
            style={[styles.primaryButton, submitting && styles.buttonDisabled]}
            onPress={handleImport}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={theme.buttonPrimaryText} />
            ) : (
              <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
                {t('auth.importWallet')}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle="light">
      {mode === 'select' && renderSelectMode()}
      {mode === 'backup' && renderBackupMode()}
      {mode === 'create' && renderCreateMode()}
      {mode === 'import' && renderImportMode()}
    </Screen>
  );
}
