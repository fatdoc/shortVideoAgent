import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repositoryRoot = process.cwd();
const runnerPath = path.join(repositoryRoot, 'scripts/run-control-api-migration-gate.mjs');
const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;

function sensitiveFragments(value) {
  if (!value) return [];
  const parsed = new URL(value);
  return [value, parsed.username, parsed.password, parsed.search.slice(1)].filter(Boolean);
}

test('fresh database migrates, rolls back one batch, reapplies deterministically, and cleans up', () => {
  assert.ok(databaseUrl, 'CONTROL_API_TEST_DATABASE_URL_REQUIRED');

  const result = spawnSync(process.execPath, [runnerPath], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PILOT_E2E: 'true',
      CONTROL_API_TEST_DATABASE_URL: databaseUrl,
      DATABASE_URL: '',
      ARK_API_KEY: 'provider-secret-must-not-appear',
      BYTEPLUS_TTS_ACCESS_TOKEN: 'provider-secret-must-not-appear',
      BYTEPLUS_TTS_APP_ID: 'provider-secret-must-not-appear',
    },
  });
  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(result.status, 0, output);
  assert.match(output, /RUNNING_MIGRATION_GATE database=[a-zA-Z0-9_-]+ host=(loopback|remote)/);
  assert.match(output, /MIGRATION_GATE_RESET_PASS/);
  assert.match(output, /MIGRATION_GATE_FORWARD_PASS batch=1 count=19/);
  assert.match(output, /MIGRATION_GATE_REPLAY_PASS batch=1 count=0/);
  assert.match(output, /MIGRATION_GATE_ROLLBACK_PASS batch=1 count=19/);
  assert.match(output, /MIGRATION_GATE_ROLLBACK_EMPTY_PASS/);
  assert.match(output, /MIGRATION_GATE_REAPPLY_PASS batch=1 count=19/);
  assert.match(output, /MIGRATION_GATE_FINGERPRINT_PASS/);
  assert.match(output, /MIGRATION_GATE_CLEANUP_PASS/);
  assert.match(output, /MIGRATION_ROLLBACK_REAPPLY_PASS/);
  assert.doesNotMatch(output, /MIGRATION_GATE_IMPLEMENTATION_PENDING/);
  assert.doesNotMatch(output, /provider-secret-must-not-appear/);
  assert.doesNotMatch(output, /001_pilot_core|019_harden_legacy_membership_shadow/);
  for (const fragment of sensitiveFragments(databaseUrl)) {
    assert.doesNotMatch(output, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
