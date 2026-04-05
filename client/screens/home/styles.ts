import { StyleSheet, Platform } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing['6xl'],
    },
    
    // Header with notification and settings
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
    redDot: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#EF4444',
      borderWidth: 2,
      borderColor: '#000000',
    },
    
    // Asset Card (Orange gradient background)
    assetCard: {
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
    assetCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: Spacing.md,
    },
    totalAssetLabel: {
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
    totalBalance: {
      color: '#000000',
      fontSize: 36,
      fontWeight: '700',
      marginBottom: Spacing.lg,
    },
    walletAddress: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    walletAddressText: {
      color: 'rgba(0,0,0,0.7)',
      fontSize: 14,
    },
    
    // Quick Actions (4 buttons)
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
      backgroundColor: 'transparent',
      borderRadius: 0,
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
    
    // Market Section
    marketSection: {
      marginBottom: Spacing.xl,
    },
    
    // Market Tabs
    marketTabsScroll: {
      marginBottom: Spacing.lg,
    },
    marketTabsContainer: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    marketTab: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    marketTabActive: {
      backgroundColor: '#FFFFFF',
      borderColor: '#FFFFFF',
    },
    marketTabText: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 13,
    },
    marketTabTextActive: {
      color: '#000000',
    },
    
    marketCard: {
      paddingVertical: Spacing.md,
      marginBottom: 0,
    },
    marketRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    marketLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    marketIcon: {
      width: 36,
      height: 36,
      borderRadius: BorderRadius.full,
      backgroundColor: 'rgba(245,158,11,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    marketInfo: {
      marginLeft: Spacing.sm,
    },
    marketSymbol: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
    },
    marketName: {
      color: '#6B7280',
      fontSize: 11,
    },
    marketSparkline: {
      flex: 1,
      alignItems: 'center',
    },
    marketRight: {
      alignItems: 'flex-end',
      minWidth: 80,
    },
    marketPrice: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 2,
    },
    marketChangeUp: {
      color: '#22C55E',
      fontSize: 12,
      fontWeight: '500',
    },
    marketChangeDown: {
      color: '#EF4444',
      fontSize: 12,
      fontWeight: '500',
    },
    
    emptyTokenState: {
      alignItems: 'center',
      paddingVertical: Spacing['3xl'],
      backgroundColor: '#111827',
      borderRadius: BorderRadius.lg,
    },
    emptyTokenText: {
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
    
    // Popup Modal
    popupOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.lg,
    },
    popupCard: {
      backgroundColor: '#1F2937',
      borderRadius: BorderRadius.xl,
      width: '100%',
      maxWidth: 400,
      maxHeight: '80%',
      overflow: 'hidden',
    },
    popupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: '#374151',
      gap: Spacing.sm,
    },
    popupTitle: {
      flex: 1,
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },
    popupCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#374151',
      justifyContent: 'center',
      alignItems: 'center',
    },
    popupContent: {
      padding: Spacing.lg,
      maxHeight: 400,
    },
    popupText: {
      color: '#D1D5DB',
      lineHeight: 24,
    },
    popupFooter: {
      padding: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: '#374151',
      alignItems: 'center',
    },
    popupPage: {
      color: '#6B7280',
    },
  });
};
