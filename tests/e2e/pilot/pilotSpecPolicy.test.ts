import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPilotSpecPolicy } from './pilotSpecPolicy.js';

function assertSafePolicyError(source: unknown, code: string, forbidden?: string): void {
  assert.throws(
    () => assertPilotSpecPolicy(source),
    (error: Error) => {
      assert.equal(error.message, code);
      if (forbidden) assert.doesNotMatch(error.message, new RegExp(forbidden));
      return true;
    },
  );
}

test('accepts ordinary Playwright test and describe registrations', () => {
  assert.doesNotThrow(() =>
    assertPilotSpecPolicy(`
      import { test, expect } from '@playwright/test';
      test.describe('Golden Path', () => {
        test('completes the workflow', async ({ page }) => {
          await page.goto('/pilot/canvas');
          await expect(page.getByRole('heading')).toBeVisible();
        });
      });
    `),
  );

  assert.doesNotThrow(() =>
    assertPilotSpecPolicy(`
      import { test } from '@playwright/test';
      test('runs a direct spec', async () => {
        await Promise.resolve();
      });
    `),
  );
});

test('rejects focused test and describe declarations', () => {
  for (const source of [
    `test.only('focused', async () => {});`,
    `test . only ('focused', async () => {});`,
    `describe.only('focused suite', () => { test('case', () => {}); });`,
    `test.describe.only('focused suite', () => { test('case', () => {}); });`,
    `describe\n.\nonly('focused suite', () => { test('case', () => {}); });`,
  ]) {
    assertSafePolicyError(source, 'PILOT_E2E_SPEC_FOCUSED_FORBIDDEN');
  }
});

test('rejects static and conditional skip declarations', () => {
  for (const source of [
    `test.skip('disabled', async () => {});`,
    `describe.skip('disabled suite', () => { test('case', () => {}); });`,
    `test.describe.skip('disabled suite', () => { test('case', () => {}); });`,
    `test('conditional', async () => { test.skip(process.env.CI !== 'true', 'CI only'); });`,
    `test('conditional', async () => { test\n.\nskip(!featureReady, 'not ready'); });`,
  ]) {
    assertSafePolicyError(source, 'PILOT_E2E_SPEC_SKIP_FORBIDDEN');
  }
});

test('rejects fixme declarations', () => {
  for (const source of [
    `test.fixme('unfinished', async () => {});`,
    `test('unfinished', async () => { test.fixme(isBlocked, 'blocked'); });`,
  ]) {
    assertSafePolicyError(source, 'PILOT_E2E_SPEC_FIXME_FORBIDDEN');
  }
});

test('rejects missing, empty, oversized, and obvious no-op sources', () => {
  for (const source of [
    undefined,
    null,
    '',
    '   ',
    '// comment only\n/* no test */',
    'export {};',
  ]) {
    assertSafePolicyError(
      source,
      source === undefined || source === null || source === '' || source === '   '
        ? 'PILOT_E2E_SPEC_SOURCE_REQUIRED'
        : 'PILOT_E2E_SPEC_NO_TESTS',
    );
  }

  assertSafePolicyError(
    `test('bounded', () => {});${' '.repeat(256 * 1024)}`,
    'PILOT_E2E_SPEC_SOURCE_TOO_LARGE',
  );
});

test('ignores policy words in comments and string literals', () => {
  assert.doesNotThrow(() =>
    assertPilotSpecPolicy(`
      import { test } from '@playwright/test';
      // test.only('commented out', () => {});
      /* describe.skip('commented out', () => {}); */
      test('documents policy names', async () => {
        const names = 'test.skip describe.only test.fixme';
        await Promise.resolve(names);
      });
    `),
  );
});

test('never echoes source text or a caller path in validation errors', () => {
  const secret = 'FAKE_SPEC_SECRET_DO_NOT_USE_20260811';
  const callerPath = '/private/tmp/fake-golden-path-spec.ts';
  const source = `// ${secret}\n// ${callerPath}\ntest.only('focused', async () => {});`;

  assertSafePolicyError(source, 'PILOT_E2E_SPEC_FOCUSED_FORBIDDEN', secret);
  assertSafePolicyError(source, 'PILOT_E2E_SPEC_FOCUSED_FORBIDDEN', 'fake-golden-path-spec');
});
