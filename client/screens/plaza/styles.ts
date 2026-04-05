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
    scrollContent: {
      flexGrow: 1,
      paddingBottom: Spacing['2xl'],
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
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    headerActions: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Tab Navigation
    tabContainer: {
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    tabScrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      gap: Spacing.sm,
    },
    tab: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      marginRight: Spacing.sm,
    },
    tabActive: {
      backgroundColor: '#F59E0B',
    },
    tabInactive: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    tabText: {
      fontSize: 14,
    },
    tabTextActive: {
      color: '#000000',
      fontWeight: '600',
    },
    tabTextInactive: {
      color: '#9CA3AF',
    },

    // Conversation Item
    conversationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.05)',
      backgroundColor: '#000000',
    },
    avatarContainer: {
      position: 'relative',
      marginRight: Spacing.md,
    },
    singleAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
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
    unreadBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#EF4444',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 6,
    },
    unreadText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    conversationContent: {
      flex: 1,
    },
    conversationHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    conversationName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
      flex: 1,
      marginRight: Spacing.sm,
    },
    conversationTime: {
      fontSize: 12,
      color: '#6B7280',
    },
    conversationMessage: {
      fontSize: 14,
      color: '#9CA3AF',
    },

    // Empty State
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing['3xl'],
      paddingHorizontal: Spacing.xl,
    },
    emptyIcon: {
      width: 96,
      height: 96,
      borderRadius: 48,
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
      textAlign: 'center',
      marginBottom: Spacing.xl,
    },
    emptyButton: {
      backgroundColor: '#F59E0B',
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.full,
    },
    emptyButtonText: {
      color: '#000000',
      fontWeight: '600',
    },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      width: '90%',
      maxWidth: 400,
      backgroundColor: '#1A1A1A',
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    modalClose: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    input: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontSize: 15,
      color: '#FFFFFF',
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    modalActions: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.md,
    },
    modalButton: {
      flex: 1,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    submitButton: {
      backgroundColor: '#F59E0B',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#000000',
    },
  });
};
