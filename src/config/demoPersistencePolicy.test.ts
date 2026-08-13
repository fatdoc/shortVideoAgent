import { describe, expect, it } from 'vitest';
import { isDemoBrowserPersistenceEnabled } from './demoPersistencePolicy';

describe('Demo browser persistence policy', () => {
  it('only permits browser persistence in explicit Demo mode', () => {
    expect(
      isDemoBrowserPersistenceEnabled({
        mode: 'demo',
        controlApiBaseUrl: null,
        configurationError: null,
      }),
    ).toBe(true);
    expect(
      isDemoBrowserPersistenceEnabled({
        mode: 'pilot',
        controlApiBaseUrl: 'https://control.example.com',
        configurationError: null,
      }),
    ).toBe(false);
    expect(
      isDemoBrowserPersistenceEnabled({
        mode: null,
        controlApiBaseUrl: null,
        configurationError: 'invalid runtime',
      }),
    ).toBe(false);
  });
});
