// 加密货币钱包配色 - 橙黄亮色调风格
export const Colors = {
  light: {
    textPrimary: "#FFFFFF",
    textSecondary: "#9CA3AF",
    textMuted: "#6B7280",
    primary: "#F59E0B", // 橙黄色 - 主色
    primaryLight: "#FBBF24", // 浅橙黄
    primaryDark: "#D97706", // 深橙黄
    accent: "#10B981", // 绿色 - 辅助色（用于质押收益）
    success: "#22C55E", // 成功绿
    error: "#EF4444", // 错误红
    warning: "#F59E0B",
    backgroundRoot: "#000000", // 纯黑背景
    backgroundDefault: "#111827", // 卡片背景
    backgroundTertiary: "#1F2937", // 三级背景
    backgroundCard: "#1A1A1A", // 资产卡片背景
    buttonPrimaryText: "#000000",
    tabIconSelected: "#F59E0B",
    tabIconDefault: "#6B7280",
    border: "rgba(255,255,255,0.1)",
    borderLight: "rgba(255,255,255,0.05)",
    shadowGlow: "rgba(245,158,11,0.3)", // 橙黄发光色
    orange: "#F59E0B",
    orangeLight: "#FBBF24",
    green: "#10B981",
    greenLight: "#34D399",
  },
  dark: {
    textPrimary: "#FFFFFF",
    textSecondary: "#9CA3AF",
    textMuted: "#6B7280",
    primary: "#F59E0B",
    primaryLight: "#FBBF24",
    primaryDark: "#D97706",
    accent: "#10B981",
    success: "#22C55E",
    error: "#EF4444",
    warning: "#F59E0B",
    backgroundRoot: "#000000",
    backgroundDefault: "#111827",
    backgroundTertiary: "#1F2937",
    backgroundCard: "#1A1A1A",
    buttonPrimaryText: "#000000",
    tabIconSelected: "#F59E0B",
    tabIconDefault: "#6B7280",
    border: "rgba(255,255,255,0.1)",
    borderLight: "rgba(255,255,255,0.05)",
    shadowGlow: "rgba(245,158,11,0.3)",
    orange: "#F59E0B",
    orangeLight: "#FBBF24",
    green: "#10B981",
    greenLight: "#34D399",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 64,
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 28,
  "4xl": 32,
  full: 9999,
};

export const Typography = {
  display: {
    fontSize: 112,
    lineHeight: 112,
    fontWeight: "200" as const,
    letterSpacing: -4,
  },
  displayLarge: {
    fontSize: 112,
    lineHeight: 112,
    fontWeight: "200" as const,
    letterSpacing: -2,
  },
  displayMedium: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: "200" as const,
  },
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700" as const,
  },
  h4: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  bodyMedium: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  smallMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500" as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
  },
  captionMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "500" as const,
  },
  labelSmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
  },
  stat: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700" as const,
    fontVariant: ["tabular-nums" as const],
  },
  statLarge: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: "700" as const,
    fontVariant: ["tabular-nums" as const],
  },
  tiny: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "400" as const,
  },
  navLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
};

export type Theme = typeof Colors.light;
