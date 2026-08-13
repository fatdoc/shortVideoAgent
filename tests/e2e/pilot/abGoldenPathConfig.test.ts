import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const TSX_BINARY = fileURLToPath(
  new URL('../../../apps/control-api/node_modules/.bin/tsx', import.meta.url),
);
const CONFIG_URL = new URL('../../../playwright.pilot-ab-golden-path.config.ts', import.meta.url)
  .href;
const SAFE_WEB_ORIGIN = 'http://127.0.0.1:4174';
const SAFE_JSON_OUTPUT = 'test-results/pilot-ab-golden-path/report.json';
const SAFE_OUTPUT_DIR = 'test-results/pilot-ab-golden-path/artifacts';

function loadConfig(
  overrides: NodeJS.ProcessEnv = {},
): ReturnType<typeof spawnSync> & { stdout: string; stderr: string } {
  const script = `
    void (async () => {
      const loaded = await import(${JSON.stringify(CONFIG_URL)});
      const config = loaded.default;
      const project = config.projects?.[0];
      process.stdout.write(JSON.stringify({
        testDir: config.testDir,
        testMatch: config.testMatch,
        fullyParallel: config.fullyParallel,
        workers: config.workers,
        forbidOnly: config.forbidOnly,
        retries: config.retries,
        reporter: config.reporter,
        outputDir: config.outputDir,
        use: config.use,
        projectName: project?.name,
        projectUse: project?.use,
      }));
    })();
  `;

  const result = spawnSync(TSX_BINARY, ['--eval', script], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      PILOT_E2E: 'true',
      PILOT_E2E_AB_GOLDEN_PATH: 'true',
      PILOT_E2E_BROWSER_CHANNEL: 'chrome',
      PILOT_E2E_WEB_ORIGIN: SAFE_WEB_ORIGIN,
      ...overrides,
    },
  });

  return result as ReturnType<typeof spawnSync> & { stdout: string; stderr: string };
}

function assertRejected(
  overrides: NodeJS.ProcessEnv,
  expectedCode: string,
  forbiddenOutput: readonly string[] = [],
): void {
  const result = loadConfig(overrides);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0);
  assert.match(output, new RegExp(expectedCode));
  for (const forbidden of forbiddenOutput) {
    assert.doesNotMatch(output, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
}

test('fails closed unless Pilot, Golden Path, and real Chrome are explicitly enabled', () => {
  const cases: Array<[NodeJS.ProcessEnv, string]> = [
    [{ PILOT_E2E: undefined }, 'PILOT_E2E_MODE_REQUIRED'],
    [{ PILOT_E2E: 'false' }, 'PILOT_E2E_MODE_REQUIRED'],
    [{ PILOT_E2E_AB_GOLDEN_PATH: undefined }, 'AB_GOLDEN_PATH_MODE_REQUIRED'],
    [{ PILOT_E2E_AB_GOLDEN_PATH: 'false' }, 'AB_GOLDEN_PATH_MODE_REQUIRED'],
    [{ PILOT_E2E_BROWSER_CHANNEL: undefined }, 'PILOT_E2E_BROWSER_CHANNEL_REQUIRED'],
    [{ PILOT_E2E_BROWSER_CHANNEL: 'chromium' }, 'PILOT_E2E_BROWSER_CHANNEL_INVALID'],
  ];

  for (const [overrides, expectedCode] of cases) {
    assertRejected(overrides, expectedCode);
  }
});

test('requires a loopback-only Pilot web origin', () => {
  assertRejected({ PILOT_E2E_WEB_ORIGIN: undefined }, 'PILOT_E2E_WEB_ORIGIN_REQUIRED');

  const invalidOrigins = [
    'http://127.0.0.1:0',
    'http://127.0.0.1:65536',
    'http://127.0.0.1:99999',
    'http://127.0.0.1:not-a-port',
    'http://pilot:secret@127.0.0.1:4174',
    'http://127.0.0.1:4174/canvas',
    'http://127.0.0.1:4174/?mode=pilot',
    'http://127.0.0.1:4174/#canvas',
    'http://localhost:4174',
    'http://127.0.0.2:4174',
    'https://127.0.0.1:4174',
  ] as const;

  for (const origin of invalidOrigins) {
    assertRejected({ PILOT_E2E_WEB_ORIGIN: origin }, 'PILOT_E2E_WEB_ORIGIN_INVALID', [origin]);
  }
});

test('accepts the full explicit loopback port range and normalizes the root path', () => {
  const cases = [
    ['http://127.0.0.1:1', 'http://127.0.0.1:1'],
    ['http://127.0.0.1:4174/', 'http://127.0.0.1:4174'],
    ['http://127.0.0.1:65535', 'http://127.0.0.1:65535'],
  ] as const;

  for (const [origin, expectedBaseUrl] of cases) {
    const result = loadConfig({ PILOT_E2E_WEB_ORIGIN: origin });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const config = JSON.parse(result.stdout) as { use: { baseURL: string } };
    assert.equal(config.use.baseURL, expectedBaseUrl);
  }
});

test('freezes a dedicated, serial, zero-retry Golden Path Playwright contract', () => {
  const result = loadConfig();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const config = JSON.parse(result.stdout) as {
    testDir: string;
    testMatch: string;
    fullyParallel: boolean;
    workers: number;
    forbidOnly: boolean;
    retries: number;
    reporter: Array<[string, Record<string, unknown>?]>;
    outputDir: string;
    use: Record<string, unknown>;
    projectName: string;
    projectUse: Record<string, unknown>;
  };

  assert.match(config.testDir, /tests\/e2e\/pilot\/browser$/);
  assert.equal(config.testMatch, 'ab-golden-path.spec.ts');
  assert.equal(config.fullyParallel, false);
  assert.equal(config.workers, 1);
  assert.equal(config.forbidOnly, true);
  assert.equal(config.retries, 0);
  assert.deepEqual(config.reporter, [['line'], ['json', { outputFile: SAFE_JSON_OUTPUT }]]);
  assert.equal(config.outputDir, SAFE_OUTPUT_DIR);
  assert.equal(config.use.baseURL, SAFE_WEB_ORIGIN);
  assert.equal(config.use.trace, 'off');
  assert.equal(config.use.video, 'off');
  assert.equal(config.use.screenshot, 'only-on-failure');
  assert.equal(config.projectName, 'pilot-ab-golden-path-chrome');
  assert.equal(config.projectUse.channel, 'chrome');
});
