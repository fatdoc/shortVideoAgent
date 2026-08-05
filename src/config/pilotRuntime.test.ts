import { describe, expect, it } from 'vitest';
import { resolvePilotRuntime } from './pilotRuntime';

describe('pilot runtime configuration', () => {
  it('keeps the legacy D2 experience when demo mode is explicit', () => {
    expect(resolvePilotRuntime({ VITE_APP_MODE: 'demo' }, 'https://app.example.com')).toEqual({
      mode: 'demo',
      controlApiBaseUrl: null,
      configurationError: null,
    });
  });

  it('blocks a missing runtime mode outside tests', () => {
    expect(resolvePilotRuntime({}, 'https://app.example.com')).toMatchObject({
      mode: null,
      configurationError: expect.stringContaining('VITE_APP_MODE'),
    });
    expect(resolvePilotRuntime({ MODE: 'test' }, 'https://app.example.com').mode).toBe('demo');
  });

  it('blocks invalid modes and missing pilot API configuration', () => {
    expect(
      resolvePilotRuntime({ VITE_APP_MODE: 'mock' }, 'https://app.example.com').mode,
    ).toBeNull();
    expect(
      resolvePilotRuntime({ VITE_APP_MODE: 'pilot' }, 'https://app.example.com').configurationError,
    ).toContain('VITE_CONTROL_API_BASE_URL');
  });

  it('only accepts HTTP(S) API URLs without embedded secrets', () => {
    expect(
      resolvePilotRuntime(
        { VITE_APP_MODE: 'pilot', VITE_CONTROL_API_BASE_URL: 'javascript:alert(1)' },
        'https://app.example.com',
      ).configurationError,
    ).toContain('HTTP');
    expect(
      resolvePilotRuntime(
        {
          VITE_APP_MODE: 'pilot',
          VITE_CONTROL_API_BASE_URL: 'https://user:secret@api.example.com',
        },
        'https://app.example.com',
      ).configurationError,
    ).toContain('凭据');
  });

  it('requires HTTPS or same-origin API access in production', () => {
    expect(
      resolvePilotRuntime(
        {
          VITE_APP_MODE: 'pilot',
          VITE_CONTROL_API_BASE_URL: 'http://api.example.com',
          PROD: true,
        },
        'https://app.example.com',
      ).configurationError,
    ).toContain('HTTPS');
    expect(
      resolvePilotRuntime(
        {
          VITE_APP_MODE: 'pilot',
          VITE_CONTROL_API_BASE_URL: 'http://localhost:4173/',
          PROD: true,
        },
        'http://localhost:4173',
      ),
    ).toMatchObject({
      mode: 'pilot',
      controlApiBaseUrl: 'http://localhost:4173',
      configurationError: null,
    });
  });
});
