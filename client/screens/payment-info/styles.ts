import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing['2xl'],
      paddingBottom: Spacing['5xl'],
    },
    
    header: {
      marginBottom: Spacing.xl,
    },
    headerTitle: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '700',
    },
    headerSubtitle: {
      color: '#6B7280',
      fontSize: 14,
      marginTop: Spacing.xs,
    },
    
    // Payment Type Card
    paymentCard: {
      backgroundColor: '#1A1A1A',
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: '#2A2A2A',
    },
    paymentCardActive: {
      borderColor: '#F59E0B',
    },
    paymentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    paymentHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    paymentIcon: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.lg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    paymentTitle: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    paymentStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    paymentStatusText: {
      color: '#22C55E',
      fontSize: 12,
    },
    
    // Payment Card Touch Area
    paymentCardTouchArea: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.xs,
    },
    existingInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    emptyInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    clickHint: {
      position: 'absolute',
      right: 0,
      top: '50%',
      marginTop: -8,
    },
    
    // Input
    inputContainer: {
      marginTop: Spacing.sm,
    },
    inputContainerNoLabel: {
      marginTop: Spacing.md,
    },
    inputLabel: {
      color: '#9CA3AF',
      fontSize: 12,
      marginBottom: Spacing.xs,
    },
    input: {
      backgroundColor: '#0D0D0D',
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      color: '#FFFFFF',
      fontSize: 14,
      borderWidth: 1,
      borderColor: '#2A2A2A',
    },
    inputFocused: {
      borderColor: '#F59E0B',
    },
    inputHint: {
      color: '#6B7280',
      fontSize: 11,
      marginTop: Spacing.xs,
    },
    
    // QR Code Upload
    qrcodeSection: {
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: '#2A2A2A',
    },
    qrcodeLabel: {
      color: '#9CA3AF',
      fontSize: 12,
      marginBottom: Spacing.sm,
    },
    qrcodeUploadBtn: {
      backgroundColor: '#0D0D0D',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#2A2A2A',
      borderStyle: 'dashed',
    },
    qrcodePreview: {
      position: 'relative',
      alignItems: 'center',
    },
    qrcodeImage: {
      width: 150,
      height: 150,
      borderRadius: BorderRadius.lg,
    },
    qrcodeRemoveBtn: {
      position: 'absolute',
      top: -8,
      right: -8,
      backgroundColor: '#EF4444',
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    // Buttons
    buttonGroup: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.md,
    },
    saveBtn: {
      flex: 1,
      backgroundColor: '#F59E0B',
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
    },
    saveBtnText: {
      color: '#000000',
      fontSize: 14,
      fontWeight: '600',
    },
    deleteBtn: {
      backgroundColor: '#EF4444',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    
    // Loading
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    // Empty
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: Spacing['4xl'],
    },
    emptyText: {
      color: '#6B7280',
      fontSize: 14,
      marginTop: Spacing.md,
    },
  });
};
