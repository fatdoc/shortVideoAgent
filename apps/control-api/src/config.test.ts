import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  const projectGrantConfig = {
    PROJECT_GRANT_SIGNING_SECRET: 'independent-project-grant-signing-secret-for-tests',
    PROJECT_GRANT_ACTIVE_KID: 'pilot-test-kid-1',
  };

  it('provides safe local pilot defaults', () => {
    const config = loadConfig({ NODE_ENV: 'test', ...projectGrantConfig });

    expect(config.port).toBe(10_600);
    expect(config.databaseUrl).toContain('127.0.0.1:54329');
    expect(config.sessionSecret.length).toBeGreaterThanOrEqual(32);
    expect(config.projectGrantSigningSecret).toBe(
      projectGrantConfig.PROJECT_GRANT_SIGNING_SECRET,
    );
    expect(config.projectGrantActiveKid).toBe('pilot-test-kid-1');
  });

  it('fails closed when the independent project Grant signing configuration is missing', () => {
    expect(() => loadConfig({ NODE_ENV: 'test' })).toThrow('PROJECT_GRANT_SIGNING_SECRET');
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        PROJECT_GRANT_SIGNING_SECRET: projectGrantConfig.PROJECT_GRANT_SIGNING_SECRET,
      }),
    ).toThrow('PROJECT_GRANT_ACTIVE_KID');
  });

  it('rejects reuse of the Session root secret for project Grant signing', () => {
    const sharedSecret = 'shared-secret-that-must-not-cross-security-boundaries';
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        SESSION_SECRET: sharedSecret,
        PROJECT_GRANT_SIGNING_SECRET: sharedSecret,
        PROJECT_GRANT_ACTIVE_KID: 'pilot-test-kid-1',
      }),
    ).toThrow('must be independent');
  });

  it('requires an explicit production session secret', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://pilot:secure@db.internal/videoagent',
        ...projectGrantConfig,
      }),
    ).toThrow('SESSION_SECRET');
  });

  it('rejects the local database credential in production', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        SESSION_SECRET: 'a-production-secret-with-more-than-32-characters',
        ...projectGrantConfig,
      }),
    ).toThrow('DATABASE_URL');
  });

  it('requires rotation to happen before absolute expiry', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        SESSION_TTL_SECONDS: '300',
        SESSION_ROTATION_SECONDS: '300',
        ...projectGrantConfig,
      }),
    ).toThrow('SESSION_ROTATION_SECONDS');
  });
});
