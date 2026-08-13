export interface PilotE2eProxyEnvironment {
  PILOT_E2E?: string;
  PILOT_E2E_CONTROL_API_PORT?: string;
}

export type PilotE2eProxy = {
  '/api/v1': {
    target: string;
    changeOrigin: false;
  };
};

function controlApiPort(value: string | undefined): number {
  const normalized = value?.trim() || '10601';
  if (!/^\d+$/.test(normalized)) throw new Error('PILOT_E2E_PROXY_PORT_INVALID');
  const port = Number(normalized);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PILOT_E2E_PROXY_PORT_INVALID');
  }
  return port;
}

export function resolvePilotE2eProxy(
  mode: string,
  environment: PilotE2eProxyEnvironment,
): PilotE2eProxy | undefined {
  if (environment.PILOT_E2E !== 'true') return undefined;
  if (mode !== 'test') throw new Error('PILOT_E2E_PROXY_TEST_MODE_REQUIRED');

  return {
    '/api/v1': {
      target: `http://127.0.0.1:${controlApiPort(environment.PILOT_E2E_CONTROL_API_PORT)}`,
      changeOrigin: false,
    },
  };
}
