import { DEMO_PROJECT_ID, ROUTES } from '../domain/constants';
import {
  DEMO_SESSION_VERSION,
  type DemoAccountKind,
  type DemoIdentity,
  type DemoLoginCredentials,
  type DemoRole,
  type DemoSession,
  type DemoSessionOrganizationType,
  type DemoSessionWorkbench,
  type DemoWorkbench,
  findDemoIdentityByAccountId,
  findDemoIdentityByLoginName,
} from '../domain/demoIdentity';

export const DEMO_AUTH_STORAGE_KEY = 'videoagent:demo-auth:session:v1';
export const DEMO_AUTH_PASSWORD = 'Demo@123456';
export const DEMO_SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
export const DEMO_AUTH_NOTICE =
  '仅供前端 Demo 演示：固定账号密码与 localStorage 会话不具备生产安全能力。';

export type DemoAuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'SESSION_UNAVAILABLE'
  | 'SESSION_INVALID';

export class DemoAuthError extends Error {
  readonly code: DemoAuthErrorCode;

  constructor(code: DemoAuthErrorCode, message: string) {
    super(message);
    this.name = 'DemoAuthError';
    this.code = code;
  }
}

const ROLE_BY_ACCOUNT_KIND: Record<DemoAccountKind, DemoRole> = {
  platform: 'platform_admin',
  channel: 'channel_agent',
  tenant: 'enterprise_admin',
  production: 'content_operator',
};

const SESSION_WORKBENCH_BY_ACCOUNT_KIND: Record<
  DemoAccountKind,
  DemoSessionWorkbench
> = {
  platform: 'platform',
  channel: 'channel',
  tenant: 'enterprise',
  production: 'production',
};

const SESSION_ORGANIZATION_TYPE = {
  PLATFORM: 'platform',
  CHANNEL: 'channel',
  TENANT: 'enterprise',
} as const satisfies Record<string, DemoSessionOrganizationType>;

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createSessionId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createSession(identity: DemoIdentity): DemoSession {
  const issuedAt = new Date();
  return {
    version: DEMO_SESSION_VERSION,
    sessionId: createSessionId(),
    identityId: identity.accountId,
    role: ROLE_BY_ACCOUNT_KIND[identity.accountKind],
    organizationId: identity.activeOrganization.organizationId,
    organizationType:
      SESSION_ORGANIZATION_TYPE[identity.activeOrganization.organizationType],
    defaultWorkbench: SESSION_WORKBENCH_BY_ACCOUNT_KIND[identity.accountKind],
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(
      issuedAt.getTime() + DEMO_SESSION_DURATION_MS,
    ).toISOString(),
  };
}

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isDemoSession(value: unknown): value is DemoSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DemoSession>;
  return (
    candidate.version === DEMO_SESSION_VERSION &&
    typeof candidate.sessionId === 'string' &&
    candidate.sessionId.length > 0 &&
    typeof candidate.identityId === 'string' &&
    candidate.identityId.length > 0 &&
    (candidate.role === 'platform_admin' ||
      candidate.role === 'channel_agent' ||
      candidate.role === 'enterprise_admin' ||
      candidate.role === 'content_operator') &&
    typeof candidate.organizationId === 'string' &&
    candidate.organizationId.length > 0 &&
    (candidate.organizationType === 'platform' ||
      candidate.organizationType === 'channel' ||
      candidate.organizationType === 'enterprise') &&
    (candidate.defaultWorkbench === 'platform' ||
      candidate.defaultWorkbench === 'channel' ||
      candidate.defaultWorkbench === 'enterprise' ||
      candidate.defaultWorkbench === 'production') &&
    isValidDate(candidate.issuedAt) &&
    isValidDate(candidate.expiresAt) &&
    Date.parse(candidate.expiresAt) > Date.parse(candidate.issuedAt)
  );
}

function sessionMatchesIdentity(
  session: DemoSession,
  identity: DemoIdentity,
): boolean {
  return (
    session.identityId === identity.accountId &&
    session.role === ROLE_BY_ACCOUNT_KIND[identity.accountKind] &&
    session.organizationId === identity.activeOrganization.organizationId &&
    session.organizationType ===
      SESSION_ORGANIZATION_TYPE[identity.activeOrganization.organizationType] &&
    session.defaultWorkbench ===
      SESSION_WORKBENCH_BY_ACCOUNT_KIND[identity.accountKind]
  );
}

function removePersistedSession(storage: Storage | null): void {
  if (!storage) return;
  try {
    storage.removeItem(DEMO_AUTH_STORAGE_KEY);
  } catch {
    // Demo logout remains successful even when browser storage is unavailable.
  }
}

export function loginWithDemoAccount(
  credentials: DemoLoginCredentials,
): DemoIdentity {
  const identity = findDemoIdentityByLoginName(credentials.loginName);
  if (!identity || credentials.password !== DEMO_AUTH_PASSWORD) {
    throw new DemoAuthError(
      'INVALID_CREDENTIALS',
      'Demo 账号或统一演示密码不正确。',
    );
  }

  const storage = getLocalStorage();
  if (!storage) {
    throw new DemoAuthError(
      'SESSION_UNAVAILABLE',
      '浏览器 localStorage 不可用，无法建立 Demo 会话。',
    );
  }

  // A successful credential check always starts a fresh identity session.
  // If the following write fails, the previous identity must not survive.
  removePersistedSession(storage);
  try {
    storage.setItem(
      DEMO_AUTH_STORAGE_KEY,
      JSON.stringify(createSession(identity)),
    );
  } catch {
    throw new DemoAuthError(
      'SESSION_UNAVAILABLE',
      '写入 Demo 会话失败，请检查浏览器存储设置。',
    );
  }

  return identity;
}

export function hydrateDemoSession(): DemoIdentity | null {
  const storage = getLocalStorage();
  if (!storage) return null;

  let rawSession: string | null;
  try {
    rawSession = storage.getItem(DEMO_AUTH_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!rawSession) return null;

  try {
    const session: unknown = JSON.parse(rawSession);
    if (!isDemoSession(session)) {
      throw new DemoAuthError('SESSION_INVALID', 'Demo 会话格式无效。');
    }
    if (Date.parse(session.expiresAt) <= Date.now()) {
      throw new DemoAuthError('SESSION_INVALID', 'Demo 会话已过期。');
    }
    const identity = findDemoIdentityByAccountId(session.identityId);
    if (!identity || !sessionMatchesIdentity(session, identity)) {
      throw new DemoAuthError('SESSION_INVALID', 'Demo 会话身份不存在或不匹配。');
    }
    return identity;
  } catch {
    removePersistedSession(storage);
    return null;
  }
}

export function logoutDemoAccount(): void {
  removePersistedSession(getLocalStorage());
}

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function workbenchForReturnPath(pathname: string): DemoWorkbench | null {
  const platformPaths = new Set<string>([
    ROUTES.platformOverview,
    ROUTES.platformOrganizations,
    ROUTES.platformCatalog,
    ROUTES.platformReceipts,
  ]);
  if (platformPaths.has(pathname)) {
    return 'platform';
  }
  const channelPaths = new Set<string>([
    ROUTES.channelOverview,
    ROUTES.channelProducts,
    ROUTES.channelCustomers,
  ]);
  if (channelPaths.has(pathname)) {
    return 'channel';
  }
  const tenantPaths = new Set([
    ROUTES.dashboard,
    ROUTES.enterpriseProducts,
    ROUTES.projectNew,
    `/projects/${DEMO_PROJECT_ID}`,
    ROUTES.brand(DEMO_PROJECT_ID),
    ROUTES.script(DEMO_PROJECT_ID),
    ROUTES.storyboard(DEMO_PROJECT_ID),
    ROUTES.roughCut(DEMO_PROJECT_ID),
    ROUTES.usage(DEMO_PROJECT_ID),
    ROUTES.delivery(DEMO_PROJECT_ID),
  ]);
  if (tenantPaths.has(pathname)) {
    return 'tenant';
  }
  const productionPaths = new Set([
    ROUTES.productionOverview,
    ROUTES.productionInbox(DEMO_PROJECT_ID),
    ROUTES.productionCanvas(DEMO_PROJECT_ID),
    ROUTES.productionTasks(DEMO_PROJECT_ID),
    ROUTES.productionAssets(DEMO_PROJECT_ID),
    ROUTES.productionExport(DEMO_PROJECT_ID),
  ]);
  if (productionPaths.has(pathname)) {
    return 'production';
  }
  return null;
}

export function resolveDemoReturnPath(
  candidate: unknown,
  identity: DemoIdentity,
): string {
  if (
    typeof candidate !== 'string' ||
    candidate.length === 0 ||
    candidate !== candidate.trim() ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    containsControlCharacter(candidate)
  ) {
    return identity.defaultRoute;
  }

  try {
    const url = new URL(candidate, 'https://demo.videoagent.local');
    if (url.origin !== 'https://demo.videoagent.local') {
      return identity.defaultRoute;
    }
    const workbench = workbenchForReturnPath(url.pathname);
    if (!workbench || !identity.allowedWorkbenches.includes(workbench)) {
      return identity.defaultRoute;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return identity.defaultRoute;
  }
}

export const demoAuth = {
  login: loginWithDemoAccount,
  logout: logoutDemoAccount,
  hydrate: hydrateDemoSession,
  resolveReturnPath: resolveDemoReturnPath,
} as const;
