import {
  DEMO_IDENTITY_CONTRACT_VERSION,
  type DemoAuthSession,
  type DemoIdentity,
  type DemoLoginCredentials,
  findDemoIdentityByAccountId,
  findDemoIdentityByLoginName,
} from '../domain/demoIdentity';

export const DEMO_AUTH_STORAGE_KEY = 'videoagent:demo-auth:session:v1';
export const DEMO_AUTH_PASSWORD = 'Demo@123456';
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

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createSession(identity: DemoIdentity): DemoAuthSession {
  return {
    contractVersion: DEMO_IDENTITY_CONTRACT_VERSION,
    accountId: identity.accountId,
    createdAt: new Date().toISOString(),
  };
}

function isDemoAuthSession(value: unknown): value is DemoAuthSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DemoAuthSession>;
  return (
    candidate.contractVersion === DEMO_IDENTITY_CONTRACT_VERSION &&
    typeof candidate.accountId === 'string' &&
    typeof candidate.createdAt === 'string' &&
    !Number.isNaN(Date.parse(candidate.createdAt))
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
    if (!isDemoAuthSession(session)) {
      throw new DemoAuthError('SESSION_INVALID', 'Demo 会话格式无效。');
    }
    const identity = findDemoIdentityByAccountId(session.accountId);
    if (!identity) {
      throw new DemoAuthError('SESSION_INVALID', 'Demo 会话账号不存在。');
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

export const demoAuth = {
  login: loginWithDemoAccount,
  logout: logoutDemoAccount,
  hydrate: hydrateDemoSession,
} as const;
