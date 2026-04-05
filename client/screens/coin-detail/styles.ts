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
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.lg,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: Spacing.sm,
    },
    pairName: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    currentPrice: {
      fontSize: 24,
      fontWeight: '700',
    },
    priceUp: {
      color: '#22C55E',
    },
    priceDown: {
      color: '#EF4444',
    },
    priceChangeText: {
      fontSize: 14,
      fontWeight: '500',
    },
    headerActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    statsRow: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      gap: Spacing.lg,
    },
    statItem: {
      flex: 1,
    },
    statLabel: {
      fontSize: 12,
      color: '#6B7280',
      marginBottom: 4,
    },
    statValue: {
      fontSize: 14,
      fontWeight: '500',
      color: '#FFFFFF',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: Spacing.sm,
      color: '#6B7280',
    },
    klineLoading: {
      position: 'absolute',
      top: 40,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    tradeButtons: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.lg,
      gap: Spacing.md,
    },
    buyButton: {
      flex: 1,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      backgroundColor: '#F59E0B',
      alignItems: 'center',
    },
    sellButton: {
      flex: 1,
      paddingVertical: Spacing.lg,
      borderRadius: BorderRadius.lg,
      backgroundColor: '#EF4444',
      alignItems: 'center',
    },
    tradeButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    // Tab 切换
    tabContainer: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
    },
    tab: {
      flex: 1,
      paddingVertical: Spacing.sm,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: '#F59E0B',
    },
    tabText: {
      fontSize: 14,
      color: '#6B7280',
    },
    tabTextActive: {
      color: '#F59E0B',
      fontWeight: '600',
    },
    // 订单簿
    orderbookContainer: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    orderbookHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: Spacing.sm,
    },
    orderbookTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    orderbookRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    orderbookAmount: {
      fontSize: 13,
      color: '#9CA3AF',
    },
    orderbookBarContainer: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: '50%',
    },
    orderbookBarBuy: {
      position: 'absolute',
      right: 0,
      backgroundColor: 'rgba(34, 197, 94, 0.15)',
      height: '100%',
    },
    orderbookBarSell: {
      position: 'absolute',
      right: 0,
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      height: '100%',
    },
    // 订单簿 Tab 样式
    orderbookSection: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    orderbookHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: Spacing.sm,
    },
    orderbookTitleText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    orderbookHalf: {
      flex: 1,
      paddingHorizontal: Spacing.xs,
    },
    orderbookHeaderLabel: {
      fontSize: 11,
      color: '#6B7280',
      textAlign: 'center',
    },
    orderbookListRow: {
      flexDirection: 'row',
      marginTop: Spacing.xs,
    },
    orderbookItemBuy: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
      paddingHorizontal: Spacing.sm,
      borderRadius: 4,
      marginBottom: 2,
      position: 'relative',
      overflow: 'hidden',
      minHeight: 28,
    },
    orderbookItemSell: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
      paddingHorizontal: Spacing.sm,
      borderRadius: 4,
      marginBottom: 2,
      position: 'relative',
      overflow: 'hidden',
      minHeight: 28,
    },
    // 热力背景条
    orderbookDepthBar: {
      position: 'absolute',
      top: 0,
      bottom: 0,
    },
    orderbookDepthBarBuy: {
      right: 0,
      backgroundColor: 'rgba(34, 197, 94, 0.25)',
      borderTopLeftRadius: 4,
      borderBottomLeftRadius: 4,
    },
    orderbookDepthBarSell: {
      left: 0,
      backgroundColor: 'rgba(239, 68, 68, 0.25)',
      borderTopRightRadius: 4,
      borderBottomRightRadius: 4,
    },
    orderbookPriceBuy: {
      fontSize: 12,
      color: '#22C55E',
      fontWeight: '500',
    },
    orderbookPriceSell: {
      fontSize: 12,
      color: '#EF4444',
      fontWeight: '500',
    },
    orderbookAmountText: {
      fontSize: 12,
      color: '#9CA3AF',
    },
    orderbookEmpty: {
      paddingVertical: Spacing.xl,
      alignItems: 'center',
    },
    orderbookEmptyText: {
      fontSize: 12,
      color: '#6B7280',
    },
    orderbookSummary: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.1)',
    },
    orderbookSummaryItem: {
      alignItems: 'center',
    },
    orderbookSummaryLabel: {
      fontSize: 11,
      color: '#6B7280',
      marginBottom: 4,
    },
    orderbookSummaryValue: {
      fontSize: 14,
      fontWeight: '600',
    },
    // 挂单表单
    orderForm: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: BorderRadius.lg,
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
    },
    orderFormHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    orderFormTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    orderTypeToggle: {
      flexDirection: 'row',
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderRadius: BorderRadius.sm,
    },
    orderTypeBtn: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.sm,
    },
    orderTypeBtnActive: {
      backgroundColor: '#F59E0B',
    },
    orderTypeText: {
      fontSize: 13,
      color: '#9CA3AF',
    },
    orderTypeTextActive: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    inputGroup: {
      marginBottom: Spacing.sm,
    },
    inputLabel: {
      fontSize: 12,
      color: '#6B7280',
      marginBottom: 4,
    },
    inputLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    maxBtn: {
      backgroundColor: 'rgba(245, 158, 11, 0.2)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    maxBtnText: {
      fontSize: 11,
      color: '#F59E0B',
      fontWeight: '600',
    },
    input: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      fontSize: 16,
      color: '#FFFFFF',
    },
    inputRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    balanceInfo: {
      fontSize: 12,
      color: '#6B7280',
      marginTop: 2,
    },
    feeInfo: {
      fontSize: 11,
      color: '#F59E0B',
      marginTop: 4,
    },
    submitBtn: {
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    submitBtnBuy: {
      backgroundColor: '#22C55E',
    },
    submitBtnSell: {
      backgroundColor: '#EF4444',
    },
    submitBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    // 我的挂单
    myOrdersSection: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl,
    },
    myOrdersHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    myOrdersTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    myOrdersEmpty: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
    },
    myOrdersEmptyText: {
      fontSize: 14,
      color: '#6B7280',
      marginTop: Spacing.sm,
    },
    myOrderItem: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    myOrderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    myOrderLeft: {
      flex: 1,
    },
    myOrderType: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 2,
    },
    myOrderAmount: {
      fontSize: 14,
      color: '#FFFFFF',
    },
    myOrderRight: {
      alignItems: 'flex-end',
    },
    myOrderPrice: {
      fontSize: 14,
      color: '#FFFFFF',
    },
    myOrderStatus: {
      fontSize: 12,
      color: '#6B7280',
      marginTop: 2,
    },
    cancelBtn: {
      marginTop: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      backgroundColor: 'rgba(239,68,68,0.2)',
      borderRadius: 4,
    },
    cancelBtnText: {
      fontSize: 12,
      color: '#EF4444',
    },
    // 交易历史
    historySection: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl,
    },
    historyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    historyTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    historyEmpty: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
    },
    historyEmptyText: {
      fontSize: 14,
      color: '#6B7280',
      marginTop: Spacing.sm,
    },
    historyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.sm,
    },
    historyLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    historyTypeBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: 4,
      marginRight: Spacing.sm,
    },
    historyTypeBuy: {
      backgroundColor: 'rgba(34,197,94,0.2)',
    },
    historyTypeSell: {
      backgroundColor: 'rgba(239,68,68,0.2)',
    },
    historyTypeText: {
      fontSize: 12,
      fontWeight: '500',
    },
    historyAmount: {
      fontSize: 14,
      fontWeight: '500',
      color: '#FFFFFF',
    },
    historyRight: {
      alignItems: 'flex-end',
    },
    historyPriceLabel: {
      fontSize: 11,
      color: '#9CA3AF',
      marginBottom: 2,
    },
    historyPrice: {
      fontSize: 14,
      fontWeight: '500',
      color: '#FFFFFF',
    },
    historyTime: {
      fontSize: 11,
      color: '#6B7280',
      marginTop: 2,
    },
    historyFee: {
      fontSize: 11,
      color: '#F59E0B',
      marginTop: 2,
    },
    // 订单簿深度条
    depthBarContainer: {
      position: 'relative',
      marginBottom: 2,
    },
    depthBar: {
      position: 'absolute',
      height: 24,
      opacity: 0.15,
    },
    // 代币信息
    tokenInfoContainer: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl,
    },
    tokenInfoCard: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    tokenInfoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    tokenIconLarge: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: 'rgba(245,158,11,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    tokenInfoTitle: {
      flex: 1,
    },
    tokenName: {
      fontSize: 20,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 4,
    },
    tokenSymbol: {
      fontSize: 14,
      color: '#9CA3AF',
    },
    tokenDescription: {
      fontSize: 14,
      color: '#D1D5DB',
      lineHeight: 22,
    },
    tokenDataCard: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
      marginBottom: Spacing.md,
    },
    dataRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    dataLabel: {
      fontSize: 14,
      color: '#9CA3AF',
    },
    dataValue: {
      fontSize: 14,
      fontWeight: '500',
      color: '#FFFFFF',
    },
    featureGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    featureItem: {
      width: '45%',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(245,158,11,0.1)',
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    featureLabel: {
      fontSize: 13,
      color: '#F59E0B',
      fontWeight: '500',
    },
  });
};