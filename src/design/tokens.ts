export const colors = {
  primary: '#1677FF',
  primaryHover: '#4096FF',
  primaryActive: '#0958D9',
  success: '#52C41A',
  warning: '#FA8C16',
  error: '#FF4D4F',
  info: '#13C2C2',
  text: '#101828',
  textSecondary: '#475467',
  textTertiary: '#667085',
  border: '#E5E7EB',
  borderStrong: '#D0D5DD',
  bg: '#F5F7FA',
  bgElevated: '#FFFFFF',
  sidebar: '#FFFFFF',
  sidebarText: '#1D2939',
  sidebarMuted: '#667085',
  sidebarHover: '#EEF2FF',
  sidebarActive: '#E8F1FF',
} as const;

export const statusColors = {
  matched: '#52C41A',
  reshoot: '#FA8C16',
  missing: '#FF4D4F',
  ai_placeholder: '#13C2C2',
  pass: '#52C41A',
  warn: '#FA8C16',
  fail: '#FF4D4F',
  pending: '#8C8C8C',
  draft: '#8C8C8C',
  briefing: '#1677FF',
  scripting: '#1677FF',
  storyboarding: '#13C2C2',
  production: '#722ED1',
  reviewing: '#FA8C16',
  exported: '#52C41A',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 8,
  lg: 10,
} as const;

export const shadows = {
  card: '0 2px 8px rgba(16, 24, 40, 0.05)',
  elevated: '0 10px 28px rgba(16, 24, 40, 0.09)',
} as const;

export const layout = {
  sidebarWidth: 208,
  topbarHeight: 68,
  contentMaxWidth: 1432,
  contentMinHeight: 'calc(100vh - 68px - 32px)',
  pagePadding: 16,
} as const;

export const zIndex = {
  sidebar: 30,
  topbar: 20,
  overlay: 1000,
} as const;
