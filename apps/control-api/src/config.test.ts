import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('provides safe local pilot defaults', () => {
    const config = loadConfig({ NODE_ENV: 'test' });

    expect(config.port).toBe(10_600);
    expect(config.databaseUrl).toContain('127.0.0.1:54329');
    expect(config.sessionSecret.length).toBeGreaterThanOrEqual(32);
  });

  it('requires an explicit production session secret', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://pilot:secure@db.internal/videoagent',
      }),
    ).toThrow('SESSION_SECRET');
  });

  it('rejects the local database credential in production', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        SESSION_SECRET: 'a-production-secret-with-more-than-32-characters',
      }),
    ).toThrow('DATABASE_URL');
  });

  it('requires rotation to happen before absolute expiry', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        SESSION_TTL_SECONDS: '300',
        SESSION_ROTATION_SECONDS: '300',
      }),
    ).toThrow('SESSION_ROTATION_SECONDS');
  });
});
