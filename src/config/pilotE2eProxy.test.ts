import { describe, expect, it } from 'vitest';
import { resolvePilotE2eProxy } from './pilotE2eProxy';

describe('Pilot E2E same-origin proxy contract', () => {
  it('is disabled unless the explicit Harness flag is enabled', () => {
    expect(resolvePilotE2eProxy('test', {})).toBeUndefined();
    expect(resolvePilotE2eProxy('development', { PILOT_E2E: 'false' })).toBeUndefined();
  });

  it('only targets the fixed loopback Control API in test mode', () => {
    expect(resolvePilotE2eProxy('test', { PILOT_E2E: 'true' })).toEqual({
      '/api/v1': {
        target: 'http://127.0.0.1:10601',
        changeOrigin: false,
      },
    });
    expect(
      resolvePilotE2eProxy('test', {
        PILOT_E2E: 'true',
        PILOT_E2E_CONTROL_API_PORT: '16001',
      }),
    ).toEqual({
      '/api/v1': {
        target: 'http://127.0.0.1:16001',
        changeOrigin: false,
      },
    });
  });

  it('adds the StoryCanvas loopback transport only for the explicit A/B Golden Path harness', () => {
    const goldenPathEnvironment = {
      PILOT_E2E: 'true',
      PILOT_E2E_AB_GOLDEN_PATH: 'true',
    };

    expect(resolvePilotE2eProxy('test', goldenPathEnvironment)).toEqual({
      '/api/v1': {
        target: 'http://127.0.0.1:10601',
        changeOrigin: false,
      },
      '/api/production/pilot/canvas': {
        target: 'http://127.0.0.1:10588',
        changeOrigin: false,
      },
    });

    const nonGoldenPathEnvironment = {
      ...goldenPathEnvironment,
      PILOT_E2E_AB_GOLDEN_PATH: 'false',
    };

    expect(resolvePilotE2eProxy('test', nonGoldenPathEnvironment)).toEqual({
      '/api/v1': {
        target: 'http://127.0.0.1:10601',
        changeOrigin: false,
      },
    });
  });

  it('fails closed when the A/B Golden Path StoryCanvas loopback port is invalid', () => {
    const environment = {
      PILOT_E2E: 'true',
      PILOT_E2E_AB_GOLDEN_PATH: 'true',
      PILOT_E2E_STORYCANVAS_PORT: 'https://remote.example.com',
    };

    expect(() => resolvePilotE2eProxy('test', environment)).toThrow(
      'PILOT_E2E_STORYCANVAS_PROXY_PORT_INVALID',
    );
  });

  it('fails closed outside test mode or for an invalid port', () => {
    expect(() => resolvePilotE2eProxy('development', { PILOT_E2E: 'true' })).toThrow(
      'PILOT_E2E_PROXY_TEST_MODE_REQUIRED',
    );
    expect(() =>
      resolvePilotE2eProxy('test', {
        PILOT_E2E: 'true',
        PILOT_E2E_CONTROL_API_PORT: 'https://remote.example.com',
      }),
    ).toThrow('PILOT_E2E_PROXY_PORT_INVALID');
  });
});
