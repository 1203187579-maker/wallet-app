import { StyleSheet } from 'react-native';
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
      paddingBottom: Spacing['3xl'],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    section: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      fontSize: 14,
      color: '#6B7280',
      marginBottom: Spacing.md,
      marginLeft: Spacing.xs,
    },
    card: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    menuItemLast: {
      borderBottomWidth: 0,
    },
    menuLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    menuIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(245,158,11,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    menuText: {
      fontSize: 15,
      color: '#FFFFFF',
    },
    menuRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    menuValue: {
      fontSize: 14,
      color: '#6B7280',
      marginRight: Spacing.sm,
    },
    checkIcon: {
      width: 20,
      height: 20,
    },
    versionText: {
      fontSize: 14,
      color: '#6B7280',
      textAlign: 'center',
      marginTop: Spacing['2xl'],
    },
  });
};
