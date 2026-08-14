import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import knex from 'knex';
import { parsePilotE2eEnvironment, runWithVerifiedPilotE2eDatabase } from './environment.js';
import {
  createPilotE2eSecrets,
  pilotE2eFixtureIds,
  type PilotE2eAccountKey,
  type PilotE2eSecrets,
} from './fixtures.js';
import { resetMigrateSeedPilotE2e, type PilotE2eSeedResult } from './resetSeed.js';

type PilotLocalRole = 'platform_admin' | 'channel_admin' | 'tenant_admin' | 'content_operator';

export const PILOT_LOCAL_ACCOUNTS: readonly {
  accountKey: PilotE2eAccountKey;
  email: string;
  displayName: string;
  role: PilotLocalRole;
}[] = [
  {
    accountKey: 'platformAdmin',
    email: 'platform@videoagent.test',
    displayName: '平台管理员',
    role: 'platform_admin',
  },
  {
    accountKey: 'channelAdminA',
    email: 'channel@videoagent.test',
    displayName: '渠道管理员',
    role: 'channel_admin',
  },
  {
    accountKey: 'tenantAdminA',
    email: 'admin@videoagent.test',
    displayName: '门店管理员',
    role: 'tenant_admin',
  },
  {
    accountKey: 'tenantOperatorA',
    email: 'operator@videoagent.test',
    displayName: '内容运营',
    role: 'content_operator',
  },
] as const;

export function parsePilotLocalAccountPassword(value: string | undefined): string {
  if (
    typeof value !== 'string' ||
    value.length < 12 ||
    value.length > 128 ||
    /\s/.test(value) ||
    !/[a-z]/.test(value) ||
    !/[A-Z]/.test(value) ||
    !/[0-9]/.test(value) ||
    !/[^A-Za-z0-9]/.test(value)
  ) {
    throw new Error('PILOT_LOCAL_ACCOUNT_PASSWORD_INVALID');
  }
  return value;
}

export function createPilotLocalSecrets(password: string): PilotE2eSecrets {
  const validatedPassword = parsePilotLocalAccountPassword(password);
  const secrets = createPilotE2eSecrets();
  for (const account of PILOT_LOCAL_ACCOUNTS) {
    secrets.accounts[account.accountKey] = {
      email: account.email,
      password: validatedPassword,
    };
  }
  return secrets;
}

export async function resetMigrateSeedPilotLocalAccounts(
  environmentVariables: NodeJS.ProcessEnv = process.env,
): Promise<PilotE2eSeedResult> {
  const password = parsePilotLocalAccountPassword(
    environmentVariables.PILOT_LOCAL_ACCOUNT_PASSWORD,
  );
  const environment = parsePilotE2eEnvironment(environmentVariables);
  const result = await resetMigrateSeedPilotE2e(
    environmentVariables,
    createPilotLocalSecrets(password),
  );
  const database = knex({
    client: 'pg',
    connection: environment.databaseUrl,
    pool: { min: 0, max: 1 },
  });

  try {
    await runWithVerifiedPilotE2eDatabase(database, environment, async () => {
      await database.transaction(async (transaction) => {
        for (const account of PILOT_LOCAL_ACCOUNTS) {
          const userId = pilotE2eFixtureIds.users[account.accountKey];
          const updated = await transaction('control_plane.users')
            .where({ user_id: userId, email: account.email })
            .update({ display_name: account.displayName, updated_at: transaction.fn.now() });
          if (updated !== 1) {
            throw new Error('PILOT_LOCAL_ACCOUNT_SEED_FAILED');
          }

          const membership = await transaction('control_plane.organization_memberships')
            .where({ user_id: userId, status: 'active' })
            .first<{ primary_role_code: string }>('primary_role_code');
          if (membership?.primary_role_code !== account.role) {
            throw new Error('PILOT_LOCAL_ACCOUNT_ROLE_MISMATCH');
          }
        }
      });
    });
    return result;
  } finally {
    await database.destroy();
  }
}

async function main(): Promise<void> {
  try {
    const result = await resetMigrateSeedPilotLocalAccounts();
    console.info(
      JSON.stringify({
        event: 'pilot_local_accounts_seeded',
        environment: result.environment,
        accounts: PILOT_LOCAL_ACCOUNTS.map(({ email, displayName, role }) => ({
          email,
          displayName,
          role,
        })),
        credentialOutput: false,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'pilot_local_accounts_seed_failed',
        code: error instanceof Error ? error.message : 'PILOT_LOCAL_ACCOUNT_SEED_FAILED',
      }),
    );
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
