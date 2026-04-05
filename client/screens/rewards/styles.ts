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
    
    // Poster Card
    posterCard: {
      backgroundColor: '#F59E0B',
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      marginBottom: Spacing.lg,
    },
    posterHeader: {
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    logoIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoText: {
      color: '#000000',
      fontSize: 20,
      fontWeight: '700',
    },
    posterTitle: {
      color: '#000000',
      fontSize: 24,
      fontWeight: '700',
      marginBottom: Spacing.sm,
    },
    posterSubtitle: {
      color: 'rgba(0,0,0,0.6)',
      fontSize: 14,
    },
    
    // QR Code
    qrcodeSection: {
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    qrcodeWrapper: {
      backgroundColor: '#FFFFFF',
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.md,
    },
    scanHint: {
      color: 'rgba(0,0,0,0.6)',
      fontSize: 12,
    },
    
    // Code Section
    codeSection: {
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    codeLabel: {
      color: 'rgba(0,0,0,0.6)',
      fontSize: 12,
      marginBottom: Spacing.sm,
    },
    codeBox: {
      backgroundColor: 'rgba(0,0,0,0.1)',
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
    },
    codeText: {
      color: '#000000',
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: 4,
    },
    
    // Stats Row
    statsRow: {
      flexDirection: 'row',
      backgroundColor: 'rgba(0,0,0,0.1)',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      color: '#000000',
      fontSize: 24,
      fontWeight: '700',
      marginBottom: Spacing.xs,
    },
    statLabel: {
      color: 'rgba(0,0,0,0.6)',
      fontSize: 12,
    },
    statDivider: {
      width: 1,
      backgroundColor: 'rgba(0,0,0,0.2)',
    },
    
    // Action Section
    actionSection: {
      gap: Spacing.md,
      marginBottom: Spacing.xl,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F59E0B',
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      gap: Spacing.sm,
    },
    primaryBtnText: {
      color: '#000000',
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    secondaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1F2937',
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
      gap: Spacing.sm,
    },
    secondaryBtnText: {
      color: '#F59E0B',
      fontSize: 14,
      fontWeight: '500',
    },
    
    // Rules
    rulesSection: {
      backgroundColor: '#1F2937',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
    },
    rulesTitle: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: Spacing.lg,
    },
    ruleItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.md,
      gap: Spacing.md,
    },
    ruleDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#F59E0B',
    },
    ruleText: {
      color: '#9CA3AF',
      fontSize: 14,
      flex: 1,
    },
    
    // Loading
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
};
