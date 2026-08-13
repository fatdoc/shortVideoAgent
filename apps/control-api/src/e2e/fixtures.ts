import { randomBytes } from 'node:crypto';
import { createInvitationToken } from '../invitations/token.js';

export const pilotE2eFixtureIds = {
  organizations: {
    platform: '61000000-0000-4000-8000-000000000001',
    channelA: '61000000-0000-4000-8000-000000000002',
    channelB: '61000000-0000-4000-8000-000000000003',
    tenantA: '61000000-0000-4000-8000-000000000004',
    tenantB: '61000000-0000-4000-8000-000000000005',
  },
  channels: {
    channelA: '62000000-0000-4000-8000-000000000001',
    channelB: '62000000-0000-4000-8000-000000000002',
  },
  tenants: {
    tenantA: '63000000-0000-4000-8000-000000000001',
    tenantB: '63000000-0000-4000-8000-000000000002',
  },
  users: {
    platformAdmin: '64000000-0000-4000-8000-000000000001',
    platformSupport: '64000000-0000-4000-8000-000000000002',
    channelAdminA: '64000000-0000-4000-8000-000000000003',
    channelAdminB: '64000000-0000-4000-8000-000000000004',
    tenantAdminA: '64000000-0000-4000-8000-000000000005',
    tenantOperatorA: '64000000-0000-4000-8000-000000000006',
    tenantSuspendableA: '64000000-0000-4000-8000-000000000007',
    tenantAdminB: '64000000-0000-4000-8000-000000000008',
  },
  memberships: {
    platformAdmin: '65000000-0000-4000-8000-000000000001',
    platformSupport: '65000000-0000-4000-8000-000000000002',
    channelAdminA: '65000000-0000-4000-8000-000000000003',
    channelAdminB: '65000000-0000-4000-8000-000000000004',
    tenantAdminA: '65000000-0000-4000-8000-000000000005',
    tenantOperatorA: '65000000-0000-4000-8000-000000000006',
    tenantSuspendableA: '65000000-0000-4000-8000-000000000007',
    tenantAdminB: '65000000-0000-4000-8000-000000000008',
  },
  project: '66000000-0000-4000-8000-000000000001',
  projectAssignment: '66000000-0000-4000-8000-000000000002',
  wallet: '66000000-0000-4000-8000-000000000003',
  termsDocument: '67000000-0000-4000-8000-000000000001',
  termsVersion: '67000000-0000-4000-8000-000000000002',
  invitations: {
    valid: '68000000-0000-4000-8000-000000000001',
    expired: '68000000-0000-4000-8000-000000000002',
    revoked: '68000000-0000-4000-8000-000000000003',
    exhausted: '68000000-0000-4000-8000-000000000004',
    attribution: '68000000-0000-4000-8000-000000000005',
  },
  registration: '69000000-0000-4000-8000-000000000001',
  referralAttribution: '69000000-0000-4000-8000-000000000002',
  conversionRule: '6a000000-0000-4000-8000-000000000001',
  commissionRule: '6a000000-0000-4000-8000-000000000002',
  rechargeOrder: '6b000000-0000-4000-8000-000000000001',
  paymentEvent: '6b000000-0000-4000-8000-000000000002',
  commissionOutcome: '6c000000-0000-4000-8000-000000000001',
  commissionAccrual: '6c000000-0000-4000-8000-000000000002',
  commissionSettlement: '6d000000-0000-4000-8000-000000000001',
} as const;

export const PILOT_E2E_FIXTURE_CLOCK = '2026-08-11T00:00:00.000Z' as const;

export const pilotE2eGoldenPathInputs = {
  tenantId: pilotE2eFixtureIds.tenants.tenantA,
  projectId: pilotE2eFixtureIds.project,
  actorUserId: pilotE2eFixtureIds.users.tenantOperatorA,
  actorMembershipId: pilotE2eFixtureIds.memberships.tenantOperatorA,
  script: {
    idempotencyKey: 'pilot-e2e-golden-script-v1',
    payload: {
      title: 'Pilot E2E Golden Path Script',
      language: 'zh-CN',
      synopsis: 'Deterministic TEST-only input; no LIVE production or payment meaning.',
    },
  },
  storyboard: {
    draftRevisionId: '6e000000-0000-4000-8000-000000000001',
    shotId: '6e000000-0000-4000-8000-000000000002',
    sourceCommandId: '6e000000-0000-4000-8000-000000000003',
    sourceReceiptId: '6e000000-0000-4000-8000-000000000004',
    idempotencyKey: 'pilot-e2e-golden-storyboard-v1',
    generationPolicy: {
      policyId: 'pilot-e2e-golden-path',
      policyVersion: '1.0.0',
    },
  },
  productionPackage: {
    idempotencyKey: 'pilot-e2e-golden-package-v1',
    capabilityRequirements: ['video.generate'] as const,
    expiresInSeconds: 600,
  },
  canvasEntry: {
    idempotencyKey: 'pilot-e2e-golden-canvas-entry-v1',
    ttlSeconds: 120,
  },
  redemption: {
    idempotencyKey: 'pilot-e2e-golden-redemption-v1',
  },
} as const;

export const pilotE2eFixtureAccounts = {
  platformAdmin: {
    email: 'pilot-e2e-platform-admin@example.test',
    displayName: 'Pilot E2E Platform Admin',
  },
  platformSupport: {
    email: 'pilot-e2e-platform-support@example.test',
    displayName: 'Pilot E2E Platform Support',
  },
  channelAdminA: {
    email: 'pilot-e2e-channel-a@example.test',
    displayName: 'Pilot E2E Channel A Admin',
  },
  channelAdminB: {
    email: 'pilot-e2e-channel-b@example.test',
    displayName: 'Pilot E2E Channel B Admin',
  },
  tenantAdminA: {
    email: 'pilot-e2e-tenant-a-admin@example.test',
    displayName: 'Pilot E2E Tenant A Admin',
  },
  tenantOperatorA: {
    email: 'pilot-e2e-tenant-a-operator@example.test',
    displayName: 'Pilot E2E Tenant A Operator',
  },
  tenantSuspendableA: {
    email: 'pilot-e2e-tenant-a-suspendable@example.test',
    displayName: 'Pilot E2E Tenant A Suspendable Member',
  },
  tenantAdminB: {
    email: 'pilot-e2e-tenant-b-admin@example.test',
    displayName: 'Pilot E2E Tenant B Admin',
  },
} as const;

export type PilotE2eAccountKey = keyof typeof pilotE2eFixtureAccounts;
export type PilotE2eInvitationKey = 'valid' | 'expired' | 'revoked' | 'exhausted';

export type PilotE2eSecrets = {
  accounts: Record<PilotE2eAccountKey, { email: string; password: string }>;
  invitationTokens: Record<PilotE2eInvitationKey, string>;
  emailVerificationToken: string;
};

function temporaryPassword(): string {
  return `Pilot-E2E-${randomBytes(24).toString('base64url')}`;
}

export function createPilotE2eSecrets(): PilotE2eSecrets {
  return {
    accounts: Object.fromEntries(
      Object.entries(pilotE2eFixtureAccounts).map(([key, account]) => [
        key,
        { email: account.email, password: temporaryPassword() },
      ]),
    ) as PilotE2eSecrets['accounts'],
    invitationTokens: {
      valid: createInvitationToken(),
      expired: createInvitationToken(),
      revoked: createInvitationToken(),
      exhausted: createInvitationToken(),
    },
    emailVerificationToken: randomBytes(32).toString('base64url'),
  };
}
