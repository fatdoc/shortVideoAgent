export const colors = {
  primary: '#F25A1D',
  primaryHover: '#FF6A2A',
  primaryActive: '#C84312',
  success: '#2F8F5B',
  warning: '#C97916',
  error: '#C63D32',
  info: '#4B6F85',
  text: '#242424',
  textSecondary: '#5F6368',
  textTertiary: '#8B8F94',
  border: '#ECE7E1',
  borderStrong: '#D8D3CC',
  bg: '#F7F5F1',
  bgElevated: '#FFFEFC',
  bgSubtle: '#F1EEE9',
  sidebar: '#FFFEFC',
  sidebarText: '#303030',
  sidebarMuted: '#77736D',
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
  briefing: '#F25A1D',
  scripting: '#F25A1D',
  storyboarding: '#4B6F85',
  production: '#6E6259',
  reviewing: '#C97916',
  exported: '#2F8F5B',
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
  sidebarWidth: 184,
  topbarHeight: 58,
  truthBarHeight: 34,
  contentMaxWidth: 1440,
  contentMinHeight: 'calc(100vh - 92px - 48px)',
  pagePadding: 22,
} as const;

export const zIndex = {
  sidebar: 30,
  topbar: 20,
  truthBar: 19,
  overlay: 1000,
} as const;
