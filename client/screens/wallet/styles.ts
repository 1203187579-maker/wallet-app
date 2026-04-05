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
    
    // ===== Top Bar =====
    topBar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginBottom: Spacing.lg,
      gap: Spacing.md,
    },
    topBarButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    // ===== Empty State =====
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
      backgroundColor: '#000000',
    },
    emptyIcon: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: '#111827',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.xl,
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
    
    // ===== Wallet Card (Orange Background) =====
    walletCard: {
      backgroundColor: '#F59E0B',
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      marginBottom: Spacing.xl,
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
    walletCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: Spacing.md,
    },
    walletLabel: {
      color: 'rgba(0,0,0,0.7)',
      fontSize: 14,
      fontWeight: '500',
    },
    chainTag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(139,69,19,0.4)',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      gap: Spacing.xs,
    },
    chainDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#22C55E',
    },
    chainText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '500',
    },
    walletBalance: {
      color: '#000000',
      fontSize: 36,
      fontWeight: '700',
      marginBottom: Spacing.lg,
    },
    walletAddressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    walletAddressText: {
      color: 'rgba(0,0,0,0.7)',
      fontSize: 14,
    },
    
    // ===== Quick Actions =====
    quickActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: Spacing['2xl'],
      gap: Spacing.md,
    },
    quickActionBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.lg,
      backgroundColor: '#1F2937',
      borderRadius: BorderRadius.lg,
    },
    quickActionIcon: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.lg,
      backgroundColor: 'rgba(245,158,11,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    quickActionText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '500',
    },
    
    // ===== Asset Item =====
    assetItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#111827',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    assetLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    assetIcon: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.full,
      backgroundColor: 'rgba(245,158,11,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    assetInfo: {
      flex: 1,
    },
    assetSymbol: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 2,
    },
    assetName: {
      color: '#6B7280',
      fontSize: 12,
    },
    assetRight: {
      alignItems: 'flex-end',
    },
    assetAmount: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 2,
    },
    assetValue: {
      color: '#6B7280',
      fontSize: 12,
    },
    emptyAssets: {
      alignItems: 'center',
      paddingVertical: Spacing['3xl'],
      backgroundColor: '#111827',
      borderRadius: BorderRadius.lg,
    },
    emptyAssetsText: {
      color: '#6B7280',
      fontSize: 14,
      marginTop: Spacing.md,
    },
    
    // ===== Management Card =====
    managementCard: {
      backgroundColor: '#111827',
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.xl,
      overflow: 'hidden',
    },
    managementItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.lg,
    },
    managementIcon: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.lg,
      backgroundColor: 'rgba(245,158,11,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    managementInfo: {
      flex: 1,
    },
    managementTitle: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 2,
    },
    managementDesc: {
      color: '#6B7280',
      fontSize: 12,
    },
    managementDivider: {
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.05)',
      marginLeft: Spacing.lg + 44 + Spacing.md,
    },
    
    // ===== Modal =====
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: '#111827',
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      width: '90%',
      maxWidth: 400,
    },
    modalTitle: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '700',
      marginBottom: Spacing.md,
    },
    modalWarning: {
      color: '#EF4444',
      fontSize: 14,
      marginBottom: Spacing.lg,
    },
    modalInput: {
      backgroundColor: '#1F2937',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      color: '#FFFFFF',
      fontSize: 15,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      marginBottom: Spacing.md,
    },
    modalHint: {
      color: '#6B7280',
      fontSize: 12,
      marginBottom: Spacing.lg,
    },
    modalActions: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.md,
    },
    modalCancelBtn: {
      flex: 1,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      backgroundColor: '#1F2937',
    },
    modalCancelBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    modalConfirmBtn: {
      flex: 1,
      backgroundColor: '#F59E0B',
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
    },
    modalConfirmBtnText: {
      color: '#000000',
      fontSize: 14,
      fontWeight: '700',
    },
    
    // ===== Import Type Tabs =====
    importTypeTabs: {
      flexDirection: 'row',
      backgroundColor: '#1F2937',
      borderRadius: BorderRadius.lg,
      padding: 4,
      marginBottom: Spacing.lg,
    },
    importTypeTab: {
      flex: 1,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      borderRadius: BorderRadius.md,
    },
    importTypeTabActive: {
      backgroundColor: '#F59E0B',
    },
    importTypeText: {
      color: '#6B7280',
      fontSize: 13,
      fontWeight: '600',
    },
    importTypeTextActive: {
      color: '#000000',
      fontSize: 13,
      fontWeight: '700',
    },
    
    // ===== Result Box =====
    resultBox: {
      backgroundColor: '#1F2937',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    resultLabel: {
      color: '#6B7280',
      fontSize: 12,
      fontWeight: '600',
      marginBottom: Spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    resultText: {
      color: '#FFFFFF',
      fontSize: 14,
      lineHeight: 22,
    },
  });
};
