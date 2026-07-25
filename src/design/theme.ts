import type { ThemeConfig } from 'antd';
import { colors, radii } from './tokens';

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
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans SC', sans-serif",
  },
  components: {
    Layout: {
      siderBg: colors.sidebar,
      headerBg: colors.bgElevated,
      bodyBg: colors.bg,
    },
    Menu: {
      darkItemBg: colors.sidebar,
      darkSubMenuItemBg: colors.sidebar,
    },
    Card: {
      borderRadiusLG: radii.lg,
    },
  },
};
