import { StyleSheet, Platform } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing['6xl'],
    },
    
    // Header
    header: {
      marginBottom: Spacing.xl,
    },
    headerTitle: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '700',
    },
    
    // Stats Card - 无背景，简洁风格
    statsCard: {
      paddingVertical: Spacing.lg,
      marginBottom: Spacing.md,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      color: '#FFFFFF',
      fontSize: 22,
      fontWeight: '700',
      marginBottom: Spacing.xs,
    },
    statLabel: {
      color: '#6B7280',
      fontSize: 11,
    },
    
    // 待领取按钮
    claimButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(245,158,11,0.08)',
      borderWidth: 1.5,
      borderColor: 'rgba(245,158,11,0.5)',
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    claimButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    claimTextWrap: {
      marginLeft: Spacing.sm,
    },
    claimLabel: {
      color: '#9CA3AF',
      fontSize: 11,
      marginBottom: 2,
    },
    claimValue: {
      color: '#F59E0B',
      fontSize: 15,
      fontWeight: '600',
    },
    claimAction: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(245,158,11,0.2)',
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.full,
    },
    claimActionText: {
      color: '#F59E0B',
      fontSize: 12,
      marginRight: 4,
    },
    
    // Section Header
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.lg,
      marginTop: Spacing.lg,
    },
    sectionTitle: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    sectionAction: {
      color: '#F59E0B',
      fontSize: 13,
      fontWeight: '500',
    },
    
    // Stake Card - 带金色边框卡片
    stakeCard: {
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: 'rgba(245,158,11,0.25)',
      backgroundColor: 'rgba(245,158,11,0.03)',
    },
    stakeCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stakeIconGreen: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.full,
      backgroundColor: 'rgba(245,158,11,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    stakeIconOrange: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.full,
      backgroundColor: 'rgba(245,158,11,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    stakeInfo: {
      flex: 1,
    },
    stakeTitle: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 2,
    },
    stakeDesc: {
      color: '#6B7280',
      fontSize: 11,
    },
    stakeApy: {
      color: '#F59E0B',
      fontSize: 14,
      fontWeight: '600',
      minWidth: 80,
      textAlign: 'right',
    },
    stakeCardBottom: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: Spacing.md,
    },
    stakeAmount: {
      color: '#9CA3AF',
      fontSize: 12,
      flex: 1,
    },
    stakeButton: {
      backgroundColor: '#F59E0B',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
    },
    stakeButtonText: {
      color: '#000000',
      fontSize: 12,
      fontWeight: '700',
    },
    
    // Record Card - 无背景，简洁风格
    recordCard: {
      paddingVertical: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    recordRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    recordLeft: {
      flex: 1,
    },
    recordType: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 2,
    },
    recordDate: {
      color: '#6B7280',
      fontSize: 11,
    },
    recordRight: {
      alignItems: 'flex-end',
    },
    recordAmount: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 2,
    },
    recordReward: {
      color: '#F59E0B',
      fontSize: 11,
    },
    
    // Empty State
    emptyState: {
      alignItems: 'center',
      paddingVertical: Spacing['4xl'],
    },
    emptyText: {
      color: '#6B7280',
      fontSize: 14,
      marginTop: Spacing.md,
    },
    
    // Loading
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.8)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: '#0D0D0D',
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      padding: Spacing.xl,
      paddingBottom: Spacing['3xl'],
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    modalTitle: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },
    modalClose: {
      color: '#6B7280',
      fontSize: 24,
    },
    input: {
      backgroundColor: '#1A1A1A',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      color: '#FFFFFF',
      fontSize: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    inputLabel: {
      color: '#9CA3AF',
      fontSize: 12,
      marginBottom: Spacing.sm,
    },
    submitButton: {
      backgroundColor: '#F59E0B',
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
    },
    submitButtonText: {
      color: '#000000',
      fontSize: 16,
      fontWeight: '700',
    },
  });
};
