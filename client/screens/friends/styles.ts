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
    tabContainer: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      gap: Spacing.md,
    },
    tab: {
      flex: 1,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
    },
    activeTab: {
      backgroundColor: '#F59E0B',
    },
    inactiveTab: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
    },
    activeTabText: {
      color: '#000000',
    },
    inactiveTabText: {
      color: '#9CA3AF',
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#9CA3AF',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    friendList: {
      paddingHorizontal: Spacing.lg,
    },
    friendCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    friendAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: '#F59E0B',
      justifyContent: 'center',
      alignItems: 'center',
    },
    friendAvatarText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#000000',
    },
    friendInfo: {
      flex: 1,
      marginLeft: Spacing.md,
    },
    friendName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
      marginBottom: 2,
    },
    friendDesc: {
      fontSize: 13,
      color: '#9CA3AF',
    },
    actionButtons: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    actionButton: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
    },
    acceptButton: {
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
    },
    rejectButton: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    actionButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#F59E0B',
    },
    acceptText: {
      color: '#22C55E',
    },
    rejectText: {
      color: '#EF4444',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
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
      color: '#9CA3AF',
      textAlign: 'center',
    },
    addFriendButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F59E0B',
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.md,
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.md,
    },
    addFriendButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#000000',
      marginLeft: Spacing.sm,
    },
    // Modal styles
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
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontSize: 15,
      color: '#FFFFFF',
      marginBottom: Spacing.md,
    },
    submitButton: {
      backgroundColor: '#F59E0B',
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#000000',
    },
  });
};
