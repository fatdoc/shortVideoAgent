import { describe, expect, it } from 'vitest';
import { EmailVerificationFailedError, EmailVerificationUnavailableError } from './errors.js';
import { createEmailVerification } from './emailVerification.js';

const token = 'pilot-e2e-verification-token-with-at-least-32-bytes';

describe('email verification bootstrap', () => {
  it.each(['development', 'production'] as const)(
    'keeps %s unavailable even when Pilot E2E variables are present',
    async (nodeEnv) => {
      const verifier = createEmailVerification({
        NODE_ENV: nodeEnv,
        PILOT_E2E: 'true',
        PILOT_E2E_EMAIL_VERIFICATION_TOKEN: token,
      });

      await expect(verifier.verify('user@example.test', token, new Date())).rejects.toBeInstanceOf(
        EmailVerificationUnavailableError,
      );
    },
  );

  it('keeps test mode unavailable unless every explicit Pilot E2E guard is present', async () => {
    for (const environment of [
      { NODE_ENV: 'test' },
      { NODE_ENV: 'test', PILOT_E2E: 'false', PILOT_E2E_EMAIL_VERIFICATION_TOKEN: token },
      { NODE_ENV: 'test', PILOT_E2E: 'true' },
      {
        NODE_ENV: 'test',
        PILOT_E2E: 'true',
        PILOT_E2E_EMAIL_VERIFICATION_TOKEN: 'too-short',
      },
    ]) {
      const verifier = createEmailVerification(environment);
      await expect(verifier.verify('user@example.test', token, new Date())).rejects.toBeInstanceOf(
        EmailVerificationUnavailableError,
      );
    }
  });

  it('accepts only the exact in-memory Pilot E2E token and returns opaque evidence', async () => {
    const verifier = createEmailVerification({
      NODE_ENV: 'test',
      PILOT_E2E: 'true',
      PILOT_E2E_EMAIL_VERIFICATION_TOKEN: token,
    });

    const evidence = await verifier.verify('user@example.test', token, new Date());
    expect(evidence.evidenceId).toMatch(/^pilot-e2e:[0-9a-f]{64}$/);
    expect(evidence.evidenceId).not.toContain(token);
    expect(evidence.evidenceId).not.toContain('user@example.test');

    await expect(
      verifier.verify('user@example.test', `${token}-wrong`, new Date()),
    ).rejects.toBeInstanceOf(EmailVerificationFailedError);
  });
});
