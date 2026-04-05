import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    // ========== 选择模式 ==========
    selectContainer: {
      flex: 1,
      paddingHorizontal: Spacing.xl,
      justifyContent: 'center',
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: Spacing['4xl'],
    },
    logoIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
      borderWidth: 2,
      borderColor: theme.primary,
    },
    logoText: {
      letterSpacing: 3,
      marginBottom: Spacing.sm,
    },
    buttonGroup: {
      gap: Spacing.lg,
      marginBottom: Spacing['2xl'],
    },
    primaryButton: {
      backgroundColor: theme.primary,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing['2xl'],
      borderRadius: BorderRadius.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing['2xl'],
      borderRadius: BorderRadius.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.primary,
    },
    buttonIcon: {
      marginRight: Spacing.md,
    },
    footer: {
      alignItems: 'center',
    },

    // ========== 备份模式 ==========
    backupContainer: {
      flex: 1,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing['2xl'],
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing['2xl'],
    },
    warningCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    warningText: {
      flex: 1,
      marginLeft: Spacing.md,
    },
    mnemonicCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      marginBottom: Spacing['2xl'],
      borderWidth: 1,
      borderColor: theme.border,
    },
    mnemonicLabel: {
      marginBottom: Spacing.lg,
    },
    mnemonicWords: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    wordChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundTertiary,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.md,
      gap: Spacing.xs,
    },

    // ========== 表单模式（创建/导入） ==========
    formContainer: {
      flexGrow: 1,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing['2xl'],
      paddingBottom: Spacing['3xl'],
    },
    formCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      borderWidth: 1,
      borderColor: theme.border,
    },
    formLabel: {
      marginBottom: Spacing.lg,
    },
    inputGroup: {
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.lg,
      borderWidth: 1,
      borderColor: theme.border,
    },
    inputIcon: {
      marginRight: Spacing.md,
    },
    input: {
      flex: 1,
      paddingVertical: Spacing.lg,
      color: theme.textPrimary,
      fontSize: 16,
    },
    textAreaWrapper: {
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.lg,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: Spacing.md,
    },
    textArea: {
      paddingVertical: Spacing.lg,
      color: theme.textPrimary,
      fontSize: 16,
      minHeight: 100,
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.md,
      paddingHorizontal: Spacing.sm,
    },
    errorText: {
      marginLeft: Spacing.sm,
    },
    buttonDisabled: {
      opacity: 0.6,
    },

    // ========== Checkbox ==========
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.xl,
      gap: Spacing.md,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: BorderRadius.xs,
      borderWidth: 2,
      borderColor: theme.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },

    // ========== Tab 切换 ==========
    tabContainer: {
      flexDirection: 'row',
      marginBottom: Spacing.lg,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.lg,
      padding: 4,
    },
    tab: {
      flex: 1,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      borderRadius: BorderRadius.md,
    },
    tabActive: {
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
    },
  });
};
