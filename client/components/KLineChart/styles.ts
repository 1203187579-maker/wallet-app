import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    pairInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    pairName: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    priceContainer: {
      alignItems: 'flex-end',
    },
    currentPrice: {
      fontSize: 24,
      fontWeight: '700',
    },
    priceUp: {
      color: '#10B981',
    },
    priceDown: {
      color: '#EF4444',
    },
    changeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    changeText: {
      fontSize: 14,
      fontWeight: '500',
    },
    intervalSelector: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    intervalButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: BorderRadius.sm,
    },
    intervalButtonActive: {
      backgroundColor: theme.primary,
    },
    intervalButtonText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    intervalButtonTextActive: {
      color: theme.buttonPrimaryText,
    },
    chartContainer: {
      flex: 1,
      paddingVertical: Spacing.md,
    },
    chartWrapper: {
      flex: 1,
      minHeight: 300,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: Spacing.sm,
      color: theme.textMuted,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing['3xl'],
    },
    emptyText: {
      color: theme.textMuted,
      marginTop: Spacing.sm,
    },
    statsContainer: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: Spacing.sm,
    },
    statsLabel: {
      fontSize: 13,
      color: theme.textMuted,
    },
    statsValue: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.textPrimary,
    },
    tradeButton: {
      marginHorizontal: Spacing.lg,
      marginVertical: Spacing.md,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      backgroundColor: theme.primary,
      alignItems: 'center',
    },
    tradeButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.buttonPrimaryText,
    },
  });
};
