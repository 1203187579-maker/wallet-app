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
    listContent: {
      flexGrow: 1,
      paddingBottom: Spacing['2xl'],
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    headerPlaceholder: {
      width: 40,
    },

    // Search
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: Spacing.lg,
      marginVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: BorderRadius.full,
      gap: Spacing.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: '#FFFFFF',
      paddingVertical: Spacing.xs,
    },

    // Group Card
    groupCard: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      marginHorizontal: Spacing.lg,
      marginVertical: Spacing.xs,
      backgroundColor: '#1A1A1A',
      borderRadius: BorderRadius.lg,
    },
    groupAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: '#F59E0B',
      justifyContent: 'center',
      alignItems: 'center',
    },
    groupAvatarText: {
      fontSize: 22,
      fontWeight: '700',
      color: '#000000',
    },
    groupInfo: {
      flex: 1,
      marginLeft: Spacing.md,
    },
    groupName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
      marginBottom: 2,
    },
    groupDesc: {
      fontSize: 13,
      color: '#9CA3AF',
      marginBottom: 4,
    },
    groupMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    memberCount: {
      fontSize: 12,
      color: '#6B7280',
    },

    // Action
    groupAction: {
      marginLeft: Spacing.md,
    },
    joinedBadge: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      backgroundColor: 'rgba(34, 197, 94, 0.15)',
    },
    joinedText: {
      color: '#22C55E',
      fontWeight: '500',
    },
    joinButton: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: '#F59E0B',
    },
    joinButtonText: {
      color: '#000000',
      fontWeight: '600',
    },

    // Empty
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing['3xl'],
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF',
      marginBottom: Spacing.sm,
    },
    emptyText: {
      fontSize: 14,
      color: '#6B7280',
    },
  });
};
