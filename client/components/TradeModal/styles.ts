import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: '#0A0A0A',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: Spacing['3xl'],
      maxHeight: '70%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    closeButton: {
      padding: Spacing.xs,
    },
    closeIcon: {
      fontSize: 24,
      color: '#6B7280',
    },
    tabContainer: {
      flexDirection: 'row',
      marginHorizontal: Spacing.xl,
      marginTop: Spacing.lg,
      backgroundColor: 'rgba(255,255,255,0.05)',
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
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    tabText: {
      fontSize: 15,
      fontWeight: '500',
      color: '#6B7280',
    },
    tabTextBuy: {
      color: '#22C55E',
    },
    tabTextSell: {
      color: '#EF4444',
    },
    content: {
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.xl,
    },
    inputGroup: {
      marginBottom: Spacing.lg,
    },
    inputLabel: {
      fontSize: 14,
      color: '#6B7280',
      marginBottom: Spacing.sm,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    input: {
      flex: 1,
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF',
      padding: 0,
    },
    currencyLabel: {
      fontSize: 16,
      color: '#6B7280',
      marginLeft: Spacing.sm,
    },
    maxButton: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      backgroundColor: '#F59E0B',
      borderRadius: BorderRadius.sm,
      marginLeft: Spacing.sm,
    },
    maxButtonText: {
      fontSize: 12,
      color: '#000000',
      fontWeight: '600',
    },
    priceInfo: {
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.05)',
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    priceRowLast: {
      marginBottom: 0,
    },
    priceLabel: {
      fontSize: 14,
      color: '#6B7280',
    },
    priceValue: {
      fontSize: 14,
      color: '#FFFFFF',
      fontWeight: '500',
    },
    priceValueHighlight: {
      color: '#F59E0B',
    },
    balanceInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    balanceLabel: {
      fontSize: 14,
      color: '#6B7280',
    },
    balanceValue: {
      fontSize: 14,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    submitButton: {
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    submitButtonBuy: {
      backgroundColor: '#F59E0B',
    },
    submitButtonSell: {
      backgroundColor: '#EF4444',
    },
    submitButtonDisabled: {
      backgroundColor: '#374151',
      opacity: 0.5,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    errorMessage: {
      fontSize: 13,
      color: '#EF4444',
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
      marginLeft: Spacing.sm,
    },
    disabledMessage: {
      fontSize: 15,
      color: '#6B7280',
      textAlign: 'center',
      marginTop: 40,
      paddingHorizontal: Spacing.xl,
    },
  });
};
