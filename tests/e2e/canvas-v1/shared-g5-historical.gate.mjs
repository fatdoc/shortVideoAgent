import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const verifiedDepsRoot = process.env.CANVAS_V1_VERIFIED_DEPS_ROOT;
const dependencyRoots = [rootDir, verifiedDepsRoot].filter(Boolean);
const vitestCli = dependencyRoots
  .map((dependencyRoot) => path.join(dependencyRoot, 'node_modules/vitest/vitest.mjs'))
  .find((candidate) => fs.existsSync(candidate));
assert.ok(vitestCli, 'ENVIRONMENT_FAILURE missing Vitest runtime');

const policy = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'tests/e2e/canvas-v1/shared-g5-policy.fixture.json'), 'utf8'),
);
const productPresent = policy.publicSurfaces.every(({ path: relativePath }) =>
  fs.existsSync(path.join(rootDir, relativePath)),
);

test('historical Shared matrix is exact four RED before product and all GREEN only with real product', () => {
  const resultPath = path.join(os.tmpdir(), `cv6-shared-historical-${process.pid}.json`);
  try {
    const result = spawnSync(
      process.execPath,
      [
        vitestCli,
        'run',
        'src/services/pilotStoryCanvasBridge.test.ts',
        'src/app/Router.pilot.test.tsx',
        'src/config/pilotE2eProxy.test.ts',
        '--testTimeout=20000',
        '--reporter=json',
        `--outputFile=${resultPath}`,
      ],
      {
        cwd: rootDir,
        env: { ...process.env, NODE_OPTIONS: '' },
        encoding: 'utf8',
        shell: false,
      },
    );
    assert.equal(result.error, undefined, result.error?.message);
    const report = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    assert.equal(report.numPendingTests, 0);
    assert.equal(report.numTodoTests, 0);

    const assertions = report.testResults.flatMap(({ assertionResults }) => assertionResults);
    for (const historical of policy.historicalRed) {
      assert.ok(
        assertions.some(({ fullName }) => fullName.endsWith(historical.title)),
        `historical test missing: ${historical.title}`,
      );
    }

    if (productPresent) {
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(report.numFailedTests, 0);
      assert.equal(report.numPassedTests, report.numTotalTests);
      process.stdout.write('HISTORICAL_SHARED_GREEN_ATTESTED\n');
      return;
    }

    assert.equal(result.status, 1);
    assert.equal(report.numTotalTests, 37);
    assert.equal(report.numPassedTests, 33);
    assert.equal(report.numFailedTests, 4);
    const failedTitles = assertions
      .filter(({ status }) => status === 'failed')
      .map(({ fullName }) => fullName)
      .sort();
    assert.deepEqual(
      failedTitles,
      policy.historicalRed
        .map(({ title }) => title)
        .sort()
        .map((title) => assertions.find(({ fullName }) => fullName.endsWith(title)).fullName)
        .sort(),
    );
    process.stdout.write('HISTORICAL_SHARED_EXPECTED_RED_ATTESTED 33_PASS_4_RED\n');
  } finally {
    fs.rmSync(resultPath, { force: true });
  }
});
