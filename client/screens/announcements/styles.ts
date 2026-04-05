import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: '#1F2937',
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#1F2937',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },
    
    // Filter
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      gap: Spacing.sm,
    },
    filterBtn: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: '#1F2937',
    },
    filterBtnActive: {
      backgroundColor: '#F59E0B',
    },
    filterText: {
      color: '#9CA3AF',
    },
    filterTextActive: {
      color: '#000000',
      fontWeight: '600',
    },
    
    // Scroll
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing['6xl'],
    },
    
    // Empty
    emptyState: {
      alignItems: 'center',
      paddingVertical: Spacing['4xl'],
    },
    emptyText: {
      color: '#6B7280',
      marginTop: Spacing.md,
    },
    
    // Card
    card: {
      backgroundColor: '#111827',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    typeTag: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
      gap: 4,
    },
    typeText: {
      fontWeight: '500',
    },
    dateText: {
      color: '#6B7280',
    },
    cardTitle: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: Spacing.sm,
    },
    cardContent: {
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: '#374151',
    },
    contentText: {
      color: '#D1D5DB',
      lineHeight: 22,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginTop: Spacing.sm,
      gap: 4,
    },
    expandHint: {
      color: '#6B7280',
    },
  });
};
