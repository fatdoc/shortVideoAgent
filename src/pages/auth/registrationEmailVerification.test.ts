import { describe, expect, it, vi } from 'vitest';
import { PublicRegistrationApiError } from '../../services/publicRegistrationApi';
import { createRegistrationEmailVerification } from './registrationEmailVerification';

describe('registration email verification bootstrap', () => {
  it.each(['development', 'production'])(
    'keeps %s unavailable even when a browser bridge is present',
    async (mode) => {
      const bridge = vi.fn().mockResolvedValue('temporary-verification-token');
      const provider = createRegistrationEmailVerification(
        { MODE: mode, VITE_PILOT_E2E: 'true' },
        bridge,
      );

      await expect(provider.createEvidence('user@example.test')).rejects.toMatchObject({
        code: 'EMAIL_VERIFICATION_UNAVAILABLE',
      });
      expect(bridge).not.toHaveBeenCalled();
    },
  );

  it('keeps test mode unavailable without both the explicit flag and in-memory bridge', async () => {
    for (const [environment, bridge] of [
      [{ MODE: 'test' }, vi.fn()],
      [{ MODE: 'test', VITE_PILOT_E2E: 'false' }, vi.fn()],
      [{ MODE: 'test', VITE_PILOT_E2E: 'true' }, undefined],
    ] as const) {
      const provider = createRegistrationEmailVerification(environment, bridge);
      await expect(provider.createEvidence('user@example.test')).rejects.toBeInstanceOf(
        PublicRegistrationApiError,
      );
    }
  });

  it('uses only the test bridge result and rejects an invalid result without persistence', async () => {
    const bridge = vi
      .fn()
      .mockResolvedValueOnce('temporary-verification-token')
      .mockResolvedValue('');
    const provider = createRegistrationEmailVerification(
      { MODE: 'test', VITE_PILOT_E2E: 'true' },
      bridge,
    );

    await expect(provider.createEvidence(' USER@EXAMPLE.TEST ')).resolves.toBe(
      'temporary-verification-token',
    );
    expect(bridge).toHaveBeenCalledWith('user@example.test');
    await expect(provider.createEvidence('user@example.test')).rejects.toMatchObject({
      code: 'EMAIL_VERIFICATION_UNAVAILABLE',
    });
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
