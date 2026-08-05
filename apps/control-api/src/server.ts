import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase, probeDatabase } from './db/client.js';
import { PostgresAuthRepository } from './auth/repository.js';
import { AuthService } from './auth/service.js';
import { LoginRateLimiter } from './auth/rateLimiter.js';
import { createAuthRouter } from './auth/routes.js';

const config = loadConfig();
const database = createDatabase(config);
const authService = new AuthService(
  new PostgresAuthRepository(database),
  config.sessionSecret,
  config.sessionTtlSeconds,
  config.sessionRotationSeconds,
);
const authRouter = createAuthRouter({
  service: authService,
  limiter: new LoginRateLimiter(
    config.loginMaxAttempts,
    config.loginWindowSeconds * 1000,
    config.loginBlockSeconds * 1000,
  ),
  secureCookies: config.nodeEnv === 'production',
  sessionTtlSeconds: config.sessionTtlSeconds,
});
const app = createApp({
  appVersion: config.appVersion,
  nodeEnv: config.nodeEnv,
  readinessProbe: () => probeDatabase(database),
  authRouter,
  trustProxy: config.trustProxy,
});

const server = app.listen(config.port, config.host, () => {
  console.info(
    JSON.stringify({
      event: 'control_api_started',
      host: config.host,
      port: config.port,
      version: config.appVersion,
    }),
  );
});

async function shutdown(signal: string) {
  console.info(JSON.stringify({ event: 'control_api_stopping', signal }));
  server.close(async () => {
    await database.destroy();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
