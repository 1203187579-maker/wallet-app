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
      paddingTop: Spacing.xl,
      paddingBottom: Spacing['6xl'],
    },
    
    // Header Row
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    langButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(245,158,11,0.15)',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      gap: Spacing.sm,
    },
    langText: {
      color: '#F59E0B',
      fontSize: 13,
      fontWeight: '500',
    },
    
    // Asset Card (Orange gradient background)
    assetCard: {
      backgroundColor: '#F59E0B',
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      marginBottom: Spacing.lg,
      marginTop: Spacing.md,
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
    
    // Stats Card
    statsCard: {
      backgroundColor: '#111827',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    statsTitle: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: Spacing.lg,
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
      color: '#F59E0B',
      fontSize: 24,
      fontWeight: '700',
      marginBottom: Spacing.xs,
    },
    statLabel: {
      color: '#6B7280',
      fontSize: 12,
    },
    
    // Menu Section
    menuSection: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      color: '#6B7280',
      fontSize: 12,
      fontWeight: '500',
      marginBottom: Spacing.md,
      marginLeft: Spacing.sm,
    },
    
    // Menu Item
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#111827',
      padding: Spacing.lg,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.sm,
    },
    menuIcon: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.lg,
      backgroundColor: 'rgba(245,158,11,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    menuText: {
      flex: 1,
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '500',
    },
    menuArrow: {
      color: '#6B7280',
    },
    
    // KYC Status
    kycBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.md,
      backgroundColor: 'rgba(34,197,94,0.15)',
    },
    kycBadgePending: {
      backgroundColor: 'rgba(245,158,11,0.15)',
    },
    kycBadgeRejected: {
      backgroundColor: 'rgba(239,68,68,0.15)',
    },
    kycBadgeText: {
      color: '#22C55E',
      fontSize: 12,
      fontWeight: '500',
      marginLeft: Spacing.xs,
    },
    kycBadgeTextPending: {
      color: '#F59E0B',
    },
    
    // Logout Button
    logoutButton: {
      backgroundColor: '#1F2937',
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      marginTop: Spacing.lg,
    },
    logoutButtonText: {
      color: '#EF4444',
      fontSize: 16,
      fontWeight: '500',
    },
    
    // Loading
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
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
    
    // Language Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    langModal: {
      backgroundColor: '#1F2937',
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      width: '85%',
      maxWidth: 320,
    },
    langModalTitle: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: Spacing.lg,
      textAlign: 'center',
    },
    langOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.sm,
    },
    langOptionActive: {
      backgroundColor: 'rgba(245,158,11,0.15)',
    },
    langOptionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    langOptionText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '500',
    },
    langOptionTextActive: {
      color: '#F59E0B',
    },
  });
};
