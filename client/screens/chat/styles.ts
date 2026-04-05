import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerInfo: {
      flex: 1,
      marginLeft: Spacing.md,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    memberCount: {
      fontSize: 12,
      color: '#9CA3AF',
      marginTop: 2,
    },
    headerActions: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    actionButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    messageList: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
    },
    messageContainer: {
      marginVertical: Spacing.sm,
    },
    myMessageContainer: {
      alignItems: 'flex-end',
    },
    otherMessageContainer: {
      alignItems: 'flex-start',
    },
    messageBubble: {
      maxWidth: '75%',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.lg,
    },
    myMessageBubble: {
      backgroundColor: '#F59E0B',
    },
    otherMessageBubble: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    senderName: {
      fontSize: 12,
      color: '#F59E0B',
      marginBottom: 4,
    },
    messageText: {
      fontSize: 15,
      lineHeight: 20,
    },
    myMessageText: {
      color: '#000000',
    },
    otherMessageText: {
      color: '#FFFFFF',
    },
    messageTime: {
      fontSize: 10,
      color: '#6B7280',
      marginTop: 4,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      backgroundColor: 'transparent',
    },
    inputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'transparent',
      borderRadius: 0,
      paddingHorizontal: 0,
      minHeight: 44,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    input: {
      flex: 1,
      color: '#FFFFFF',
      fontSize: 15,
      paddingVertical: Spacing.xs,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#F59E0B',
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: Spacing.md,
    },
    sendButtonDisabled: {
      backgroundColor: 'rgba(245, 158, 11, 0.3)',
    },
    // Red Packet styles
    redPacketCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#DC2626',
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
    },
    redPacketIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    redPacketInfo: {
      flex: 1,
    },
    redPacketTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    redPacketDesc: {
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.8)',
      marginTop: 2,
    },
    redPacketClaimed: {
      opacity: 0.6,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
};
