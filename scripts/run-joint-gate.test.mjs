import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCommandEnvironment, buildSanitizedEnvironment } from './run-joint-gate.mjs';

test('command environment is merged into a sanitized base without mutating sibling phases', () => {
  const sourceEnvironment = {
    HOME: '/tmp/joint-gate-home',
    NODE_ENV: 'development',
    PILOT_E2E: 'false',
    PILOT_E2E_BROWSER_CHANNEL: 'chromium',
    PILOT_E2E_AB_GOLDEN_PATH: 'caller-must-not-pollute-sibling-phases',
    ARK_API_KEY: 'must-be-cleared',
    BYTEPLUS_TTS_ACCESS_TOKEN: 'must-be-cleared',
    BYTEPLUS_TTS_APP_ID: 'must-be-cleared',
  };
  const baseEnvironment = buildSanitizedEnvironment(sourceEnvironment);
  const goldenPathCommand = {
    environment: {
      PILOT_E2E_AB_GOLDEN_PATH: 'true',
    },
  };

  const goldenPathEnvironment = buildCommandEnvironment(baseEnvironment, goldenPathCommand);
  const siblingEnvironment = buildCommandEnvironment(baseEnvironment, {});

  assert.equal(baseEnvironment.NODE_ENV, 'test');
  assert.equal(baseEnvironment.PILOT_E2E, 'true');
  assert.equal(baseEnvironment.PILOT_E2E_BROWSER_CHANNEL, 'chrome');
  assert.equal(baseEnvironment.ARK_API_KEY, '');
  assert.equal(baseEnvironment.BYTEPLUS_TTS_ACCESS_TOKEN, '');
  assert.equal(baseEnvironment.BYTEPLUS_TTS_APP_ID, '');
  assert.equal(baseEnvironment.PILOT_E2E_AB_GOLDEN_PATH, undefined);

  assert.equal(goldenPathEnvironment.PILOT_E2E_AB_GOLDEN_PATH, 'true');
  assert.equal(siblingEnvironment.PILOT_E2E_AB_GOLDEN_PATH, undefined);
  assert.deepEqual(baseEnvironment, buildSanitizedEnvironment(sourceEnvironment));
  assert.notEqual(goldenPathEnvironment, baseEnvironment);
  assert.notEqual(siblingEnvironment, baseEnvironment);
});
