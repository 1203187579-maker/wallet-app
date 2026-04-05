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
      paddingBottom: 120,
    },
    
    // ===== Loading =====
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#000000',
    },
    
    // ===== Header =====
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },
    
    // ===== Token Selector =====
    section: {
      marginBottom: Spacing.xl,
    },
    sectionLabel: {
      color: '#6B7280',
      fontSize: 13,
      fontWeight: '500',
      marginBottom: Spacing.md,
    },
    tokenSelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    tokenBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      backgroundColor: '#1F2937',
      borderRadius: BorderRadius.lg,
    },
    tokenBtnActive: {
      backgroundColor: '#F59E0B',
    },
    tokenBtnText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '500',
      marginLeft: 6,
    },
    tokenBtnTextActive: {
      color: '#000000',
      fontSize: 13,
      fontWeight: '600',
      marginLeft: 6,
    },
    
    // ===== Input =====
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#1F2937',
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    input: {
      flex: 1,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.lg,
      color: '#FFFFFF',
      fontSize: 15,
    },
    scanBtn: {
      width: 48,
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    // ===== Amount Input =====
    amountHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    amountWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#1F2937',
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.lg,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    amountInput: {
      flex: 1,
      paddingVertical: Spacing.lg,
      color: '#FFFFFF',
      fontSize: 28,
      fontWeight: '700',
    },
    amountInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: Spacing.sm,
    },
    maxBtn: {
      color: '#F59E0B',
      fontSize: 13,
      fontWeight: '500',
    },
    
    // ===== Balance Card =====
    balanceCard: {
      backgroundColor: '#111827',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    balanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    balanceLabel: {
      color: '#6B7280',
      fontSize: 12,
    },
    balanceValue: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    
    // ===== Footer =====
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: Spacing.lg,
      backgroundColor: '#000000',
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.05)',
    },
    submitBtn: {
      backgroundColor: '#F59E0B',
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      ...Platform.select({
        web: {
          boxShadow: '0px 4px 12px rgba(245,158,11,0.3)',
        },
        default: {
          shadowColor: '#F59E0B',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 4,
        },
      }),
    },
    submitBtnDisabled: {
      opacity: 0.6,
    },
    submitBtnText: {
      color: '#000000',
      fontSize: 15,
      fontWeight: '700',
    },
    
    // ===== Section Header =====
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    sectionTitle: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    
    // ===== Transaction Record =====
    recordList: {
      marginBottom: Spacing.xl,
    },
    recordItem: {
      backgroundColor: '#111827',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    recordHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    recordType: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    recordIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(245,158,11,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    recordTitle: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    recordAmount: {
      fontSize: 16,
      fontWeight: '700',
    },
    recordAmountNegative: {
      color: '#EF4444',
    },
    recordAmountPositive: {
      color: '#22C55E',
    },
    recordInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: Spacing.sm,
    },
    recordAddress: {
      color: '#6B7280',
      fontSize: 12,
    },
    recordTime: {
      color: '#6B7280',
      fontSize: 12,
    },
    recordStatus: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: 'rgba(34, 197, 94, 0.15)',
    },
    recordStatusText: {
      color: '#22C55E',
      fontSize: 11,
      fontWeight: '500',
    },
    recordStatusPending: {
      backgroundColor: 'rgba(245,158,11,0.15)',
    },
    recordStatusPendingText: {
      color: '#F59E0B',
    },
    emptyRecords: {
      alignItems: 'center',
      paddingVertical: Spacing['3xl'],
      backgroundColor: '#111827',
      borderRadius: BorderRadius.lg,
    },
    emptyRecordsText: {
      color: '#6B7280',
      fontSize: 14,
      marginTop: Spacing.md,
    },
  });
};
