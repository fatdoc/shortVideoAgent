import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertPilotBrowserArtifactsSafe } from './pilotArtifactSecurity.js';

test('accepts absent, empty, and secret-free Pilot browser artifact directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pilot-artifact-safe-'));
  try {
    await assert.doesNotReject(
      assertPilotBrowserArtifactsSafe(join(root, 'missing'), ['browser-secret-value']),
    );
    await mkdir(join(root, 'nested'));
    await writeFile(join(root, 'nested', 'test-finished-1.png'), Buffer.from([137, 80, 78, 71]));
    await assert.doesNotReject(assertPilotBrowserArtifactsSafe(root, ['browser-secret-value']));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects textual secret residue without echoing the secret or artifact path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pilot-artifact-secret-'));
  const secret = 'browser-secret-value';
  try {
    await writeFile(join(root, 'failure.txt'), `safe prefix ${secret} safe suffix`);
    await assert.rejects(assertPilotBrowserArtifactsSafe(root, [secret]), (error: Error) => {
      assert.equal(error.message, 'PILOT_E2E_ARTIFACT_SECRET_LEAK');
      assert.doesNotMatch(error.message, new RegExp(secret));
      assert.doesNotMatch(error.message, /failure\.txt/);
      return true;
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects trace, HAR, and video captures that can retain request or DOM secrets', async () => {
  for (const extension of ['zip', 'har', 'webm']) {
    const root = await mkdtemp(join(tmpdir(), 'pilot-artifact-capture-'));
    try {
      await writeFile(join(root, `capture.${extension}`), 'safe');
      await assert.rejects(
        assertPilotBrowserArtifactsSafe(root, []),
        /PILOT_E2E_ARTIFACT_CAPTURE_FORBIDDEN/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});
