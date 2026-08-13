import knex, { type Knex } from 'knex';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { parsePilotE2eEnvironment } from './environment.js';
import {
  PILOT_E2E_FIXTURE_CLOCK,
  createPilotE2eSecrets,
  pilotE2eFixtureAccounts,
  pilotE2eFixtureIds,
  pilotE2eGoldenPathInputs,
} from './fixtures.js';
import { resetMigrateSeedPilotE2e, resetPilotE2eStorage, verifyPilotE2eSeed } from './resetSeed.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const hasDedicatedTestDatabase = (() => {
  if (!databaseUrl) return false;
  try {
    return decodeURIComponent(new URL(databaseUrl).pathname.slice(1)).endsWith('_test');
  } catch {
    return false;
  }
})();

function environment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    PILOT_E2E: 'true',
    CONTROL_API_TEST_DATABASE_URL:
      databaseUrl ?? 'postgres://127.0.0.1:5432/videoagent_control_test',
    ...overrides,
  };
}

describe('Pilot E2E reset/seed contract', () => {
  it('generates runtime-only credentials without changing fixed fixture identities', () => {
    const first = createPilotE2eSecrets();
    const second = createPilotE2eSecrets();

    expect(first.accounts.platformAdmin.email).toBe(pilotE2eFixtureAccounts.platformAdmin.email);
    expect(first.accounts.platformAdmin.password).not.toBe(second.accounts.platformAdmin.password);
    expect(first.invitationTokens.valid).not.toBe(second.invitationTokens.valid);
    expect(first.emailVerificationToken).not.toBe(second.emailVerificationToken);
    expect(pilotE2eFixtureIds.organizations.platform).toMatch(/^[0-9a-f-]{36}$/);
    expect(PILOT_E2E_FIXTURE_CLOCK).toBe('2026-08-11T00:00:00.000Z');
    expect(pilotE2eGoldenPathInputs).toMatchObject({
      tenantId: pilotE2eFixtureIds.tenants.tenantA,
      projectId: pilotE2eFixtureIds.project,
      actorUserId: pilotE2eFixtureIds.users.tenantOperatorA,
      script: { idempotencyKey: 'pilot-e2e-golden-script-v1' },
      storyboard: {
        draftRevisionId: '6e000000-0000-4000-8000-000000000001',
        idempotencyKey: 'pilot-e2e-golden-storyboard-v1',
      },
      productionPackage: { idempotencyKey: 'pilot-e2e-golden-package-v1' },
      canvasEntry: { idempotencyKey: 'pilot-e2e-golden-canvas-entry-v1' },
    });
  });

  it('does not execute reset SQL when the connected database identity mismatches', async () => {
    const raw = vi.fn().mockResolvedValueOnce({ rows: [{ database_name: 'videoagent_control' }] });
    const database = { raw } as unknown as Knex;

    await expect(
      resetPilotE2eStorage(database, parsePilotE2eEnvironment(environment())),
    ).rejects.toMatchObject({ code: 'PILOT_E2E_DATABASE_IDENTITY_MISMATCH' });

    expect(raw).toHaveBeenCalledTimes(1);
    expect(raw).toHaveBeenCalledWith('select current_database() as database_name');
  });
});

describe.runIf(hasDedicatedTestDatabase)('Pilot E2E deterministic PostgreSQL lifecycle', () => {
  let database: Knex | undefined;

  afterAll(async () => {
    await database?.destroy();
  });

  it('resets, migrates and seeds twice with identical safe postconditions and zero LIVE facts', async () => {
    const first = await resetMigrateSeedPilotE2e(environment());
    const second = await resetMigrateSeedPilotE2e(environment());

    expect(second.summary).toEqual(first.summary);
    expect(second.summary).toMatchObject({
      fixtureVersion: 2,
      fixtureClock: PILOT_E2E_FIXTURE_CLOCK,
      migrationCount: 24,
      organizationCount: 5,
      channelCount: 2,
      tenantCount: 2,
      userCount: Object.keys(pilotE2eFixtureAccounts).length,
      projectCount: 1,
      projectAssignmentCount: 1,
      rechargeOrderCount: 1,
      paymentEventCount: 1,
      commissionAccrualCount: 1,
      commissionSettlementDraftCount: 1,
      scriptVersionCount: 0,
      scriptApprovalCount: 0,
      storyboardVersionCount: 0,
      storyboardApprovalCount: 0,
      productionPackageCount: 0,
      projectGrantCount: 0,
      canvasEntryCount: 0,
      canvasEntryRedemptionCount: 0,
      liveFactCount: 0,
      activeSessionCount: 0,
    });
    expect(second.summary.seedFingerprint).toBe(first.summary.seedFingerprint);
    expect(second.summary.seedFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(second.summary)).not.toContain(
      second.secrets.accounts.platformAdmin.password,
    );
    expect(JSON.stringify(second.summary)).not.toContain(second.secrets.invitationTokens.valid);

    database = knex({ client: 'pg', connection: databaseUrl });
    const verified = await verifyPilotE2eSeed(database);
    expect(verified).toEqual(second.summary);

    const storedTermsDocument = await database('control_plane.terms_documents')
      .select('document_code')
      .where({ terms_document_id: pilotE2eFixtureIds.termsDocument })
      .first<{ document_code: string }>();
    expect(storedTermsDocument?.document_code).toBe('registration-notice');

    const storedPlatform = await database('control_plane.users')
      .select('password_hash')
      .where({ user_id: pilotE2eFixtureIds.users.platformAdmin })
      .first<{ password_hash: string }>();
    expect(storedPlatform?.password_hash).not.toBe(second.secrets.accounts.platformAdmin.password);

    const storedInvitation = await database('control_plane.invitations')
      .select('token_digest', 'valid_from', 'expires_at')
      .where({ invitation_id: pilotE2eFixtureIds.invitations.valid })
      .first<{ token_digest: string; valid_from: Date; expires_at: Date }>();
    expect(storedInvitation?.token_digest).not.toContain(second.secrets.invitationTokens.valid);
    expect(storedInvitation?.valid_from.toISOString()).toBe('2026-08-10T00:00:00.000Z');
    expect(storedInvitation?.expires_at.toISOString()).toBe('2026-08-31T00:00:00.000Z');
  }, 120_000);
});
