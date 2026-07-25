export const DEMO_PROJECT_ID = 'demo-local-001';
export const STORAGE_KEY = 'videoagent:mvp:v1';

export const ROUTES = {
  dashboard: '/dashboard',
  projectNew: '/projects/new',
  brand: (projectId: string) => `/projects/${projectId}/brand`,
  script: (projectId: string) => `/projects/${projectId}/script`,
  storyboard: (projectId: string) => `/projects/${projectId}/storyboard`,
  roughCut: (projectId: string) => `/projects/${projectId}/rough-cut`,
} as const;
