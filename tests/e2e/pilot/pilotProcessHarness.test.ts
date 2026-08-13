import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import {
  PilotProcessHarness,
  type PilotManagedProcess,
  type PilotProcessSpec,
} from './pilotProcessHarness.js';

const TEST_TIMEOUT_MS = 5_000;
const execFileAsync = promisify(execFile);

function nodeProcess(source: string, overrides: Partial<PilotProcessSpec> = {}): PilotProcessSpec {
  return {
    command: process.execPath,
    args: ['-e', source],
    cwd: process.cwd(),
    env: { PILOT_PROCESS_FIXTURE: 'safe-fixture-value' },
    readinessProbe: async () => true,
    readinessTimeoutMs: 1_000,
    readinessIntervalMs: 10,
    outputLimitBytes: 1_024,
    stopTimeoutMs: 100,
    ...overrides,
  };
}

async function readWhenPresent(path: string, timeoutMs = 1_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      return await readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('TEST_FIXTURE_OUTPUT_MISSING');
}

function assertFixedCode(
  error: Error,
  expected: string,
  forbidden: readonly string[] = [],
): boolean {
  assert.equal(error.message, expected);
  for (const value of forbidden) assert.doesNotMatch(error.message, new RegExp(value));
  assert.doesNotMatch(error.message, /Error:|\bat\s+.*:\d+:\d+/);
  return true;
}

test(
  'spawns with explicit command arguments cwd and environment without shell interpretation',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    const harness = new PilotProcessHarness();
    const source = `process.stdout.write(JSON.stringify({cwd:process.cwd(),fixture:process.env.PILOT_PROCESS_FIXTURE,arg:process.argv[1]})); setInterval(()=>{},1000);`;
    const child = await harness.start(
      nodeProcess(source, {
        args: ['-e', source, '$(printf shell-expanded)'],
        readinessProbe: (process) => process.output().stdout.endsWith('}'),
      }),
    );

    try {
      const payload = JSON.parse(child.output().stdout) as {
        cwd: string;
        fixture: string;
        arg: string;
      };
      assert.equal(payload.cwd, process.cwd());
      assert.equal(payload.fixture, 'safe-fixture-value');
      assert.equal(payload.arg, '$(printf shell-expanded)');
    } finally {
      await harness.stop();
    }
  },
);

test(
  'captures bounded stdout and stderr and stops accumulating after the byte limit',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    const harness = new PilotProcessHarness();
    const child = await harness.start(
      nodeProcess(
        `process.stdout.write('A'.repeat(128)); process.stderr.write('B'.repeat(128)); setInterval(()=>{},1000);`,
        {
          outputLimitBytes: 16,
          readinessProbe: (process) => {
            const output = process.output();
            return output.stdoutTruncated && output.stderrTruncated;
          },
        },
      ),
    );

    try {
      const output = child.output();
      assert.equal(Buffer.byteLength(output.stdout), 16);
      assert.equal(Buffer.byteLength(output.stderr), 16);
      assert.equal(output.stdout, 'A'.repeat(16));
      assert.equal(output.stderr, 'B'.repeat(16));
      assert.equal(output.stdoutTruncated, true);
      assert.equal(output.stderrTruncated, true);
    } finally {
      await harness.stop();
    }
  },
);

test(
  'uses an injected readiness probe and times out with a fixed non-leaking code',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    const harness = new PilotProcessHarness();
    const forbidden = ['FAKE_READINESS_URL_DO_NOT_USE', 'FAKE_SECRET_DO_NOT_USE'];
    let probeCount = 0;

    await assert.rejects(
      harness.start(
        nodeProcess(`setInterval(()=>{},1000);`, {
          readinessProbe: async () => {
            probeCount += 1;
            throw new Error(`${forbidden[0]} ${forbidden[1]}`);
          },
          readinessTimeoutMs: 60,
          readinessIntervalMs: 5,
        }),
      ),
      (error: Error) => assertFixedCode(error, 'PILOT_E2E_CHILD_NOT_READY', forbidden),
    );
    assert.ok(probeCount > 0);
    assert.equal(harness.size, 0);
  },
);

test(
  'reports early child exit with a fixed non-leaking code',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    const harness = new PilotProcessHarness();
    const forbidden = ['FAKE_COMMAND_DO_NOT_USE', 'FAKE_ENV_DO_NOT_USE'];

    await assert.rejects(
      harness.start(
        nodeProcess(`process.exit(7);`, {
          command: process.execPath,
          env: { PILOT_PROCESS_FIXTURE: forbidden[1] },
          readinessProbe: async () => false,
          readinessTimeoutMs: 1_000,
        }),
      ),
      (error: Error) => assertFixedCode(error, 'PILOT_E2E_CHILD_EXITED', forbidden),
    );
    assert.equal(harness.size, 0);
  },
);

test(
  'cleans partially started children in reverse order after a later start fails',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'pilot-process-order-'));
    const shutdownLog = join(root, 'shutdown.log');
    const harness = new PilotProcessHarness();
    const fixture = (label: string) =>
      `const fs=require('node:fs'); process.on('SIGTERM',()=>{fs.appendFileSync(${JSON.stringify(shutdownLog)},${JSON.stringify(`${label}\n`)});process.exit(0)}); process.stdout.write('ready'); setInterval(()=>{},1000);`;

    try {
      await harness.start(
        nodeProcess(fixture('first'), {
          readinessProbe: (process) => process.output().stdout === 'ready',
        }),
      );
      await harness.start(
        nodeProcess(fixture('second'), {
          readinessProbe: (process) => process.output().stdout === 'ready',
        }),
      );
      await assert.rejects(
        harness.start(
          nodeProcess(`process.exit(9);`, {
            readinessProbe: async () => false,
            readinessTimeoutMs: 1_000,
          }),
        ),
        /PILOT_E2E_CHILD_EXITED/,
      );

      assert.equal(await readWhenPresent(shutdownLog), 'second\nfirst\n');
      assert.equal(harness.size, 0);
    } finally {
      await harness.stop();
      await rm(root, { recursive: true, force: true });
    }
  },
);

test('stop is idempotent and sends SIGTERM only once', { timeout: TEST_TIMEOUT_MS }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'pilot-process-idempotent-'));
  const shutdownLog = join(root, 'shutdown.log');
  const harness = new PilotProcessHarness();
  let child: PilotManagedProcess | undefined;

  try {
    child = await harness.start(
      nodeProcess(
        `const fs=require('node:fs'); process.on('SIGTERM',()=>{fs.appendFileSync(${JSON.stringify(shutdownLog)},'term\\n');setTimeout(()=>process.exit(0),20)}); process.stdout.write('ready'); setInterval(()=>{},1000);`,
        { readinessProbe: (process) => process.output().stdout === 'ready' },
      ),
    );
    await Promise.all([child.stop(), child.stop(), harness.stop(), harness.stop()]);
    assert.equal(await readWhenPresent(shutdownLog), 'term\n');
    assert.equal(harness.size, 0);
  } finally {
    await harness.stop();
    await rm(root, { recursive: true, force: true });
  }
});

test(
  'cancels successful readiness and stop timers instead of holding the parent process open',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'pilot-process-timer-cancellation-'));
    const fixturePath = join(root, 'timer-cancellation.mts');
    const harnessModuleUrl = pathToFileURL(
      join(process.cwd(), 'tests/e2e/pilot/pilotProcessHarness.ts'),
    ).href;
    const childSource =
      "process.on('SIGTERM',()=>process.exit(0)); process.stdout.write('ready'); setInterval(()=>{},1000);";

    try {
      await writeFile(
        fixturePath,
        `import { PilotProcessHarness } from ${JSON.stringify(harnessModuleUrl)};
const harness = new PilotProcessHarness();
const child = await harness.start({
  command: process.execPath,
  args: ['-e', ${JSON.stringify(childSource)}],
  cwd: process.cwd(),
  env: {},
  readinessProbe: (managed) => managed.output().stdout === 'ready',
  readinessTimeoutMs: 3_000,
  readinessIntervalMs: 10,
  stopTimeoutMs: 3_000,
});
await child.stop();
process.stdout.write('DONE');
`,
        'utf8',
      );

      const startedAt = Date.now();
      const { stdout, stderr } = await execFileAsync(
        join(process.cwd(), 'apps/control-api/node_modules/.bin/tsx'),
        [fixturePath],
        { cwd: process.cwd(), env: { ...process.env }, timeout: 4_000 },
      );
      const elapsedMs = Date.now() - startedAt;

      assert.equal(stdout, 'DONE');
      assert.equal(stderr, '');
      assert.ok(elapsedMs < 1_500, `expected canceled timers, got ${elapsedMs}ms`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

test(
  'escalates from SIGTERM to SIGKILL after a bounded stop timeout',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    const harness = new PilotProcessHarness();
    const child = await harness.start(
      nodeProcess(
        `process.on('SIGTERM',()=>{}); process.stdout.write('ready'); setInterval(()=>{},1000);`,
        {
          readinessProbe: (process) => process.output().stdout === 'ready',
          stopTimeoutMs: 40,
        },
      ),
    );

    const startedAt = Date.now();
    await child.stop();
    const elapsedMs = Date.now() - startedAt;
    assert.ok(elapsedMs >= 25, `expected bounded SIGTERM wait, got ${elapsedMs}ms`);
    assert.ok(elapsedMs < 1_000, `expected bounded stop, got ${elapsedMs}ms`);
    assert.equal(child.status().signalCode, 'SIGKILL');
    assert.equal(harness.size, 0);
  },
);

test(
  'sanitizes spawn failures without exposing command environment or stack',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    const harness = new PilotProcessHarness();
    const forbidden = ['FAKE_MISSING_COMMAND_DO_NOT_USE', 'FAKE_ENV_SECRET_DO_NOT_USE'];

    await assert.rejects(
      harness.start(
        nodeProcess(`setInterval(()=>{},1000);`, {
          command: join(tmpdir(), forbidden[0]),
          env: { PILOT_PROCESS_FIXTURE: forbidden[1] },
        }),
      ),
      (error: Error) => assertFixedCode(error, 'PILOT_E2E_CHILD_SPAWN_FAILED', forbidden),
    );
    assert.equal(harness.size, 0);
  },
);
