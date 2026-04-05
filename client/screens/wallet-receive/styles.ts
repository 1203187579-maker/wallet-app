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
    
    // ===== Empty State =====
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#111827',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    createBtn: {
      backgroundColor: '#F59E0B',
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      marginTop: Spacing.xl,
    },
    createBtnText: {
      color: '#000000',
      fontSize: 14,
      fontWeight: '700',
    },
    
    // ===== QR Code =====
    qrContainer: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
      marginBottom: Spacing.lg,
    },
    qrPlaceholder: {
      width: 180,
      height: 180,
      backgroundColor: '#111827',
      borderRadius: BorderRadius.xl,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#F59E0B',
      ...Platform.select({
        web: {
          boxShadow: '0px 4px 20px rgba(245,158,11,0.3)',
        },
        default: {
          shadowColor: '#F59E0B',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
          elevation: 8,
        },
      }),
    },
    qrHint: {
      color: '#6B7280',
      fontSize: 12,
      marginTop: Spacing.lg,
    },
    
    // ===== Address Card =====
    addressCard: {
      backgroundColor: '#111827',
      borderRadius: BorderRadius.lg,
      padding: Spacing.xl,
      marginBottom: Spacing.lg,
    },
    addressLabel: {
      color: '#6B7280',
      fontSize: 12,
      marginBottom: Spacing.md,
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    addressText: {
      flex: 1,
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '500',
    },
    copyBtn: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.lg,
      backgroundColor: 'rgba(245,158,11,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: Spacing.md,
    },
    
    // ===== Tips Card =====
    tipsCard: {
      backgroundColor: 'rgba(245,158,11,0.08)',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
      borderWidth: 1,
      borderColor: 'rgba(245,158,11,0.2)',
    },
    tipHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    tipTitle: {
      color: '#F59E0B',
      fontSize: 13,
      fontWeight: '600',
      marginLeft: Spacing.sm,
    },
    tipText: {
      color: '#9CA3AF',
      fontSize: 12,
      lineHeight: 20,
    },
    
    // ===== Section Header =====
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
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
      backgroundColor: 'rgba(34, 197, 94, 0.15)',
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
