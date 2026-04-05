import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing['2xl'],
      paddingBottom: Spacing['3xl'],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing['2xl'],
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.backgroundDefault,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      marginBottom: Spacing['2xl'],
      borderWidth: 1,
      borderColor: theme.border,
    },
    bannerIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.lg,
    },
    bannerContent: {
      flex: 1,
    },
    bannerTitle: {
      marginBottom: Spacing.xs,
    },
    bannerDesc: {
      opacity: 0.7,
    },
    section: {
      marginBottom: Spacing['2xl'],
    },
    sectionTitle: {
      marginBottom: Spacing.lg,
      opacity: 0.8,
    },
    articleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    articleIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.lg,
    },
    articleContent: {
      flex: 1,
    },
    articleTitle: {
      marginBottom: Spacing.xs,
    },
    articleDesc: {
      opacity: 0.7,
    },
    contactSection: {
      marginBottom: Spacing.xl,
    },
    contactCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: theme.border,
    },
    contactItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      gap: Spacing.lg,
    },
    contactText: {
      opacity: 0.8,
    },
  });
};
