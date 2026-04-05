import { StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
    },
    scrollContent: {
      paddingBottom: Spacing["5xl"],
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing["2xl"],
      marginBottom: Spacing.lg,
    },
    filterToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#1F2937',
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
    },
    filterToggleText: {
      fontSize: 14,
      color: '#F59E0B',
      fontWeight: '500',
    },
    filterWrap: {
      marginBottom: Spacing.lg,
      paddingHorizontal: Spacing.lg,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    filterButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: '#1F2937',
    },
    filterButtonActive: {
      backgroundColor: '#F59E0B',
    },
    filterButtonText: {
      fontSize: 13,
      color: '#9CA3AF',
    },
    filterButtonTextActive: {
      color: '#000000',
      fontWeight: '600',
    },
    // 日期分组
    dateGroup: {
      marginBottom: Spacing.lg,
    },
    dateHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
    },
    dateLine: {
      flex: 1,
      height: 1,
      backgroundColor: '#1F2937',
    },
    dateText: {
      fontSize: 13,
      color: '#6B7280',
      marginHorizontal: 12,
      fontWeight: '500',
    },
    // 时间线行
    timelineRow: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.lg,
    },
    timelineLeft: {
      width: 60,
      alignItems: 'center',
    },
    timeText: {
      fontSize: 12,
      color: '#6B7280',
      marginBottom: 8,
    },
    timelineDotWrap: {
      alignItems: 'center',
      flex: 1,
    },
    timelineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    timelineLine: {
      width: 2,
      flex: 1,
      backgroundColor: '#1F2937',
      marginTop: 4,
    },
    // 卡片
    timelineCard: {
      flex: 1,
      backgroundColor: '#0A0A0A',
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: '#1F2937',
    },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    typeIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    typeText: {
      fontSize: 14,
      color: '#FFFFFF',
      fontWeight: '500',
    },
    amountText: {
      fontSize: 15,
      fontWeight: '700',
    },
    noteText: {
      fontSize: 12,
      color: '#6B7280',
      marginTop: 8,
    },
    // 空状态
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 100,
    },
    emptyIcon: {
      marginBottom: 16,
      opacity: 0.5,
    },
    emptyText: {
      fontSize: 15,
      color: '#6B7280',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 100,
    },
  });
};
