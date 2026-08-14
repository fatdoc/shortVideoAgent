import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import dotenv from '../../apps/storycanvas/node_modules/dotenv/lib/main.js';
import knex from '../../apps/control-api/node_modules/knex/knex.mjs';
import {
  parseLocalManualCaseOptions,
  runLocalManualCase,
} from '../../scripts/local-test/canvas-manual-case.js';

const root = path.resolve(import.meta.dirname, '../..');
const evidenceFile = path.join(
  root,
  'docs/program/t0-canvas-v1/evidence/full-case-visibility/seed-refresh.json',
);
const projectId = '00b4826e-d2d9-58ca-9f88-999bc1013ccb';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`FULL_CASE_${name}_REQUIRED`);
  return value;
}

function stripProvider(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const output = { ...environment };
  delete output.TSX_TSCONFIG_PATH;
  delete output.NODE_OPTIONS;
  for (const key of Object.keys(output)) {
    if (/^(?:ARK_|BYTEPLUS_|SEEDANCE_|VOLCENGINE_|OPENAI_|LLM_|MODELS_)/u.test(key)) {
      delete output[key];
    }
  }
  return output;
}

async function protectedCounts(database: ReturnType<typeof knex>) {
  const tables = [
    'users',
    'organizations',
    'organization_memberships',
    'projects',
    'creative_briefs',
    'script_versions',
    'storyboard_versions',
    'production_packages',
    'invitations',
    'terms_documents',
    'terms_versions',
    'recharge_orders',
    'credit_conversion_rule_versions',
    'wallets',
    'recharge_order_events',
    'payment_events',
    'commission_rule_versions',
    'commission_calculation_outcomes',
    'commission_accruals',
    'commission_reversals',
    'commission_settlements',
    'commission_settlement_items',
  ] as const;
  const output: Record<string, number> = {};
  for (const table of tables) {
    const row = await database(`control_plane.${table}`).count<{ count: string }[]>('* as count').first();
    output[table] = Number(row?.count ?? 0);
  }
  return output;
}

async function main(): Promise<void> {
  const controlFile = required('CANVAS_FULL_CASE_CONTROL_ENV_FILE');
  const storyFile = required('CANVAS_FULL_CASE_STORY_ENV_FILE');
  const password = required('PILOT_LOCAL_ACCOUNT_PASSWORD');
  const control = dotenv.parse(await readFile(controlFile, 'utf8'));
  const story = dotenv.parse(await readFile(storyFile, 'utf8'));
  const localCaseRoot = path.resolve(path.dirname(controlFile), '../..', 'data/videoagent-story-local-case');
  const environment = stripProvider({
    ...process.env,
    ...control,
    ...story,
    DATABASE_URL: control.DATABASE_URL,
    STORYCANVAS_LOCAL_CASE_ROOT: localCaseRoot,
    CANVAS_ASSET_STORAGE_ROOT: path.join(path.dirname(controlFile), 'data/canvas-assets'),
    PILOT_LOCAL_CASE_PROJECT_ID: projectId,
    PILOT_LOCAL_ACCOUNT_PASSWORD: password,
  });
  const database = knex({ client: 'pg', connection: environment.DATABASE_URL, pool: { min: 0, max: 1 } });
  try {
    const before = await protectedCounts(database);
    const summary = await runLocalManualCase(
      parseLocalManualCaseOptions(['--target', 'local'], environment),
    );
    const after = await protectedCounts(database);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new Error('FULL_CASE_PROTECTED_COUNTS_CHANGED');
    }
    if (summary.providerConfigured || summary.paidProviderCalls !== 0) {
      throw new Error('FULL_CASE_PROVIDER_BOUNDARY_VIOLATED');
    }
    await mkdir(path.dirname(evidenceFile), { recursive: true });
    await writeFile(evidenceFile, `${JSON.stringify({
      refreshedAt: new Date().toISOString(),
      projectId,
      packageId: summary.entry.packageId,
      status: summary.status,
      providerConfigured: summary.providerConfigured,
      paidProviderCalls: summary.paidProviderCalls,
      protectedCountsBefore: before,
      protectedCountsAfter: after,
      protectedCountsUnchanged: true,
      activeGrantCount: summary.control.authorityCounts.activeGrant,
    }, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write('[full-case] OFFICIAL_SEED_REFRESH_PASS\n');
  } finally {
    await database.destroy();
  }
}

main().catch((error) => {
  const code = error instanceof Error ? error.message : 'FULL_CASE_SEED_REFRESH_FAILED';
  process.stderr.write(`[full-case] ${code}\n`);
  process.exitCode = 1;
});
