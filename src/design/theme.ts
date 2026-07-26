import type { ThemeConfig } from 'antd';
import { colors, radii, shadows } from './tokens';

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: colors.primary,
    colorSuccess: colors.success,
    colorWarning: colors.warning,
    colorError: colors.error,
    colorInfo: colors.info,
    colorText: colors.text,
    colorTextSecondary: colors.textSecondary,
    colorBorder: colors.borderStrong,
    colorBgLayout: colors.bg,
    colorBgContainer: colors.bgElevated,
    borderRadius: radii.md,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    controlHeight: 34,
    boxShadowSecondary: shadows.card,
    fontSize: 14,
    lineHeightHeading1: 1.25,
    lineHeightHeading2: 1.3,
    lineHeightHeading3: 1.35,
  },
  components: {
    Layout: {
      siderBg: colors.sidebar,
      headerBg: colors.bgElevated,
      bodyBg: colors.bg,
      triggerBg: colors.bg,
      triggerColor: colors.textSecondary,
    },
    Menu: {
      itemHeight: 42,
      itemBg: colors.bgElevated,
      itemColor: colors.text,
      itemSelectedBg: colors.sidebarActive,
      itemSelectedColor: colors.primary,
      itemHoverBg: colors.sidebarHover,
      itemHoverColor: colors.primary,
      darkItemBg: colors.sidebar,
      darkSubMenuItemBg: colors.sidebar,
      darkItemSelectedBg: colors.primary,
      itemBorderRadius: radii.md,
    },
    Card: {
      headerBg: colors.bgElevated,
      headerFontSize: 16,
      borderRadiusLG: radii.lg,
      bodyPadding: 16,
    },
    Button: {
      borderRadius: radii.md,
      controlHeight: 34,
      paddingInline: 16,
    },
    Tag: {
      borderRadiusSM: radii.sm,
    },
    Input: {
      borderRadius: radii.md,
      controlHeight: 34,
    },
    Table: {
      rowHoverBg: '#F8FAFF',
    },
  },
};
