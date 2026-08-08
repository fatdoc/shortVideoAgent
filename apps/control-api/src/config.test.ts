import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  const projectGrantConfig = {
    PROJECT_GRANT_SIGNING_SECRET: 'independent-project-grant-signing-secret-for-tests',
    PROJECT_GRANT_ACTIVE_KID: 'pilot-test-kid-1',
    PRODUCTION_PLANE_INTERNAL_TOKEN: 'independent-production-plane-internal-token-for-tests',
  };

  it('provides safe local pilot defaults', () => {
    const config = loadConfig({ NODE_ENV: 'test', ...projectGrantConfig });

    expect(config.port).toBe(10_600);
    expect(config.databaseUrl).toContain('127.0.0.1:54329');
    expect(config.sessionSecret.length).toBeGreaterThanOrEqual(32);
    expect(config.projectGrantSigningSecret).toBe(projectGrantConfig.PROJECT_GRANT_SIGNING_SECRET);
    expect(config.projectGrantActiveKid).toBe('pilot-test-kid-1');
    expect(config.productionPlaneInternalToken).toBe(
      projectGrantConfig.PRODUCTION_PLANE_INTERNAL_TOKEN,
    );
    expect(config.invitationPreviewMaxAttempts).toBe(20);
    expect(config.invitationPreviewWindowSeconds).toBe(60);
    expect(config.invitationPreviewBlockSeconds).toBe(300);
    expect(config.registrationIdempotencySecret.length).toBeGreaterThanOrEqual(32);
    expect(config.rechargePaymentDigestSecret.length).toBeGreaterThanOrEqual(32);
    expect(config.testPaymentInternalToken.length).toBeGreaterThanOrEqual(32);
    expect(config.rechargePaymentDigestSecret).not.toBe(config.testPaymentInternalToken);
    expect(config.registrationMaxAttempts).toBe(5);
    expect(config.registrationWindowSeconds).toBe(900);
    expect(config.registrationBlockSeconds).toBe(900);
  });

  it('loads explicit Registration security and rate-limit policy', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      ...projectGrantConfig,
      REGISTRATION_IDEMPOTENCY_SECRET: 'independent-registration-secret-for-tests',
      REGISTRATION_MAX_ATTEMPTS: '8',
      REGISTRATION_WINDOW_SECONDS: '600',
      REGISTRATION_BLOCK_SECONDS: '1200',
    });

    expect(config.registrationIdempotencySecret).toBe('independent-registration-secret-for-tests');
    expect(config.registrationMaxAttempts).toBe(8);
    expect(config.registrationWindowSeconds).toBe(600);
    expect(config.registrationBlockSeconds).toBe(1200);
  });

  it('requires an explicit independent Registration secret in production', () => {
    const production = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://pilot:secure@db.internal/videoagent',
      SESSION_SECRET: 'a-production-session-secret-with-more-than-32-characters',
      ...projectGrantConfig,
      RECHARGE_PAYMENT_DIGEST_SECRET: 'independent-payment-digest-secret-for-tests',
      TEST_PAYMENT_INTERNAL_TOKEN: 'independent-test-payment-internal-token-for-tests',
    };
    expect(() => loadConfig(production)).toThrow('REGISTRATION_IDEMPOTENCY_SECRET');
    expect(() =>
      loadConfig({
        ...production,
        REGISTRATION_IDEMPOTENCY_SECRET: production.SESSION_SECRET,
      }),
    ).toThrow('must be independent');
  });

  it('requires explicit independent Payment secrets in production', () => {
    const production = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://pilot:secure@db.internal/videoagent',
      SESSION_SECRET: 'a-production-session-secret-with-more-than-32-characters',
      ...projectGrantConfig,
      REGISTRATION_IDEMPOTENCY_SECRET: 'independent-registration-secret-for-tests',
    };
    expect(() => loadConfig(production)).toThrow('RECHARGE_PAYMENT_DIGEST_SECRET');
    expect(() =>
      loadConfig({
        ...production,
        RECHARGE_PAYMENT_DIGEST_SECRET: 'independent-payment-digest-secret-for-tests',
      }),
    ).toThrow('TEST_PAYMENT_INTERNAL_TOKEN');

    const configured = loadConfig({
      ...production,
      RECHARGE_PAYMENT_DIGEST_SECRET: 'independent-payment-digest-secret-for-tests',
      TEST_PAYMENT_INTERNAL_TOKEN: 'independent-test-payment-internal-token-for-tests',
    });
    expect(configured.rechargePaymentDigestSecret).toBe(
      'independent-payment-digest-secret-for-tests',
    );
    expect(configured.testPaymentInternalToken).toBe(
      'independent-test-payment-internal-token-for-tests',
    );
  });

  it('rejects Payment secret reuse across security boundaries', () => {
    const sharedSecret = 'shared-payment-secret-that-must-not-cross-boundaries';
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        ...projectGrantConfig,
        RECHARGE_PAYMENT_DIGEST_SECRET: projectGrantConfig.PRODUCTION_PLANE_INTERNAL_TOKEN,
      }),
    ).toThrow('RECHARGE_PAYMENT_DIGEST_SECRET must be independent');
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        ...projectGrantConfig,
        RECHARGE_PAYMENT_DIGEST_SECRET: sharedSecret,
        TEST_PAYMENT_INTERNAL_TOKEN: sharedSecret,
      }),
    ).toThrow('RECHARGE_PAYMENT_DIGEST_SECRET must be independent');
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        ...projectGrantConfig,
        TEST_PAYMENT_INTERNAL_TOKEN: projectGrantConfig.PROJECT_GRANT_SIGNING_SECRET,
      }),
    ).toThrow('TEST_PAYMENT_INTERNAL_TOKEN must be independent');
  });

  it('loads explicit Invitation Preview rate-limit policy', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      ...projectGrantConfig,
      INVITATION_PREVIEW_MAX_ATTEMPTS: '7',
      INVITATION_PREVIEW_WINDOW_SECONDS: '120',
      INVITATION_PREVIEW_BLOCK_SECONDS: '600',
    });

    expect(config.invitationPreviewMaxAttempts).toBe(7);
    expect(config.invitationPreviewWindowSeconds).toBe(120);
    expect(config.invitationPreviewBlockSeconds).toBe(600);
  });

  it('fails closed when the production-plane internal token is missing or too short', () => {
    const withoutInternalToken = {
      PROJECT_GRANT_SIGNING_SECRET: projectGrantConfig.PROJECT_GRANT_SIGNING_SECRET,
      PROJECT_GRANT_ACTIVE_KID: projectGrantConfig.PROJECT_GRANT_ACTIVE_KID,
    };
    expect(() => loadConfig({ NODE_ENV: 'test', ...withoutInternalToken })).toThrow(
      'PRODUCTION_PLANE_INTERNAL_TOKEN',
    );
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        ...withoutInternalToken,
        PRODUCTION_PLANE_INTERNAL_TOKEN: 'too-short',
      }),
    ).toThrow('at least 32 bytes');
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
        PRODUCTION_PLANE_INTERNAL_TOKEN: projectGrantConfig.PRODUCTION_PLANE_INTERNAL_TOKEN,
      }),
    ).toThrow('must be independent');
  });

  it('rejects reuse of Session or Grant secrets as the production-plane internal token', () => {
    const sessionSecret = 'session-secret-that-must-remain-in-control-plane-only';
    for (const internalToken of [sessionSecret, projectGrantConfig.PROJECT_GRANT_SIGNING_SECRET]) {
      expect(() =>
        loadConfig({
          NODE_ENV: 'test',
          ...projectGrantConfig,
          SESSION_SECRET: sessionSecret,
          PRODUCTION_PLANE_INTERNAL_TOKEN: internalToken,
        }),
      ).toThrow('must be independent');
    }
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
