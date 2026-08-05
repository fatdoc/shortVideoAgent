export type AppMode = 'demo' | 'pilot';

export type PilotRuntime =
  | { mode: 'demo'; controlApiBaseUrl: null; configurationError: null }
  | { mode: 'pilot'; controlApiBaseUrl: string | null; configurationError: string | null }
  | { mode: null; controlApiBaseUrl: null; configurationError: string };

export interface PilotRuntimeEnvironment {
  VITE_APP_MODE?: string;
  VITE_CONTROL_API_BASE_URL?: string;
  PROD?: boolean;
  MODE?: string;
}

function validateControlApiBaseUrl(
  rawValue: string | undefined,
  production: boolean,
  locationOrigin: string,
): { value: string | null; error: string | null } {
  const value = rawValue?.trim();
  if (!value) {
    return {
      value: null,
      error: 'Pilot 模式缺少 VITE_CONTROL_API_BASE_URL，真实登录已阻断。',
    };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { value: null, error: 'Pilot Control API 地址不是有效的绝对 URL。' };
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { value: null, error: 'Pilot Control API 地址只允许 HTTP 或 HTTPS。' };
  }
  if (url.username || url.password || url.search || url.hash) {
    return { value: null, error: 'Pilot Control API 地址不得包含凭据、查询参数或片段。' };
  }
  if (production && url.protocol !== 'https:' && url.origin !== locationOrigin) {
    return { value: null, error: '生产环境的 Pilot Control API 必须使用 HTTPS 或与页面同源。' };
  }

  return { value: url.toString().replace(/\/$/, ''), error: null };
}

export function resolvePilotRuntime(
  environment: PilotRuntimeEnvironment,
  locationOrigin = window.location.origin,
): PilotRuntime {
  const rawMode = environment.VITE_APP_MODE?.trim() || (environment.MODE === 'test' ? 'demo' : '');
  if (!rawMode) {
    return {
      mode: null,
      controlApiBaseUrl: null,
      configurationError: '缺少 VITE_APP_MODE，必须明确设置为 demo 或 pilot。',
    };
  }
  if (rawMode !== 'demo' && rawMode !== 'pilot') {
    return {
      mode: null,
      controlApiBaseUrl: null,
      configurationError: `VITE_APP_MODE=${rawMode} 无效，只允许 demo 或 pilot。`,
    };
  }
  if (rawMode === 'demo') {
    return { mode: 'demo', controlApiBaseUrl: null, configurationError: null };
  }

  const api = validateControlApiBaseUrl(
    environment.VITE_CONTROL_API_BASE_URL,
    environment.PROD === true,
    locationOrigin,
  );
  return {
    mode: 'pilot',
    controlApiBaseUrl: api.value,
    configurationError: api.error,
  };
}

export const pilotRuntime = resolvePilotRuntime(import.meta.env);
