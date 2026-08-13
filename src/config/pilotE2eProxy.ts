export interface PilotE2eProxyEnvironment {
  PILOT_E2E?: string;
  PILOT_E2E_AB_GOLDEN_PATH?: string;
  PILOT_E2E_CONTROL_API_PORT?: string;
  PILOT_E2E_STORYCANVAS_PORT?: string;
}

export type PilotE2eProxy = {
  '/api/v1': {
    target: string;
    changeOrigin: false;
  };
} & Partial<{
  '/api/production/pilot/canvas': {
    target: string;
    changeOrigin: false;
  };
}>;

function loopbackPort(value: string | undefined, fallback: string, errorCode: string): number {
  const normalized = value?.trim() || fallback;
  if (!/^\d+$/u.test(normalized)) throw new Error(errorCode);
  const port = Number(normalized);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error(errorCode);
  }
  return port;
}

export function resolvePilotE2eProxy(
  mode: string,
  environment: PilotE2eProxyEnvironment,
): PilotE2eProxy | undefined {
  if (environment.PILOT_E2E !== 'true') return undefined;
  if (mode !== 'test') throw new Error('PILOT_E2E_PROXY_TEST_MODE_REQUIRED');

  const proxy: PilotE2eProxy = {
    '/api/v1': {
      target: `http://127.0.0.1:${loopbackPort(
        environment.PILOT_E2E_CONTROL_API_PORT,
        '10601',
        'PILOT_E2E_PROXY_PORT_INVALID',
      )}`,
      changeOrigin: false,
    },
  };
  if (environment.PILOT_E2E_AB_GOLDEN_PATH === 'true') {
    proxy['/api/production/pilot/canvas'] = {
      target: `http://127.0.0.1:${loopbackPort(
        environment.PILOT_E2E_STORYCANVAS_PORT,
        '10588',
        'PILOT_E2E_STORYCANVAS_PROXY_PORT_INVALID',
      )}`,
      changeOrigin: false,
    };
  }
  return proxy;
}
