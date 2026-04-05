import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
    },
    header: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    pairSelector: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    pairScroll: {
      gap: 8,
    },
    pairButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: BorderRadius.lg,
      backgroundColor: 'rgba(255,255,255,0.1)',
      marginRight: 8,
    },
    pairButtonActive: {
      backgroundColor: '#F59E0B',
    },
    pairButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: '#FFFFFF',
    },
    pairButtonTextActive: {
      color: '#000000',
    },
    chartContainer: {
      flex: 1,
    },
    priceCard: {
      marginHorizontal: Spacing.lg,
      marginVertical: Spacing.sm,
      padding: Spacing.lg,
      borderRadius: BorderRadius.lg,
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    priceLabel: {
      fontSize: 14,
      color: '#6B7280',
    },
    priceValue: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    priceUp: {
      color: '#10B981',
    },
    priceDown: {
      color: '#EF4444',
    },
    statsGrid: {
      flexDirection: 'row',
      marginTop: Spacing.md,
      gap: Spacing.md,
    },
    statItem: {
      flex: 1,
    },
    statLabel: {
      fontSize: 12,
      color: '#6B7280',
      marginBottom: 4,
    },
    statValue: {
      fontSize: 14,
      fontWeight: '500',
      color: '#FFFFFF',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: Spacing.sm,
      color: '#6B7280',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing['3xl'],
    },
    emptyText: {
      color: '#6B7280',
    },
  });
};
