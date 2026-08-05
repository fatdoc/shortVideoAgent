import { z } from 'zod';

const DEVELOPMENT_SESSION_SECRET = 'local-development-only-change-before-deploying';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CONTROL_API_HOST: z.string().min(1).default('127.0.0.1'),
  CONTROL_API_PORT: z.coerce.number().int().min(1).max(65_535).default(10_600),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgres://videoagent:videoagent-local@127.0.0.1:54329/videoagent_control'),
  DATABASE_SSL: z.enum(['disable', 'require']).default('disable'),
  SESSION_SECRET: z.string().min(32).optional(),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(604_800).default(28_800),
  SESSION_ROTATION_SECONDS: z.coerce.number().int().min(60).max(86_400).default(1_800),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(2).max(100).default(5),
  LOGIN_WINDOW_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  LOGIN_BLOCK_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  APP_VERSION: z.string().min(1).default('pilot-v0-dev'),
});

export type ControlApiConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  databaseUrl: string;
  databaseSsl: 'disable' | 'require';
  sessionSecret: string;
  sessionTtlSeconds: number;
  sessionRotationSeconds: number;
  loginMaxAttempts: number;
  loginWindowSeconds: number;
  loginBlockSeconds: number;
  trustProxy: boolean;
  appVersion: string;
};

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): ControlApiConfig {
  const parsed = environmentSchema.parse(environment);
  const sessionSecret = parsed.SESSION_SECRET ?? DEVELOPMENT_SESSION_SECRET;

  if (parsed.NODE_ENV === 'production' && sessionSecret === DEVELOPMENT_SESSION_SECRET) {
    throw new Error('SESSION_SECRET must be explicitly configured in production');
  }

  if (parsed.NODE_ENV === 'production' && parsed.DATABASE_URL.includes('videoagent-local')) {
    throw new Error('DATABASE_URL must not use the local pilot credential in production');
  }

  if (parsed.SESSION_ROTATION_SECONDS >= parsed.SESSION_TTL_SECONDS) {
    throw new Error('SESSION_ROTATION_SECONDS must be less than SESSION_TTL_SECONDS');
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.CONTROL_API_HOST,
    port: parsed.CONTROL_API_PORT,
    databaseUrl: parsed.DATABASE_URL,
    databaseSsl: parsed.DATABASE_SSL,
    sessionSecret,
    sessionTtlSeconds: parsed.SESSION_TTL_SECONDS,
    sessionRotationSeconds: parsed.SESSION_ROTATION_SECONDS,
    loginMaxAttempts: parsed.LOGIN_MAX_ATTEMPTS,
    loginWindowSeconds: parsed.LOGIN_WINDOW_SECONDS,
    loginBlockSeconds: parsed.LOGIN_BLOCK_SECONDS,
    trustProxy: parsed.TRUST_PROXY === 'true',
    appVersion: parsed.APP_VERSION,
  };
}
