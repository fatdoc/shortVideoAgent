export interface PilotE2eProxyEnvironment {
  PILOT_E2E?: string;
  PILOT_E2E_CONTROL_API_PORT?: string;
  PILOT_E2E_AB_GOLDEN_PATH?: string;
  PILOT_E2E_STORYCANVAS_PORT?: string;
}

type PilotE2eProxyTarget = {
  target: string;
  changeOrigin: false;
};

export type PilotE2eProxy = {
  '/api/v1': PilotE2eProxyTarget;
  '/api/production/pilot/canvas'?: PilotE2eProxyTarget;
};

function loopbackPort(value: string | undefined, defaultPort: string, invalidCode: string): number {
  const normalized = value?.trim() || defaultPort;
  if (!/^\d+$/.test(normalized)) throw new Error(invalidCode);
  const port = Number(normalized);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error(invalidCode);
  }
  return port;
}

function controlApiPort(value: string | undefined): number {
  return loopbackPort(value, '10601', 'PILOT_E2E_PROXY_PORT_INVALID');
}

function storyCanvasPort(value: string | undefined): number {
  return loopbackPort(value, '10588', 'PILOT_E2E_STORYCANVAS_PROXY_PORT_INVALID');
}

export function resolvePilotE2eProxy(
  mode: string,
  environment: PilotE2eProxyEnvironment,
): PilotE2eProxy | undefined {
  if (environment.PILOT_E2E !== 'true') return undefined;
  if (mode !== 'test') throw new Error('PILOT_E2E_PROXY_TEST_MODE_REQUIRED');

  const proxy: PilotE2eProxy = {
    '/api/v1': {
      target: `http://127.0.0.1:${controlApiPort(environment.PILOT_E2E_CONTROL_API_PORT)}`,
      changeOrigin: false,
    },
  };

  if (environment.PILOT_E2E_AB_GOLDEN_PATH === 'true') {
    proxy['/api/production/pilot/canvas'] = {
      target: `http://127.0.0.1:${storyCanvasPort(environment.PILOT_E2E_STORYCANVAS_PORT)}`,
      changeOrigin: false,
    };
  }

  return proxy;
}
