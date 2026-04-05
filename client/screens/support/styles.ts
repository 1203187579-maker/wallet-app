import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.backgroundDefault,
    },
    backButton: {
      padding: Spacing.sm,
      marginRight: Spacing.sm,
    },
    headerTitle: {
      flex: 1,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#22C55E',
      marginRight: Spacing.xs,
    },
    statusText: {
      fontSize: 12,
      color: '#22C55E',
    },
    messagesContainer: {
      flex: 1,
      paddingHorizontal: Spacing.md,
    },
    messagesContent: {
      paddingVertical: Spacing.lg,
    },
    messageWrapper: {
      marginBottom: Spacing.md,
    },
    userMessageWrapper: {
      alignItems: 'flex-end',
    },
    otherMessageWrapper: {
      alignItems: 'flex-start',
    },
    messageBubble: {
      maxWidth: '80%',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.lg,
    },
    userBubble: {
      backgroundColor: theme.primary,
      borderBottomRightRadius: 4,
    },
    aiBubble: {
      backgroundColor: theme.backgroundTertiary,
      borderBottomLeftRadius: 4,
    },
    adminBubble: {
      backgroundColor: '#F0FDF4',
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: '#22C55E',
    },
    messageText: {
      fontSize: 15,
      lineHeight: 22,
    },
    userMessageText: {
      color: '#FFFFFF',
    },
    otherMessageText: {
      color: theme.textPrimary,
    },
    senderLabel: {
      fontSize: 11,
      color: theme.textMuted,
      marginTop: Spacing.xs,
    },
    timeText: {
      fontSize: 11,
      color: theme.textMuted,
      marginTop: Spacing.xs,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.backgroundDefault,
    },
    inputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.xl,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      marginRight: Spacing.sm,
      minHeight: 40,
      maxHeight: 120,
    },
    textInput: {
      flex: 1,
      fontSize: 15,
      color: theme.textPrimary,
      paddingVertical: Spacing.xs,
      maxHeight: 100,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: theme.textMuted,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing['2xl'],
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    emptyTitle: {
      marginBottom: Spacing.sm,
    },
    emptyText: {
      textAlign: 'center',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    typingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    typingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.textMuted,
      marginHorizontal: 2,
    },
  });
};
