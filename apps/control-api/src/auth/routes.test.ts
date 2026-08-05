import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { hashPassword } from './password.js';
import { LoginRateLimiter } from './rateLimiter.js';
import { createAuthRouter } from './routes.js';
import { AuthService } from './service.js';
import { digestSessionToken, SESSION_COOKIE_NAME } from './session.js';
import type { AuthRepository, LoginIdentity, NewSession, StoredSession } from './types.js';

const SECRET = 'integration-test-session-secret-more-than-32-chars';
let passwordHash: string;

class MemoryAuthRepository implements AuthRepository {
  identity: LoginIdentity | null = null;
  sessions = new Map<string, StoredSession & { digest: string; revokedAt?: Date }>();

  async findLoginIdentity(email: string): Promise<LoginIdentity | null> {
    return this.identity?.email === email ? this.identity : null;
  }

  async replaceLoginSessions(session: NewSession): Promise<void> {
    for (const stored of this.sessions.values()) {
      if (stored.userId === session.userId && stored.tenantId === session.tenantId && !stored.revokedAt) {
        stored.revokedAt = new Date();
      }
    }
    this.store(session);
  }

  async findSession(tokenDigest: string): Promise<StoredSession | null> {
    const stored = [...this.sessions.values()].find(
      (candidate) => candidate.digest === tokenDigest && !candidate.revokedAt,
    );
    if (!stored || stored.expiresAt <= new Date()) return null;
    return stored;
  }

  async rotateSession(previousSessionId: string, session: NewSession): Promise<boolean> {
    const previous = this.sessions.get(previousSessionId);
    if (!previous || previous.revokedAt) return false;
    previous.revokedAt = new Date();
    this.store(session);
    return true;
  }

  async revokeSession(sessionId: string, revokedAt: Date): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) session.revokedAt = revokedAt;
  }

  async touchSession(): Promise<void> {}

  private store(session: NewSession): void {
    if (!this.identity) throw new Error('identity required');
    this.sessions.set(session.sessionId, {
      sessionId: session.sessionId,
      userId: session.userId,
      tenantId: session.tenantId,
      email: this.identity.email,
      displayName: this.identity.displayName,
      tenantDisplayName: this.identity.tenantDisplayName,
      roles: this.identity.roles,
      expiresAt: session.expiresAt,
      rotationDueAt: session.rotationDueAt,
      createdAt: new Date(),
      digest: session.tokenDigest,
    });
  }
}

beforeAll(async () => {
  passwordHash = await hashPassword('a-strong-pilot-password');
});

function fixture(
  options: {
    maximumAttempts?: number;
    secureCookies?: boolean;
    rotationSeconds?: number;
    now?: () => Date;
  } = {},
) {
  const repository = new MemoryAuthRepository();
  repository.identity = {
    userId: '00000000-0000-4000-8000-000000000001',
    tenantId: '00000000-0000-4000-8000-000000000002',
    email: 'pilot@example.com',
    displayName: 'Pilot Admin',
    tenantDisplayName: 'Pilot Tenant',
    passwordHash,
    roles: ['tenant_admin'],
  };
  const authRouter = createAuthRouter({
    service: new AuthService(repository, SECRET, 28_800, options.rotationSeconds ?? 1_800, options.now),
    limiter: new LoginRateLimiter(options.maximumAttempts ?? 5, 60_000, 60_000),
    secureCookies: options.secureCookies ?? false,
    sessionTtlSeconds: 28_800,
  });
  return {
    repository,
    app: createApp({
      appVersion: 'test',
      nodeEnv: 'test',
      readinessProbe: async () => undefined,
      authRouter,
    }),
  };
}

describe('auth HTTP integration', () => {
  it('logs in a whitelisted tenant member, resolves the server session, and revokes on logout', async () => {
    const { app, repository } = fixture();
    const agent = request.agent(app);
    const login = await agent.post('/api/v1/auth/login').send({
      email: 'PILOT@example.com',
      password: 'a-strong-pilot-password',
      returnTo: '/projects',
    });

    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({
      session: {
        user: { email: 'pilot@example.com' },
        tenant: { id: '00000000-0000-4000-8000-000000000002' },
        roles: ['tenant_admin'],
      },
      returnTo: '/projects',
    });
    const cookie = login.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    const rawToken = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1] ?? '';
    expect([...repository.sessions.values()][0]?.digest).toBe(digestSessionToken(rawToken, SECRET));
    expect(JSON.stringify([...repository.sessions.values()])).not.toContain(rawToken);

    const current = await agent.get('/api/v1/auth/session');
    expect(current.status).toBe(200);
    expect(current.body.session.tenant.displayName).toBe('Pilot Tenant');

    expect((await agent.post('/api/v1/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/v1/auth/session')).status).toBe(401);
    expect([...repository.sessions.values()].every((session) => session.revokedAt)).toBe(true);
  });

  it('rejects open redirects and does not create a session', async () => {
    const { app, repository } = fixture();
    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'pilot@example.com',
      password: 'a-strong-pilot-password',
      returnTo: '//attacker.example',
    });

    expect(response.status).toBe(400);
    expect(repository.sessions.size).toBe(0);
  });

  it('rate-limits repeated failures without revealing whether the email exists', async () => {
    const { app } = fixture({ maximumAttempts: 2 });
    const payload = { email: 'unknown@example.com', password: 'wrong' };

    expect((await request(app).post('/api/v1/auth/login').send(payload)).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').send(payload)).status).toBe(401);
    const blocked = await request(app).post('/api/v1/auth/login').send(payload);
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeTruthy();
  });

  it('sets Secure on production cookies', async () => {
    const { app } = fixture({ secureCookies: true });
    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'pilot@example.com',
      password: 'a-strong-pilot-password',
    });
    expect(response.headers['set-cookie']?.[0]).toContain('Secure');
  });

  it('rotates an aged session and immediately rejects its previous token', async () => {
    let now = Date.now();
    const { app } = fixture({ rotationSeconds: 1, now: () => new Date(now) });
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'pilot@example.com',
      password: 'a-strong-pilot-password',
    });
    const oldCookie = login.headers['set-cookie']?.[0]?.split(';')[0] ?? '';

    now += 2_000;
    const rotated = await request(app).get('/api/v1/auth/session').set('cookie', oldCookie);
    expect(rotated.status).toBe(200);
    const newCookie = rotated.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
    expect(newCookie).not.toBe(oldCookie);
    expect((await request(app).get('/api/v1/auth/session').set('cookie', oldCookie)).status).toBe(401);
    expect((await request(app).get('/api/v1/auth/session').set('cookie', newCookie)).status).toBe(200);
  });
});
