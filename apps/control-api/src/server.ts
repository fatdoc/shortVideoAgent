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
import { PostgresStoryboardAuthorityStore } from './storyboards/repository.js';
import { createStoryboardRouter } from './storyboards/routes.js';
import { StoryboardAuthorityService } from './storyboards/service.js';
import { ProjectGrantTokenService } from './production/grantToken.js';
import { PostgresProductionStore } from './production/repository.js';
import { createProductionRouter } from './production/routes.js';
import { createInternalProjectGrantRouter } from './production/internalRoutes.js';
import { createInternalCanvasEntryRouter } from './canvasEntries/internalRoutes.js';
import { PostgresCanvasEntryRepository } from './canvasEntries/repository.js';
import { createCanvasEntryRouter } from './canvasEntries/routes.js';
import { CanvasEntryService } from './canvasEntries/service.js';
import { PostgresTermsRepository } from './terms/repository.js';
import { TermsService } from './terms/service.js';
import { createTermsRouter } from './terms/routes.js';
import { PostgresInvitationRepository } from './invitations/repository.js';
import { InvitationService } from './invitations/service.js';
import { InvitationPreviewRateLimiter } from './invitations/previewRateLimiter.js';
import { createInvitationRouter } from './invitations/routes.js';
import { createEmailVerification } from './registrations/emailVerification.js';
import { RegistrationRateLimiter } from './registrations/rateLimiter.js';
import { PostgresRegistrationRepository } from './registrations/repository.js';
import { createRegistrationRouter } from './registrations/routes.js';
import { RegistrationService } from './registrations/service.js';
import { PostgresPaymentFoundationRepository } from './payments/repository.js';
import { createPaymentRouter } from './payments/routes.js';
import { PaymentFoundationService } from './payments/service.js';
import { PostgresCommercialChannelRepository } from './channels/repository.js';
import { createCommercialChannelRouter } from './channels/routes.js';
import { CommercialChannelService } from './channels/service.js';
import { PostgresCommissionAuditRepository } from './commissions/repository.js';
import { createCommissionAuditRouter } from './commissions/routes.js';
import { CommissionAuditService } from './commissions/service.js';
import { PostgresCommissionSettlementRepository } from './settlements/repository.js';
import { createCommissionSettlementRouter } from './settlements/routes.js';
import { CommissionSettlementService } from './settlements/service.js';
import { PostgresMemberDirectoryRepository } from './members/repository.js';
import { createMemberDirectoryRouter } from './members/routes.js';
import { MemberDirectoryService } from './members/service.js';
import { PostgresCanvasAssetAuthorityRepository } from './assets/repository.js';
import { CanvasAssetAuthorityService } from './assets/service.js';
import { createCanvasAssetRouter } from './assets/routes.js';
import { createInternalCanvasAssetSessionRouter } from './assets/internalSessionRoutes.js';
import { PostgresCanvasAssetSessionAuthorityRepository } from './assets/sessionRepository.js';
import { CanvasAssetSessionAuthorityService } from './assets/sessionService.js';
import { createInternalCanvasApprovalRouter } from './assets/internalApprovalRoutes.js';
import { CanvasActivationService } from './assets/activationService.js';
import { PostgresCanvasAssetMaterializationRepository } from './assets/materializationRepository.js';
import { CanvasAssetMaterializationService } from './assets/materializationService.js';
import { LocalCanvasAssetStorageReader } from './assets/materializationStorage.js';
import { createInternalCanvasAssetMaterializationRouter } from './assets/internalMaterializationRoutes.js';
import { createInternalCanvasWorkspaceAuthorityRouter } from './assets/internalWorkspaceAuthorityRoutes.js';
import { CanvasWorkspaceAuthorityService } from './assets/workspaceAuthorityService.js';
import { PostgresCanvasWorkspaceAuthorityRepository } from './production/workspaceAuthorityRepository.js';

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
const registrationRouter = createRegistrationRouter({
  service: new RegistrationService(
    new PostgresRegistrationRepository(database),
    createEmailVerification(),
    config.registrationIdempotencySecret,
  ),
  limiter: new RegistrationRateLimiter(
    config.registrationMaxAttempts,
    config.registrationWindowSeconds * 1000,
    config.registrationBlockSeconds * 1000,
  ),
});
const paymentService = new PaymentFoundationService(
  new PostgresPaymentFoundationRepository(database),
  config.rechargePaymentDigestSecret,
);
const paymentRouter = createPaymentRouter({
  service: paymentService,
  resolveSession: (token) => authService.resolve(token),
  internalToken: config.testPaymentInternalToken,
  secureCookies: config.nodeEnv === 'production',
  sessionTtlSeconds: config.sessionTtlSeconds,
});
const commercialChannelRouter = createCommercialChannelRouter({
  service: new CommercialChannelService(new PostgresCommercialChannelRepository(database)),
  resolveSession: (token) => authService.resolve(token),
  secureCookies: config.nodeEnv === 'production',
  sessionTtlSeconds: config.sessionTtlSeconds,
});
const commissionAuditRouter = createCommissionAuditRouter({
  service: new CommissionAuditService(new PostgresCommissionAuditRepository(database)),
  resolveSession: (token) => authService.resolve(token),
  secureCookies: config.nodeEnv === 'production',
  sessionTtlSeconds: config.sessionTtlSeconds,
});
const commissionSettlementRouter = createCommissionSettlementRouter({
  service: new CommissionSettlementService(
    new PostgresCommissionSettlementRepository(database),
    config.rechargePaymentDigestSecret,
  ),
  resolveSession: (token) => authService.resolve(token),
  secureCookies: config.nodeEnv === 'production',
  sessionTtlSeconds: config.sessionTtlSeconds,
});
const memberDirectoryRouter = createMemberDirectoryRouter({
  service: new MemberDirectoryService(new PostgresMemberDirectoryRepository(database)),
  resolveSession: (token) => authService.resolve(token),
  secureCookies: config.nodeEnv === 'production',
  sessionTtlSeconds: config.sessionTtlSeconds,
});
const projectPolicy = new PostgresProjectPolicy(database);
const canvasAssetSessionAuthorityService = new CanvasAssetSessionAuthorityService(
  new PostgresCanvasAssetSessionAuthorityRepository(database),
);
const canvasAssetAuthorityRepository = new PostgresCanvasAssetAuthorityRepository(database);
const canvasAssetAuthorityService = new CanvasAssetAuthorityService(
  canvasAssetAuthorityRepository,
  config.canvasApprovalFingerprintSecret,
  { sessionAuthority: canvasAssetSessionAuthorityService },
);
const internalCanvasAssetSessionRouter = createInternalCanvasAssetSessionRouter({
  internalToken: config.productionPlaneInternalToken,
  service: canvasAssetSessionAuthorityService,
});
const internalCanvasApprovalRouter = createInternalCanvasApprovalRouter({
  internalToken: config.productionPlaneInternalToken,
  service: canvasAssetAuthorityService,
});
const internalCanvasAssetMaterializationRouter = createInternalCanvasAssetMaterializationRouter({
  internalToken: config.productionPlaneInternalToken,
  service: new CanvasAssetMaterializationService({
    sessionAuthority: canvasAssetSessionAuthorityService,
    assets: canvasAssetAuthorityRepository,
    storage: new LocalCanvasAssetStorageReader(config.canvasAssetStorageRoot),
    attempts: new PostgresCanvasAssetMaterializationRepository(database),
  }),
});
const internalCanvasWorkspaceAuthorityRouter = createInternalCanvasWorkspaceAuthorityRouter({
  internalToken: config.productionPlaneInternalToken,
  service: new CanvasWorkspaceAuthorityService({
    sessionAuthority: canvasAssetSessionAuthorityService,
    productionAuthority: new PostgresCanvasWorkspaceAuthorityRepository(database),
    assets: canvasAssetAuthorityRepository,
  }),
});
const contentRouter = createContentRouter({
  store: new PostgresContentStore(database),
  policy: projectPolicy,
  resolveSession: (token) => authService.resolve(token),
  secureCookies: config.nodeEnv === 'production',
  sessionTtlSeconds: config.sessionTtlSeconds,
});
const storyboardRouter = createStoryboardRouter({
  service: new StoryboardAuthorityService(new PostgresStoryboardAuthorityStore(database)),
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
const canvasEntryService = new CanvasEntryService(
  new PostgresCanvasEntryRepository(database, undefined, undefined, productionStore),
  config.rechargePaymentDigestSecret,
);
const canvasActivationService = new CanvasActivationService(
  canvasEntryService,
  config.canvasActivationIdempotencySecret,
);
const assetRouter = createCanvasAssetRouter({
  service: canvasAssetAuthorityService,
  activationService: canvasActivationService,
  policy: projectPolicy,
  resolveSession: (token) => authService.resolve(token),
  secureCookies: config.nodeEnv === 'production',
  sessionTtlSeconds: config.sessionTtlSeconds,
  allowedOrigins: config.canvasAssetAllowedOrigins,
  csrfSecret: config.canvasAssetCsrfSecret,
});
const internalCanvasEntryRouter = createInternalCanvasEntryRouter({
  internalToken: config.productionPlaneInternalToken,
  service: canvasEntryService,
});
const canvasEntryRouter = createCanvasEntryRouter({
  service: canvasEntryService,
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
  registrationRouter,
  internalProductionRouter,
  internalCanvasEntryRouter,
  internalCanvasAssetSessionRouter,
  internalCanvasApprovalRouter,
  internalCanvasAssetMaterializationRouter,
  internalCanvasWorkspaceAuthorityRouter,
  contentRouter,
  storyboardRouter,
  productionRouter,
  canvasEntryRouter,
  paymentRouter,
  commercialChannelRouter,
  commissionAuditRouter,
  commissionSettlementRouter,
  memberDirectoryRouter,
  assetRouter,
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
