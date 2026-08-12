import {
  IconBell,
  IconBox,
  IconBuildingStore,
  IconChartBar,
  IconChevronDown,
  IconFileText,
  IconHelpCircle,
  IconHome,
  IconLayoutSidebarLeftCollapse,
  IconLayoutBoard,
  IconLogout,
  IconMovie,
  IconPackage,
  IconRobot,
  IconSend,
  IconSettings,
  IconTarget,
} from '@tabler/icons-react';
import { useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { pilotRuntime } from '../../config/pilotRuntime';
import { DEMO_PROJECT_ID } from '../../domain/constants';
import { authorizeDemoNavigationRoute } from '../../domain/demoRouteAccess';
import { useAuthStore } from '../../stores/authStore';
import { usePilotAuthStore } from '../../stores/pilotAuthStore';
import { usePilotProjectContextStore } from '../../stores/pilotProjectContextStore';

const navItems = [
  { key: 'dashboard', label: '门店总览', icon: IconHome, path: () => '/dashboard' },
  { key: 'profile', label: '门店档案', icon: IconBuildingStore, path: (id: string) => `/projects/${id}/brand` },
  { key: 'offers', label: '商品套餐', icon: IconPackage, path: () => '/enterprise/products' },
  { key: 'assets', label: '门店资产', icon: IconBox, path: (id: string) => `/production/assets/${id}` },
  { key: 'campaign', label: '获客任务', icon: IconTarget, path: () => '/projects/new' },
  { key: 'script', label: 'AI 探店脚本', icon: IconFileText, path: (id: string) => `/projects/${id}/script` },
  { key: 'storyboard', label: '探店分镜', icon: IconLayoutBoard, path: (id: string) => `/projects/${id}/storyboard` },
  { key: 'editing', label: '剪辑成片', icon: IconMovie, path: (id: string) => `/projects/${id}/rough-cut` },
  { key: 'publish', label: '发布投放', icon: IconSend, path: (id: string) => `/projects/${id}/delivery` },
  { key: 'leads', label: '线索转化', icon: IconChartBar, path: (id: string) => `/projects/${id}/usage` },
] as const;

function resolveProjectId(pathname: string, pilotProjectId: string | null) {
  const match = pathname.match(/\/(?:projects|production\/assets)\/([^/]+)/u);
  const matchedProjectId = match?.[1];
  return (matchedProjectId && matchedProjectId !== 'new' ? matchedProjectId : null) ?? pilotProjectId ?? DEMO_PROJECT_ID;
}

export function isStoreExperiencePath(pathname: string) {
  return (
    pathname === '/dashboard' ||
    pathname === '/enterprise/products' ||
    pathname === '/projects/new' ||
    /^\/projects\/[^/]+\/(brand|script|storyboard|rough-cut|usage|delivery)$/u.test(pathname) ||
    /^\/production\/assets\/[^/]+$/u.test(pathname)
  );
}

export function StoreShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const pilotProjectId = usePilotProjectContextStore((state) => state.activeProjectId);
  const demoIdentity = useAuthStore((state) => state.identity);
  const demoLogout = useAuthStore((state) => state.logout);
  const pilotSession = usePilotAuthStore((state) => state.session);
  const pilotLogout = usePilotAuthStore((state) => state.logout);
  const projectId = resolveProjectId(location.pathname, pilotProjectId);
  const nav = useMemo(
    () => navItems
      .map((item) => ({ ...item, href: item.path(projectId) }))
      .filter((item) => {
        if (pilotRuntime.mode === 'pilot') {
          const roles = pilotSession?.activeContext.roles ?? [];
          if (roles.includes('tenant_admin')) return true;
          return !['dashboard', 'offers', 'campaign'].includes(item.key);
        }
        return authorizeDemoNavigationRoute(demoIdentity, item.href).status === 'allowed';
      }),
    [demoIdentity, pilotSession, projectId],
  );
  const displayName =
    pilotRuntime.mode === 'pilot'
      ? pilotSession?.user.displayName ?? '门店运营'
      : demoIdentity?.displayName ?? '门店运营';

  const logout = () => {
    if (pilotRuntime.mode === 'pilot') {
      void pilotLogout().finally(() => navigate('/login', { replace: true }));
      return;
    }
    demoLogout();
    navigate('/login', { replace: true });
  };

  return (
    <div
      className="store-shell"
      {...(pilotRuntime.mode === 'pilot' ? { 'data-testid': 'pilot-app-shell' } : {})}
    >
      <header className="store-topbar">
        <div className="store-wordmark" aria-label="源核 AI 助手">
          <span className="store-ai-mark"><IconRobot size={18} /></span>
          <span>源核 AI 助手</span>
          <i />
          <strong>门店获客工作台</strong>
        </div>
        <div className="store-topbar-actions">
          <button type="button" aria-label="帮助"><IconHelpCircle size={18} /></button>
          <button type="button" aria-label="通知"><IconBell size={18} /></button>
          <button type="button" aria-label="设置"><IconSettings size={18} /></button>
          <span className="store-user-avatar">{displayName.slice(0, 1)}</span>
        </div>
      </header>

      <aside className="store-sidebar">
        <nav aria-label="门店获客流程">
          {nav.map(({ key, label, icon: Icon, href }) => (
            <NavLink key={key} to={href} className={({ isActive }) => isActive ? 'is-active' : ''}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="store-sidebar-footer">
          <button type="button" onClick={logout}><IconLogout size={17} />退出登录</button>
          <IconLayoutSidebarLeftCollapse size={18} aria-hidden="true" />
        </div>
      </aside>

      <main className="store-main">
        <div className="store-contextbar">
          <div>
            <span className="store-context-dot" />
            <strong>拾光咖啡 · 国贸店</strong>
            <IconChevronDown size={15} />
          </div>
          <span className="store-placeholder-state">演示数据 · 未接通真实投放与线索 Provider</span>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
