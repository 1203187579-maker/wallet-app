import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: Spacing['2xl'],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF',
      marginRight: 40,
    },
    card: {
      margin: Spacing.lg,
      backgroundColor: '#DC2626',
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      alignItems: 'center',
    },
    cardTitle: {
      fontSize: 16,
      color: 'rgba(255, 255, 255, 0.8)',
      marginBottom: Spacing.md,
    },
    amountInput: {
      fontSize: 48,
      fontWeight: 'bold',
      color: '#FFFFFF',
      textAlign: 'center',
      width: '100%',
      marginBottom: Spacing.sm,
    },
    amountUnit: {
      fontSize: 24,
      color: 'rgba(255, 255, 255, 0.8)',
      marginBottom: Spacing.md,
    },
    balanceText: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.6)',
    },
    formContainer: {
      margin: Spacing.lg,
      marginTop: 0,
    },
    inputGroup: {
      marginBottom: Spacing.lg,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: '#9CA3AF',
      marginBottom: Spacing.sm,
    },
    input: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontSize: 15,
      color: '#FFFFFF',
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    infoLabel: {
      fontSize: 14,
      color: '#9CA3AF',
    },
    infoValue: {
      fontSize: 14,
      color: '#FFFFFF',
    },
    submitButton: {
      backgroundColor: '#F59E0B',
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
      margin: Spacing.lg,
    },
    submitButtonDisabled: {
      backgroundColor: 'rgba(245, 158, 11, 0.3)',
    },
    submitButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#000000',
    },
    tip: {
      fontSize: 12,
      color: '#6B7280',
      textAlign: 'center',
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.sm,
    },
  });
};
