import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repositoryRoot = process.cwd();
const runnerPath = path.join(repositoryRoot, 'scripts/run-control-api-migration-gate.mjs');
const secretUrl =
  'postgres://migration_gate_user:migration-gate-super-secret@127.0.0.1:5432/videoagent_control_test?application_name=secret-query';

function runRunner(environment = {}) {
  return spawnSync(process.execPath, [runnerPath], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PILOT_E2E: '',
      CONTROL_API_TEST_DATABASE_URL: '',
      DATABASE_URL: '',
      ARK_API_KEY: 'provider-secret-must-not-appear',
      BYTEPLUS_TTS_ACCESS_TOKEN: 'provider-secret-must-not-appear',
      BYTEPLUS_TTS_APP_ID: 'provider-secret-must-not-appear',
      ...environment,
    },
  });
}

function outputOf(result) {
  return `${result.stdout}\n${result.stderr}`;
}

function assertRejectedBeforeDestructiveStage(result, reasonCode) {
  const output = outputOf(result);
  assert.notEqual(result.status, 0);
  assert.match(output, /MIGRATION_GATE_ENVIRONMENT_REJECTED/);
  assert.match(output, new RegExp(reasonCode));
  assert.doesNotMatch(output, /RUNNING_MIGRATION_GATE/);
  assert.doesNotMatch(output, /MIGRATION_ROLLBACK_REAPPLY_PASS/);
  assert.doesNotMatch(output, /migration-gate-super-secret/);
  assert.doesNotMatch(output, /migration_gate_user/);
  assert.doesNotMatch(output, /secret-query/);
  assert.doesNotMatch(output, /provider-secret-must-not-appear/);
}

test('rejects missing Pilot E2E mode before any destructive migration stage', () => {
  const result = runRunner({ CONTROL_API_TEST_DATABASE_URL: secretUrl });

  assertRejectedBeforeDestructiveStage(result, 'PILOT_E2E_MODE_REQUIRED');
});

test('rejects a missing dedicated URL and never falls back to DATABASE_URL', () => {
  const result = runRunner({
    PILOT_E2E: 'true',
    DATABASE_URL: secretUrl,
  });

  assertRejectedBeforeDestructiveStage(result, 'PILOT_E2E_DATABASE_URL_REQUIRED');
});

test('rejects invalid, non-PostgreSQL, non-test, and development database URLs', async (t) => {
  const cases = [
    ['not-a-url-migration-gate-super-secret', 'PILOT_E2E_DATABASE_URL_INVALID'],
    [
      'mysql://migration_gate_user:migration-gate-super-secret@localhost/control_test',
      'PILOT_E2E_DATABASE_PROTOCOL_INVALID',
    ],
    [
      'postgres://migration_gate_user:migration-gate-super-secret@localhost/control',
      'PILOT_E2E_DATABASE_NOT_DEDICATED',
    ],
    [
      'postgres://migration_gate_user:migration-gate-super-secret@localhost/videoagent_control',
      'PILOT_E2E_DATABASE_NOT_DEDICATED',
    ],
  ];

  for (const [databaseUrl, reasonCode] of cases) {
    await t.test(reasonCode, () => {
      const result = runRunner({
        PILOT_E2E: 'true',
        CONTROL_API_TEST_DATABASE_URL: databaseUrl,
      });

      assertRejectedBeforeDestructiveStage(result, reasonCode);
    });
  }
});

test('accepts only the environment boundary but remains fail closed until the database gate exists', () => {
  const result = runRunner({
    PILOT_E2E: 'true',
    CONTROL_API_TEST_DATABASE_URL: secretUrl,
  });
  const output = outputOf(result);

  assert.notEqual(result.status, 0);
  assert.match(output, /MIGRATION_GATE_IMPLEMENTATION_PENDING/);
  assert.doesNotMatch(output, /MIGRATION_GATE_ENVIRONMENT_REJECTED/);
  assert.doesNotMatch(output, /RUNNING_MIGRATION_GATE/);
  assert.doesNotMatch(output, /MIGRATION_ROLLBACK_REAPPLY_PASS/);
  assert.doesNotMatch(output, /migration-gate-super-secret/);
  assert.doesNotMatch(output, /migration_gate_user/);
  assert.doesNotMatch(output, /secret-query/);
});
