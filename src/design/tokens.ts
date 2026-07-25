export const colors = {
  primary: '#1677FF',
  primaryHover: '#4096FF',
  primaryActive: '#0958D9',
  success: '#52C41A',
  warning: '#FA8C16',
  error: '#FF4D4F',
  info: '#13C2C2',
  text: '#1F1F1F',
  textSecondary: '#595959',
  textTertiary: '#8C8C8C',
  border: '#F0F0F0',
  borderStrong: '#D9D9D9',
  bg: '#F5F7FA',
  bgElevated: '#FFFFFF',
  sidebar: '#001529',
  sidebarText: 'rgba(255,255,255,0.85)',
  sidebarMuted: 'rgba(255,255,255,0.45)',
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
  sm: 4,
  md: 8,
  lg: 12,
} as const;

export const shadows = {
  card: '0 1px 2px 0 rgba(0,0,0,0.03), 0 1px 6px -1px rgba(0,0,0,0.02), 0 2px 4px 0 rgba(0,0,0,0.02)',
  elevated: '0 6px 16px 0 rgba(0,0,0,0.08), 0 3px 6px -4px rgba(0,0,0,0.12)',
} as const;

export const layout = {
  sidebarWidth: 220,
  topbarHeight: 56,
  contentMaxWidth: 1440,
  contentMinHeight: 'calc(100vh - 56px - 48px)',
  pagePadding: 24,
} as const;

export const zIndex = {
  sidebar: 30,
  topbar: 20,
  overlay: 1000,
} as const;
