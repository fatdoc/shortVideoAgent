import assert from 'node:assert/strict';
import test from 'node:test';

import { validateSynchronizedGitCommit } from './joint-gate-preconditions.mjs';

const repositoryRoot = '/workspace/shortVideoAgent';
const synchronizedCommit = 'a7f8021b80f540c69e4c45718b335ba2c0fca539';

function createGitProbe(statuses) {
  const calls = [];
  const spawnSyncImpl = (executable, args, options) => {
    calls.push({ executable, args, options });
    const status = statuses.shift();
    if (status instanceof Error) throw status;
    return { status };
  };
  return { calls, spawnSyncImpl };
}

function assertSafeResult(result) {
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, new RegExp(synchronizedCommit, 'i'));
  assert.doesNotMatch(serialized, /baseline-secret|fatal:|stack/i);
}

test('requires a full Git commit attestation without invoking Git', () => {
  for (const [value, expectedCode] of [
    [undefined, 'JOINT_GATE_B_BASELINE_ATTESTATION_REQUIRED'],
    ['', 'JOINT_GATE_B_BASELINE_ATTESTATION_REQUIRED'],
    ['a7f8021', 'JOINT_GATE_B_BASELINE_COMMIT_INVALID'],
    ['z'.repeat(40), 'JOINT_GATE_B_BASELINE_COMMIT_INVALID'],
  ]) {
    const probe = createGitProbe([]);
    const result = validateSynchronizedGitCommit(value, {
      repositoryRoot,
      spawnSyncImpl: probe.spawnSyncImpl,
    });

    assert.deepEqual(result, { ok: false, code: expectedCode });
    assert.equal(probe.calls.length, 0);
    assertSafeResult(result);
  }
});

test('accepts a synchronized commit through shell-free Git probes', () => {
  const probe = createGitProbe([0, 0]);

  const result = validateSynchronizedGitCommit(synchronizedCommit, {
    repositoryRoot,
    spawnSyncImpl: probe.spawnSyncImpl,
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(
    probe.calls.map(({ executable, args }) => ({ executable, args })),
    [
      {
        executable: 'git',
        args: ['cat-file', '-e', `${synchronizedCommit}^{commit}`],
      },
      {
        executable: 'git',
        args: ['merge-base', '--is-ancestor', synchronizedCommit, 'HEAD'],
      },
    ],
  );
  for (const call of probe.calls) {
    assert.equal(call.options.cwd, repositoryRoot);
    assert.equal(call.options.shell, false);
    assert.equal(call.options.stdio, 'ignore');
  }
  assertSafeResult(result);
});

test('rejects values that do not resolve to a commit object', () => {
  const probe = createGitProbe([128]);

  const result = validateSynchronizedGitCommit(synchronizedCommit, {
    repositoryRoot,
    spawnSyncImpl: probe.spawnSyncImpl,
  });

  assert.deepEqual(result, { ok: false, code: 'JOINT_GATE_B_BASELINE_COMMIT_INVALID' });
  assert.equal(probe.calls.length, 1);
  assertSafeResult(result);
});

test('distinguishes a valid non-ancestor from an invalid Git probe', () => {
  for (const [ancestorStatus, expectedCode] of [
    [1, 'JOINT_GATE_B_BASELINE_COMMIT_NOT_ANCESTOR'],
    [128, 'JOINT_GATE_B_BASELINE_COMMIT_INVALID'],
    [null, 'JOINT_GATE_B_BASELINE_COMMIT_INVALID'],
  ]) {
    const probe = createGitProbe([0, ancestorStatus]);
    const result = validateSynchronizedGitCommit(synchronizedCommit, {
      repositoryRoot,
      spawnSyncImpl: probe.spawnSyncImpl,
    });

    assert.deepEqual(result, { ok: false, code: expectedCode });
    assert.equal(probe.calls.length, 2);
    assertSafeResult(result);
  }
});

test('fails closed when Git probing throws without exposing the commit or error', () => {
  for (const statuses of [
    [new Error(`fatal: baseline-secret ${synchronizedCommit}`)],
    [0, new Error(`stack baseline-secret ${synchronizedCommit}`)],
  ]) {
    const probe = createGitProbe(statuses);
    const result = validateSynchronizedGitCommit(synchronizedCommit, {
      repositoryRoot,
      spawnSyncImpl: probe.spawnSyncImpl,
    });

    assert.deepEqual(result, { ok: false, code: 'JOINT_GATE_B_BASELINE_COMMIT_INVALID' });
    assertSafeResult(result);
  }
});
