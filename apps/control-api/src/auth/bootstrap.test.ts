import { describe, expect, it } from 'vitest';
import { parseBootstrapInput } from './bootstrap.js';

describe('whitelist bootstrap input', () => {
  it('has no default tenant, account, or password', () => {
    expect(() => parseBootstrapInput({})).toThrow();
  });

  it('requires a strong explicit password and normalizes no secrets into output', () => {
    const input = parseBootstrapInput({
      PILOT_TENANT_ID: '00000000-0000-4000-8000-000000000001',
      PILOT_TENANT_NAME: 'Pilot Tenant',
      PILOT_ADMIN_EMAIL: 'pilot@example.com',
      PILOT_ADMIN_DISPLAY_NAME: 'Pilot Admin',
      PILOT_ADMIN_PASSWORD: 'a-strong-pilot-password',
    });

    expect(input.PILOT_REPLACE_PASSWORD).toBe('false');
    expect(() =>
      parseBootstrapInput({ ...input, PILOT_ADMIN_PASSWORD: 'too-short' }),
    ).toThrow();
  });
});
