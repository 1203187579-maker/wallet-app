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
      paddingBottom: Spacing['3xl'],
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
    },
    shareButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: '#6B7280',
      textAlign: 'center',
      paddingVertical: Spacing.xl,
    },

    // Group Info Card
    groupInfoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.lg,
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.lg,
      marginBottom: Spacing.md,
      backgroundColor: '#1A1A1A',
      borderRadius: BorderRadius.lg,
    },
    groupAvatarContainer: {
      position: 'relative',
    },
    groupAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#F59E0B',
      justifyContent: 'center',
      alignItems: 'center',
    },
    groupAvatarImage: {
      width: 56,
      height: 56,
      borderRadius: 28,
    },
    avatarEditIcon: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#FFFFFF',
    },
    groupAvatarText: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#000000',
    },
    groupInfoContent: {
      flex: 1,
      marginLeft: Spacing.md,
    },
    groupName: {
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF',
      marginBottom: 2,
    },
    groupMemberCount: {
      fontSize: 14,
      color: '#9CA3AF',
    },

    // Settings List
    settingsList: {
      backgroundColor: '#1A1A1A',
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.md,
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    settingItemWithDesc: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    settingLeft: {
      flex: 1,
    },
    settingLabel: {
      fontSize: 16,
      color: '#FFFFFF',
    },
    settingDesc: {
      fontSize: 12,
      color: '#6B7280',
      marginTop: 2,
    },
    settingRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    settingValue: {
      fontSize: 14,
      color: '#9CA3AF',
    },

    // Danger Section
    dangerSection: {
      marginTop: Spacing.xl,
      marginHorizontal: Spacing.lg,
    },
    dangerItem: {
      backgroundColor: '#1A1A1A',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.sm,
      alignItems: 'center',
    },
    dangerText: {
      fontSize: 16,
      color: '#EF4444',
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
      borderRadius: BorderRadius.md,
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
    disabledButton: {
      opacity: 0.5,
    },

    // Empty modal
    emptyModal: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
    },
    emptyModalText: {
      color: '#FFFFFF',
      marginTop: Spacing.md,
    },
    emptyModalSubtext: {
      color: '#6B7280',
      marginTop: Spacing.xs,
    },

    // Divider
    divider: {
      height: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      marginVertical: Spacing.md,
    },
    dividerTitle: {
      color: '#6B7280',
      marginBottom: Spacing.md,
    },

    // Bot option
    botOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
    },
    botOptionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    botOptionInfo: {
      flex: 1,
      marginLeft: Spacing.md,
    },
    botOptionName: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    botOptionDesc: {
      color: '#9CA3AF',
      marginTop: 2,
    },

    // Friend selection
    selectedCount: {
      color: '#9CA3AF',
      marginBottom: Spacing.md,
    },
    friendOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    friendOptionSelected: {
      backgroundColor: 'rgba(245, 158, 11, 0.05)',
    },
    friendAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(245, 158, 11, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    friendAvatarText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#F59E0B',
    },
    friendName: {
      flex: 1,
      marginLeft: Spacing.md,
      color: '#FFFFFF',
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxSelected: {
      backgroundColor: '#F59E0B',
      borderColor: '#F59E0B',
    },

    // Option items
    optionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.xs,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    optionItemSelected: {
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    optionText: {
      color: '#FFFFFF',
    },
    optionTextSelected: {
      color: '#F59E0B',
      fontWeight: '600',
    },

    // Section label
    sectionLabel: {
      color: '#6B7280',
      marginBottom: Spacing.sm,
      marginTop: Spacing.md,
    },

    // Capacity expand
    capacityInfo: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    capacityInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.xs,
    },
    capacityInfoLabel: {
      color: '#9CA3AF',
    },
    capacityInfoValue: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    expandAmountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
      marginVertical: Spacing.md,
    },
    amountButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    expandAmountInput: {
      width: 100,
      height: 44,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: BorderRadius.md,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    capacityCostInfo: {
      alignItems: 'center',
      paddingVertical: Spacing.md,
    },
    capacityCostText: {
      color: '#F59E0B',
      fontWeight: '600',
      fontSize: 16,
    },
    capacityCostHint: {
      color: '#6B7280',
      marginTop: Spacing.xs,
    },
  });
};
