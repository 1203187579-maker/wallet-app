import { StyleSheet, Platform } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0D0D0D',
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing['6xl'],
    },
    
    // Header
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: Spacing.xl,
    },
    headerLeft: {
      flex: 1,
    },
    headerTitle: {
      color: '#FFFFFF',
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    headerSubtitle: {
      color: '#6B7280',
      fontSize: 13,
      marginTop: Spacing.xs,
    },
    headerRight: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#1A1A1A',
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    // Action Buttons
    actionButtons: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginBottom: Spacing.xl,
    },
    buyButton: {
      flex: 1,
      backgroundColor: '#1A1A1A',
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      alignItems: 'center',
    },
    buyButtonIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    buyButtonTitle: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
      marginBottom: Spacing.xs,
    },
    buyButtonDesc: {
      color: '#6B7280',
      fontSize: 12,
    },
    sellActionButton: {
      flex: 1,
      backgroundColor: '#F59E0B',
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      alignItems: 'center',
    },
    sellButtonIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(0, 0, 0, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    sellButtonTitle: {
      color: '#000000',
      fontSize: 15,
      fontWeight: '600',
      marginBottom: Spacing.xs,
    },
    sellButtonDesc: {
      color: 'rgba(0, 0, 0, 0.6)',
      fontSize: 12,
    },
    
    // Zone Toggle
    zoneToggle: {
      flexDirection: 'row',
      backgroundColor: '#1A1A1A',
      borderRadius: BorderRadius.lg,
      padding: 4,
      marginBottom: Spacing.lg,
    },
    zoneBtn: {
      flex: 1,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      borderRadius: BorderRadius.md,
    },
    zoneBtnActive: {
      backgroundColor: '#F59E0B',
    },
    zoneText: {
      color: '#6B7280',
      fontSize: 14,
      fontWeight: '500',
    },
    zoneTextActive: {
      color: '#000000',
      fontSize: 14,
      fontWeight: '600',
    },
    
    // Zone Content
    zoneContent: {
      marginTop: Spacing.md,
    },
    zoneHeader: {
      marginBottom: Spacing.lg,
    },
    zoneTitle: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },
    zoneDesc: {
      color: '#6B7280',
      fontSize: 13,
      marginTop: Spacing.xs,
    },
    
    // Order Card
    orderCard: {
      backgroundColor: '#1A1A1A',
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: '#2A2A2A',
    },
    orderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    userName: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
    },
    orderTime: {
      color: '#6B7280',
      fontSize: 12,
      marginTop: 2,
    },
    orderTotal: {
      color: '#F59E0B',
      fontSize: 18,
      fontWeight: '700',
    },
    
    // Order Divider
    orderDivider: {
      height: 1,
      backgroundColor: '#2A2A2A',
      marginVertical: Spacing.md,
    },
    
    // Order Details
    orderDetails: {
      backgroundColor: '#0D0D0D',
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    // 聊天窗口中订单详情展开/收起样式
    orderDetailsCollapsible: {
      backgroundColor: '#0D0D0D',
      borderRadius: BorderRadius.lg,
      marginHorizontal: Spacing.md,
      marginTop: Spacing.sm,
      overflow: 'hidden',
    },
    orderDetailHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: Spacing.md,
    },
    orderDetailSummary: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    orderDetailsExpanded: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.md,
      gap: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: '#2A2A2A',
      paddingTop: Spacing.md,
    },
    paymentInfoSection: {
      marginTop: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: '#2A2A2A',
    },
    // 收款方式展开/收起样式
    paymentMethodHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
    },
    paymentMethodHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    paymentMethodTitle: {
      color: '#FFFFFF',
    },
    selectedPaymentBadge: {
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      paddingHorizontal: Spacing.xs,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
      marginLeft: Spacing.xs,
    },
    selectedPaymentText: {
      color: '#F59E0B',
    },
    paymentMethodContent: {
      marginTop: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: '#2A2A2A',
    },
    paymentInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.xs,
    },
    paymentInfoLabel: {
      color: '#6B7280',
    },
    paymentInfoValue: {
      color: '#D1D5DB',
    },
    orderDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 2,
    },
    detailLabel: {
      color: '#9CA3AF',
      fontSize: 13,
    },
    detailValue: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '500',
    },
    detailValueHighlight: {
      color: '#F59E0B',
      fontSize: 15,
      fontWeight: '600',
    },
    
    // Status Badge
    statusBadge: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
      borderRadius: 12,
    },
    statusBadgeSmall: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: 8,
    },
    
    // Sell Button in Card (已移除，保留样式以备后用)
    sellButton: {
      backgroundColor: '#F59E0B',
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      marginTop: Spacing.md,
    },
    sellButtonText: {
      color: '#000000',
      fontSize: 14,
      fontWeight: '600',
    },
    
    // 排队购买提示
    queueHint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      marginTop: Spacing.md,
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderRadius: BorderRadius.lg,
      gap: Spacing.xs,
    },
    queueHintText: {
      color: '#F59E0B',
    },
    
    // Cancel Button
    cancelButton: {
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      marginTop: Spacing.md,
      borderWidth: 1,
      borderColor: '#EF4444',
    },
    cancelButtonText: {
      color: '#EF4444',
      fontSize: 14,
      fontWeight: '600',
    },
    
    // Order Action Hint
    orderActionHint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: '#2A2A2A',
    },
    actionHintText: {
      color: '#F59E0B',
      fontSize: 13,
    },
    orderClosedHint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: '#2A2A2A',
    },
    orderClosedHintText: {
      color: '#6B7280',
      fontSize: 13,
    },
    
    // 收款信息紧凑展示样式（用于聊天窗口展开区域）
    paymentInfoCompact: {
      marginTop: Spacing.sm,
    },
    paymentAccountText: {
      color: '#FFFFFF',
      fontFamily: 'monospace',
    },
    viewQrcodeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    
    // Empty State
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: Spacing['4xl'],
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#1A1A1A',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    emptyText: {
      color: '#6B7280',
      fontSize: 14,
    },
    emptyMessages: {
      alignItems: 'center',
      paddingVertical: Spacing['3xl'],
    },
    
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      justifyContent: 'flex-start',
    },
    
    // Form Modal
    formModal: {
      backgroundColor: '#1A1A1A',
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      padding: Spacing.xl,
      paddingBottom: Spacing['2xl'],
      marginTop: 60,
    },
    
    // Order Detail Modal
    orderDetailModal: {
      backgroundColor: '#0D0D0D',
      marginTop: 50,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      maxHeight: '85%',
      flex: 1,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.lg,
    },
    modalTitle: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '700',
    },
    modalCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#1A1A1A',
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    // Filter
    filterScroll: {
      flexGrow: 0,
    },
    filterContainer: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.lg,
    },
    filterBtn: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: 20,
      backgroundColor: '#1A1A1A',
      marginRight: Spacing.sm,
    },
    filterBtnActive: {
      backgroundColor: '#F59E0B',
    },
    filterText: {
      color: '#6B7280',
      fontSize: 13,
      fontWeight: '500',
    },
    filterTextActive: {
      color: '#000000',
      fontSize: 13,
      fontWeight: '600',
    },
    
    // Order List
    orderList: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl,
    },
    
    // Chat Modal
    chatModal: {
      backgroundColor: '#0D0D0D',
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      flex: 1,
      maxHeight: '90%',
    },
    
    // Chat Header
    chatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: '#1A1A1A',
      gap: Spacing.md,
    },
    chatHeaderInfo: {
      flex: 1,
    },
    chatHeaderTitle: {
      color: '#FFFFFF',
      fontSize: 16,
    },
    chatHeaderSubtitle: {
      color: '#6B7280',
      fontSize: 12,
      marginTop: 2,
    },
    
    // Payment Proof View (for seller in chat)
    paymentProofViewSection: {
      marginTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: '#2A2A2A',
      paddingTop: Spacing.md,
    },
    paymentProofViewImage: {
      width: '100%',
      height: 200,
      borderRadius: BorderRadius.lg,
      backgroundColor: '#0D0D0D',
    },
    
    // Seller Payment Info Section
    sellerPaymentSection: {
      marginTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: '#2A2A2A',
      paddingTop: Spacing.md,
    },
    sellerPaymentTitle: {
      color: '#F59E0B',
      marginBottom: Spacing.sm,
    },
    
    // 支付方式选择器
    paymentTypeSelector: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    paymentTypeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: '#0D0D0D',
      borderWidth: 1,
      borderColor: '#2A2A2A',
    },
    paymentTypeBtnActive: {
      borderColor: '#F59E0B',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
    },
    paymentTypeBtnText: {
      color: '#6B7280',
    },
    paymentTypeBtnTextActive: {
      color: '#F59E0B',
      fontWeight: '600',
    },
    
    // 选中的支付方式卡片
    selectedPaymentCard: {
      backgroundColor: '#0D0D0D',
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: '#2A2A2A',
    },
    paymentCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    paymentIconWrap: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.lg,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    paymentCardInfo: {
      flex: 1,
    },
    paymentCardTitle: {
      color: '#FFFFFF',
      fontWeight: '600',
      marginBottom: Spacing.xs,
    },
    paymentCardAccount: {
      color: '#9CA3AF',
      fontFamily: 'monospace',
    },
    paymentCardRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: '#2A2A2A',
    },
    paymentCardLabel: {
      color: '#6B7280',
    },
    paymentCardValue: {
      color: '#FFFFFF',
    },
    
    // 收款码行
    qrcodeTouch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    qrcodeImageLarge: {
      width: 24,
      height: 24,
      borderRadius: 4,
    },
    qrcodeHint: {
      color: '#F59E0B',
    },
    
    sellerPaymentItem: {
      backgroundColor: '#0D0D0D',
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    sellerPaymentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.xs,
    },
    sellerPaymentType: {
      color: '#9CA3AF',
    },
    sellerPaymentAccount: {
      color: '#FFFFFF',
      fontFamily: 'monospace',
    },
    sellerPhoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.xs,
    },
    sellerPhoneText: {
      color: '#9CA3AF',
      marginLeft: Spacing.xs,
    },
    sellerQrcodeImage: {
      width: 100,
      height: 100,
      marginTop: Spacing.sm,
      borderRadius: BorderRadius.md,
    },
    
    // Chat Actions
    chatActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: Spacing.md,
      padding: Spacing.md,
      backgroundColor: '#1A1A1A',
    },
    chatActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.lg,
      backgroundColor: '#0D0D0D',
    },
    releaseBtn: {
      backgroundColor: '#22C55E',
    },
    confirmPaymentBtn: {
      backgroundColor: '#22C55E',
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
    },
    chatActionTextGreen: {
      color: '#22C55E',
    },
    chatActionTextRed: {
      color: '#EF4444',
    },
    chatActionTextYellow: {
      color: '#F59E0B',
    },
    chatActionTextBlue: {
      color: '#3B82F6',
    },
    chatActionTextWhite: {
      color: '#FFFFFF',
    },
    
    // Payment Proof
    paymentProofSection: {
      width: '100%',
      marginBottom: Spacing.md,
    },
    paymentProofLabel: {
      color: '#9CA3AF',
      marginBottom: Spacing.sm,
    },
    uploadProofBtn: {
      width: '100%',
      height: 100,
      backgroundColor: '#1A1A1A',
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: '#374151',
      justifyContent: 'center',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    uploadProofText: {
      color: '#6B7280',
    },
    paymentProofPreview: {
      width: '100%',
      height: 150,
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
      position: 'relative',
    },
    paymentProofImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    removeProofBtn: {
      position: 'absolute',
      top: Spacing.sm,
      right: Spacing.sm,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    // Appealing Notice
    appealingNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
    },
    appealingText: {
      color: '#F59E0B',
    },
    
    // Waiting Notice (buyer in paid status)
    waitingNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
    },
    waitingText: {
      color: '#F59E0B',
    },
    
    // Order Closed Notice
    orderClosedNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      padding: Spacing.md,
      backgroundColor: '#1A1A1A',
    },
    orderClosedText: {
      color: '#6B7280',
    },
    
    // Message List
    messageList: {
      flex: 1,
      backgroundColor: '#0D0D0D',
    },
    messageListContent: {
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    
    // System Message
    systemMessage: {
      alignItems: 'center',
      paddingVertical: Spacing.sm,
    },
    systemMessageText: {
      color: '#6B7280',
      fontSize: 12,
      backgroundColor: '#1A1A1A',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.md,
    },
    
    // Message Bubble
    messageBubble: {
      maxWidth: '75%',
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
    },
    messageBubbleMine: {
      alignSelf: 'flex-end',
      backgroundColor: '#F59E0B',
      borderBottomRightRadius: 4,
    },
    messageBubbleOther: {
      alignSelf: 'flex-start',
      backgroundColor: '#2A2A2A',
      borderBottomLeftRadius: 4,
    },
    messageTextMine: {
      color: '#000000',
      fontSize: 14,
    },
    messageTextOther: {
      color: '#FFFFFF',
      fontSize: 14,
    },
    messageTime: {
      color: 'rgba(255, 255, 255, 0.5)',
      fontSize: 10,
      marginTop: 4,
      textAlign: 'right',
    },
    
    // Input Bar
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Spacing.sm,
      padding: Spacing.md,
      backgroundColor: '#1A1A1A',
    },
    messageInput: {
      flex: 1,
      backgroundColor: '#0D0D0D',
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      color: '#FFFFFF',
      fontSize: 14,
      maxHeight: 100,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#F59E0B',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendBtnDisabled: {
      backgroundColor: '#2A2A2A',
    },
    
    // Input Bar Disabled
    inputBarDisabled: {
      padding: Spacing.lg,
      backgroundColor: '#1A1A1A',
      alignItems: 'center',
    },
    inputDisabledText: {
      color: '#6B7280',
    },
    
    // Form
    formGroup: {
      marginBottom: Spacing.lg,
    },
    formLabel: {
      color: '#9CA3AF',
      fontSize: 12,
      marginBottom: Spacing.sm,
    },
    formInput: {
      backgroundColor: '#0D0D0D',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      color: '#FFFFFF',
      fontSize: 16,
    },
    inputWithSuffix: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#0D0D0D',
      borderRadius: BorderRadius.lg,
      paddingLeft: Spacing.lg,
    },
    formInputFlex: {
      flex: 1,
      padding: Spacing.lg,
      color: '#FFFFFF',
      fontSize: 16,
    },
    inputSuffix: {
      color: '#6B7280',
      fontSize: 13,
      paddingRight: Spacing.lg,
    },
    
    // Total Info
    totalInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    totalLabel: {
      color: '#9CA3AF',
      fontSize: 13,
    },
    totalValue: {
      color: '#F59E0B',
      fontSize: 18,
      fontWeight: '600',
    },
    
    // Confirm Info
    confirmInfo: {
      gap: Spacing.md,
      marginBottom: Spacing.xl,
    },
    confirmRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    confirmInputRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#1A1A1A',
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    confirmLabel: {
      color: '#6B7280',
      fontSize: 13,
    },
    confirmValue: {
      color: '#FFFFFF',
      fontSize: 15,
    },
    confirmValueHighlight: {
      color: '#F59E0B',
      fontSize: 18,
      fontWeight: '600',
    },
    amountInput: {
      flex: 1,
      textAlign: 'right',
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
      paddingVertical: Spacing.xs,
      marginLeft: Spacing.md,
    },
    
    // Submit Button
    submitBtn: {
      backgroundColor: '#F59E0B',
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
    },
    submitBtnDisabled: {
      backgroundColor: '#4B5563',
    },
    submitBtnText: {
      color: '#000000',
      fontSize: 16,
      fontWeight: '600',
    },
    
    // Loading
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    // Image Preview Modal
    imagePreviewOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imagePreviewClose: {
      position: 'absolute',
      top: Spacing['2xl'],
      right: Spacing.lg,
      zIndex: 10,
      padding: Spacing.md,
    },
    imagePreviewContent: {
      width: '90%',
      height: '80%',
    },
    
    // Auto Match Card
    autoMatchCard: {
      backgroundColor: '#1A1A1A',
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
      borderWidth: 1,
      borderColor: '#2A2A2A',
    },
    autoMatchHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    autoMatchTitle: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    zoneBadge: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
    },
    bigBadge: {
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
    },
    smallBadge: {
      backgroundColor: 'rgba(34, 197, 94, 0.2)',
    },
    zoneBadgeText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '500',
    },
    autoMatchInfo: {
      gap: Spacing.sm,
    },
    autoMatchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.xs,
    },
    autoMatchLabel: {
      color: '#6B7280',
      fontSize: 14,
    },
    autoMatchValue: {
      color: '#FFFFFF',
      fontSize: 15,
    },
    autoMatchValueHighlight: {
      color: '#F59E0B',
      fontSize: 18,
      fontWeight: '700',
    },
  });
};
