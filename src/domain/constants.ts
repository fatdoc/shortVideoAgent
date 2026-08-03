export const DEMO_TENANT_ID = 'tenant-demo-hdl';
export const DEMO_PROJECT_ID = 'demo-local-001';
export const STORAGE_KEY = 'videoagent:mvp:v1';

export const ROUTES = {
  dashboard: '/dashboard',
  platformOverview: '/platform/overview',
  platformCatalog: '/platform/catalog',
  platformOrganizations: '/platform/organizations',
  platformReceipts: '/platform/production-receipts',
  channelOverview: '/channel/overview',
  channelProducts: '/channel/products',
  channelCustomers: '/channel/customers',
  enterpriseProducts: '/enterprise/products',
  productionOverview: '/production/overview',
  projectNew: '/projects/new',
  brand: (projectId: string) => `/projects/${projectId}/brand`,
  script: (projectId: string) => `/projects/${projectId}/script`,
  storyboard: (projectId: string) => `/projects/${projectId}/storyboard`,
  roughCut: (projectId: string) => `/projects/${projectId}/rough-cut`,
  usage: (projectId: string) => `/projects/${projectId}/usage`,
  delivery: (projectId: string) => `/projects/${projectId}/delivery`,
  productionInbox: (projectId: string) => `/production/inbox/${projectId}`,
  productionCanvas: (projectId: string) => `/production/canvas/${projectId}`,
  productionTasks: (projectId: string) => `/production/tasks/${projectId}`,
  productionAssets: (projectId: string) => `/production/assets/${projectId}`,
  productionExport: (projectId: string) => `/production/export/${projectId}`,
} as const;

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  briefing: 'Brief 中',
  scripting: '脚本中',
  storyboarding: '分镜中',
  production: '制作中',
  reviewing: '审核中',
  exported: '已导出',
};

export const MATCH_STATUS_LABEL: Record<string, string> = {
  matched: '已匹配',
  reshoot: '待补拍',
  missing: '缺镜',
  ai_placeholder: 'AI 补镜',
};

export const RISK_LEVEL_LABEL: Record<string, string> = {
  none: '无风险',
  low: '低',
  medium: '中',
  high: '高',
};

export const NAV_ITEMS = [
  { key: 'dashboard', path: ROUTES.dashboard, label: '工作台' },
  { key: 'brief', path: ROUTES.projectNew, label: '新建 / Brief' },
  { key: 'brand', path: 'brand', label: '品牌大脑' },
  { key: 'script', path: 'script', label: '脚本编辑' },
  { key: 'storyboard', path: 'storyboard', label: '分镜清单' },
  { key: 'rough-cut', path: 'rough-cut', label: '素材 / 初剪' },
] as const;
