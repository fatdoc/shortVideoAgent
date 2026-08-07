import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase, probeDatabase } from './db/client.js';
import { PostgresAuthRepository } from './auth/repository.js';
import { AuthService } from './auth/service.js';
import { LoginRateLimiter } from './auth/rateLimiter.js';
import { createAuthRouter } from './auth/routes.js';
import { PostgresProjectPolicy } from './projects/policy.js';
import { PostgresContentStore } from './projects/repository.js';
import { createContentRouter } from './projects/routes.js';
import { ProjectGrantTokenService } from './production/grantToken.js';
import { PostgresProductionStore } from './production/repository.js';
import { createProductionRouter } from './production/routes.js';
import { createInternalProjectGrantRouter } from './production/internalRoutes.js';
import { PostgresTermsRepository } from './terms/repository.js';
import { TermsService } from './terms/service.js';
import { createTermsRouter } from './terms/routes.js';
import { PostgresInvitationRepository } from './invitations/repository.js';
import { InvitationService } from './invitations/service.js';
import { InvitationPreviewRateLimiter } from './invitations/previewRateLimiter.js';
import { createInvitationRouter } from './invitations/routes.js';

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
const termsService = new TermsService(new PostgresTermsRepository(database));
const termsRouter = createTermsRouter({
  service: termsService,
  resolveSession: (token) => authService.resolve(token),
  secureCookies: config.nodeEnv === 'production',
  sessionTtlSeconds: config.sessionTtlSeconds,
});
const invitationRepository = new PostgresInvitationRepository(database);
const invitationService = new InvitationService(invitationRepository);
const invitationRouter = createInvitationRouter({
  service: invitationService,
  limiter: new InvitationPreviewRateLimiter(
    config.invitationPreviewMaxAttempts,
    config.invitationPreviewWindowSeconds * 1000,
    config.invitationPreviewBlockSeconds * 1000,
  ),
  resolveSession: (token) => authService.resolve(token),
  resolveChannelIdForOrganization: (organizationId) =>
    invitationRepository.resolveChannelIdForOrganization(organizationId),
  secureCookies: config.nodeEnv === 'production',
  sessionTtlSeconds: config.sessionTtlSeconds,
});
const projectPolicy = new PostgresProjectPolicy(database);
const contentRouter = createContentRouter({
  store: new PostgresContentStore(database),
  policy: projectPolicy,
  resolveSession: (token) => authService.resolve(token),
  secureCookies: config.nodeEnv === 'production',
  sessionTtlSeconds: config.sessionTtlSeconds,
});
const projectGrantTokens = new ProjectGrantTokenService(
  config.projectGrantSigningSecret,
  config.projectGrantActiveKid,
);
const productionStore = new PostgresProductionStore(database, projectGrantTokens);
const internalProductionRouter = createInternalProjectGrantRouter({
  internalToken: config.productionPlaneInternalToken,
  verifier: productionStore,
});
const productionRouter = createProductionRouter({
  store: productionStore,
  policy: projectPolicy,
  resolveSession: (token) => authService.resolve(token),
  secureCookies: config.nodeEnv === 'production',
  sessionTtlSeconds: config.sessionTtlSeconds,
});
const app = createApp({
  appVersion: config.appVersion,
  nodeEnv: config.nodeEnv,
  readinessProbe: () => probeDatabase(database),
  authRouter,
  termsRouter,
  invitationRouter,
  internalProductionRouter,
  contentRouter,
  productionRouter,
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
