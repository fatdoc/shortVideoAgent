import { describe, expect, it, vi } from 'vitest';
import {
  EmailVerificationFailedError,
  EmailVerificationUnavailableError,
  RegistrationTermsNotAcceptedError,
  RegistrationValidationError,
} from './errors.js';
import { RegistrationService } from './service.js';
import type {
  EmailVerificationPort,
  RegistrationRecordInput,
  RegistrationResult,
  RegistrationStore,
} from './types.js';

const idempotencySecret = 'registration-idempotency-secret-at-least-32-bytes';
const now = new Date('2026-08-08T04:00:00.000Z');
const storedResult: RegistrationResult = {
  registrationId: 'a1000000-0000-4000-8000-000000000001',
  userId: 'a2000000-0000-4000-8000-000000000001',
  tenantId: 'a3000000-0000-4000-8000-000000000001',
  membershipId: 'a4000000-0000-4000-8000-000000000001',
  registrationPath: 'DIRECT',
  completedAt: now.toISOString(),
};

function input(overrides: Record<string, unknown> = {}) {
  return {
    email: ' New.User@Example.com ',
    password: 'correct horse battery staple',
    displayName: ' New User ',
    tenantDisplayName: ' Personal Studio ',
    invitationToken: undefined,
    termsVersionId: 'a5000000-0000-4000-8000-000000000001',
    locale: 'zh-CN',
    accepted: true,
    emailVerificationToken: 'verification-secret-token',
    idempotencyKey: 'registration-command-1',
    ...overrides,
  };
}

function harness(options: { verifier?: EmailVerificationPort; result?: RegistrationResult } = {}) {
  const records: RegistrationRecordInput[] = [];
  const store: RegistrationStore = {
    register: vi.fn(async (record) => {
      records.push(record);
      return { value: options.result ?? storedResult, replayed: false };
    }),
  };
  const verifier =
    options.verifier ??
    ({
      verify: vi.fn(async () => ({ evidenceId: 'verification-evidence-1' })),
    } satisfies EmailVerificationPort);
  const service = new RegistrationService(store, verifier, idempotencySecret, () => now);
  return { records, service, store, verifier };
}

describe('RegistrationService', () => {
  it('normalizes public input, verifies email and sends only hashed secrets to the Store', async () => {
    const { records, service, verifier } = harness();

    await expect(service.register(input())).resolves.toEqual({
      value: storedResult,
      replayed: false,
    });
    expect(verifier.verify).toHaveBeenCalledWith(
      'new.user@example.com',
      'verification-secret-token',
      now,
    );
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      normalizedEmail: 'new.user@example.com',
      displayName: 'New User',
      tenantDisplayName: 'Personal Studio',
      invitationTokenDigest: null,
      termsVersionId: 'a5000000-0000-4000-8000-000000000001',
      locale: 'zh-CN',
      idempotencyKey: 'registration-command-1',
      verificationEvidenceId: 'verification-evidence-1',
      completedAt: now,
    });
    expect(records[0]?.passwordHash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(records[0]?.requestDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(records[0])).not.toContain('correct horse battery staple');
    expect(JSON.stringify(records[0])).not.toContain('verification-secret-token');
  });

  it('creates stable keyed digests and changes them when protected request facts differ', async () => {
    const first = harness();
    const second = harness();
    const changed = harness();

    await first.service.register(input());
    await second.service.register(input());
    await changed.service.register(input({ password: 'different strong password' }));

    expect(first.records[0]?.requestDigest).toBe(second.records[0]?.requestDigest);
    expect(first.records[0]?.requestDigest).not.toBe(changed.records[0]?.requestDigest);
  });

  it('requires explicit acceptance, a strong password and a Tenant name for direct registration', async () => {
    const { service, store } = harness();

    await expect(service.register(input({ accepted: false }))).rejects.toBeInstanceOf(
      RegistrationTermsNotAcceptedError,
    );
    await expect(service.register(input({ password: 'too-short' }))).rejects.toBeInstanceOf(
      RegistrationValidationError,
    );
    await expect(service.register(input({ tenantDisplayName: undefined }))).rejects.toBeInstanceOf(
      RegistrationValidationError,
    );
    expect(store.register).not.toHaveBeenCalled();
  });

  it('fails closed when verification is unavailable or rejects the credential', async () => {
    const unavailable = harness({
      verifier: {
        verify: vi.fn(async () => {
          throw new EmailVerificationUnavailableError();
        }),
      },
    });
    const failed = harness({
      verifier: {
        verify: vi.fn(async () => {
          throw new EmailVerificationFailedError();
        }),
      },
    });

    await expect(unavailable.service.register(input())).rejects.toBeInstanceOf(
      EmailVerificationUnavailableError,
    );
    await expect(failed.service.register(input())).rejects.toBeInstanceOf(
      EmailVerificationFailedError,
    );
    expect(unavailable.store.register).not.toHaveBeenCalled();
    expect(failed.store.register).not.toHaveBeenCalled();
  });

  it('does not accept a short idempotency secret', () => {
    const store: RegistrationStore = { register: vi.fn() };
    const verifier: EmailVerificationPort = { verify: vi.fn() };
    expect(() => new RegistrationService(store, verifier, 'short-secret')).toThrow(
      /idempotency|32 bytes|secret/i,
    );
  });
});
