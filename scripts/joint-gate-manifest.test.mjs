import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  JOINT_GATE_PHASE_IDS,
  jointGatePhases,
  validateDedicatedPostgresTestUrl,
} from './joint-gate-manifest.mjs';

const repositoryRoot = process.cwd();
const runnerPath = path.join(repositoryRoot, 'scripts/run-joint-gate.mjs');

const requiredPhaseIds = [
  'root-unit',
  'control-api-postgres',
  'cross-plane-contract-v02',
  'storycanvas-v02-targeted',
  'pilot-browser-e2e',
  'ab-golden-path',
  'root-build',
  'control-api-build-typecheck',
  'storycanvas-build-targeted',
  'governance',
  'repository-diff-check',
  'migration-rollback-reapply',
];

function runRunner(args, environment = {}) {
  return spawnSync(process.execPath, [runnerPath, ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      CONTROL_API_TEST_DATABASE_URL: '',
      ARK_API_KEY: 'provider-secret-must-not-appear',
      BYTEPLUS_TTS_ACCESS_TOKEN: 'provider-secret-must-not-appear',
      BYTEPLUS_TTS_APP_ID: 'provider-secret-must-not-appear',
      ...environment,
    },
  });
}

test('manifest contains every frozen full Joint Gate phase exactly once', () => {
  assert.deepEqual(JOINT_GATE_PHASE_IDS, requiredPhaseIds);
  assert.deepEqual(
    jointGatePhases.map(({ id }) => id),
    requiredPhaseIds,
  );
  assert.equal(new Set(JOINT_GATE_PHASE_IDS).size, requiredPhaseIds.length);

  for (const phase of jointGatePhases) {
    assert.match(phase.owner, /^(A|B|A\/B)$/);
    assert.equal(phase.requiredInFull, true);
    assert.match(phase.description, /\S/);
    assert.ok(['ready', 'planned', 'external'].includes(phase.availability));
    assert.ok(Array.isArray(phase.commands));
    assert.ok(phase.commands.length > 0);
    for (const command of phase.commands) {
      assert.match(command.executable, /\S/);
      assert.ok(Array.isArray(command.args));
      assert.equal(command.shell, false);
    }
  }
});

test('StoryCanvas v0.2 phase explicitly records tests omitted by the package default script', () => {
  const phase = jointGatePhases.find(({ id }) => id === 'storycanvas-v02-targeted');
  assert.ok(phase);
  assert.deepEqual(phase.evidencePaths, [
    'apps/storycanvas/src/contracts/v0.2/runtime.test.ts',
    'apps/storycanvas/src/contracts/v0.2/security.test.ts',
    'apps/storycanvas/src/routes/production/v0.2/index.test.ts',
    'apps/storycanvas/src/services/storycanvas/pilotV02Receiver.test.ts',
  ]);
  assert.notDeepEqual(phase.commands[0].args, ['--prefix', 'apps/storycanvas', 'test']);
});

test('dedicated PostgreSQL validation rejects missing, non-PostgreSQL, and development database URLs', () => {
  assert.deepEqual(validateDedicatedPostgresTestUrl(undefined), {
    ok: false,
    code: 'CONTROL_API_TEST_DATABASE_URL_REQUIRED',
  });
  assert.deepEqual(validateDedicatedPostgresTestUrl('mysql://localhost/control_test'), {
    ok: false,
    code: 'CONTROL_API_TEST_DATABASE_URL_INVALID_PROTOCOL',
  });
  assert.deepEqual(
    validateDedicatedPostgresTestUrl(
      'postgres://videoagent:do-not-print@127.0.0.1:54329/videoagent_control',
    ),
    { ok: false, code: 'CONTROL_API_TEST_DATABASE_URL_NOT_DEDICATED' },
  );
  assert.deepEqual(
    validateDedicatedPostgresTestUrl(
      'postgres://videoagent:do-not-print@127.0.0.1:54329/videoagent_control_test',
    ),
    { ok: true, databaseName: 'videoagent_control_test' },
  );
});

test('--list and --plan only report NOT_RUN phases and never execute commands', () => {
  for (const mode of ['--list', '--plan']) {
    const result = runRunner([mode]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /JOINT_GATE_RUNNER_READY/);
    assert.match(result.stdout, /NOT_RUN/);
    assert.match(result.stdout, /control-api-postgres/);
    assert.doesNotMatch(result.stdout, /JOINT_GATE_PASS/);
  }
});

test('package scripts expose manifest, plan, and fail-closed full entry points', async () => {
  const packageJson = JSON.parse(
    await (
      await import('node:fs/promises')
    ).readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
  );
  assert.equal(
    packageJson.scripts['test:joint-gate:manifest'],
    'node --test scripts/joint-gate-manifest.test.mjs',
  );
  assert.equal(
    packageJson.scripts['test:joint-gate:plan'],
    'node scripts/run-joint-gate.mjs --plan',
  );
  assert.equal(
    packageJson.scripts['test:joint-gate:full'],
    'node scripts/run-joint-gate.mjs --full',
  );
});

test('--full remains blocked on unfinished required slices even with external URLs present', () => {
  const result = runRunner(['--full'], {
    CONTROL_API_TEST_DATABASE_URL:
      'postgres://videoagent:do-not-print@127.0.0.1:54329/videoagent_control_test',
    JOINT_GATE_B_BASELINE_COMMIT: 'b-owned-clean-baseline',
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /PILOT_BROWSER_E2E_NOT_IMPLEMENTED/);
  assert.match(`${result.stdout}\n${result.stderr}`, /AB_GOLDEN_PATH_NOT_IMPLEMENTED/);
  assert.match(`${result.stdout}\n${result.stderr}`, /MIGRATION_ROLLBACK_GATE_NOT_IMPLEMENTED/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /do-not-print/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /JOINT_GATE_PASS/);
});

test('--full fails closed before tests when the dedicated PostgreSQL URL is missing', () => {
  const result = runRunner(['--full']);
  assert.notEqual(result.status, 0, 'full Gate unexpectedly passed without PostgreSQL');
  assert.match(`${result.stdout}\n${result.stderr}`, /BLOCKED/);
  assert.match(`${result.stdout}\n${result.stderr}`, /CONTROL_API_TEST_DATABASE_URL_REQUIRED/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /provider-secret-must-not-appear/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /JOINT_GATE_PASS/);
});
