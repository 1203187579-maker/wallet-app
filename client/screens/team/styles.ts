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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.xl,
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
      fontSize: 20,
      fontWeight: '700',
    },
    
    // Stats Row
    statsRow: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    statCard: {
      flex: 1,
      backgroundColor: '#1F2937',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      alignItems: 'center',
    },
    statValue: {
      color: '#F59E0B',
      fontSize: 24,
      fontWeight: '700',
      marginBottom: Spacing.xs,
    },
    statLabel: {
      color: '#9CA3AF',
      fontSize: 12,
    },
    
    // Stake Row
    stakeRow: {
      flexDirection: 'row',
      backgroundColor: '#1F2937',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    stakeItem: {
      flex: 1,
      alignItems: 'center',
    },
    stakeLabel: {
      color: '#9CA3AF',
      marginBottom: Spacing.xs,
    },
    stakeValue: {
      color: '#FFFFFF',
    },
    stakeDivider: {
      width: 1,
      backgroundColor: '#374151',
    },
    
    // Section
    sectionHeader: {
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      color: '#FFFFFF',
    },
    
    // Member Item
    memberItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#1F2937',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.sm,
      gap: Spacing.md,
    },
    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(245,158,11,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      color: '#FFFFFF',
      marginBottom: 2,
    },
    memberDate: {
      color: '#6B7280',
    },
    memberStats: {
      alignItems: 'flex-end',
    },
    kycBadge: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: 'rgba(34,197,94,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    memberStake: {
      color: '#F59E0B',
    },
    
    // Empty
    emptyState: {
      alignItems: 'center',
      paddingVertical: Spacing['4xl'],
    },
    emptyText: {
      color: '#9CA3AF',
      marginTop: Spacing.md,
    },
    emptyHint: {
      color: '#6B7280',
      marginTop: Spacing.xs,
    },
    
    // Loading
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
};
