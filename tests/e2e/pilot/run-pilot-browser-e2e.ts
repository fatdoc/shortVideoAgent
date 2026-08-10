import { randomBytes } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { parsePilotE2eEnvironment } from '../../../apps/control-api/src/e2e/environment.js';
import { resetMigrateSeedPilotE2e } from '../../../apps/control-api/src/e2e/resetSeed.js';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const controlApiRoot = resolve(repositoryRoot, 'apps/control-api');
const controlApiTsx = resolve(controlApiRoot, 'node_modules/.bin/tsx');
const vite = resolve(repositoryRoot, 'node_modules/.bin/vite');
const playwright = resolve(repositoryRoot, 'node_modules/.bin/playwright');

function secret(): string {
  return randomBytes(48).toString('base64url');
}

function spawnProcess(
  command: string,
  args: string[],
  cwd: string,
  environment: NodeJS.ProcessEnv,
): ChildProcess {
  return spawn(command, args, {
    cwd,
    env: environment,
    stdio: 'inherit',
  });
}

async function waitForUrl(url: string, process: ChildProcess, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) throw new Error('PILOT_E2E_CHILD_EXITED');
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) return;
    } catch {
      // Retry until the bounded deadline; no response detail is logged.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error('PILOT_E2E_CHILD_NOT_READY');
}

async function stop(process: ChildProcess | undefined): Promise<void> {
  if (!process || process.exitCode !== null) return;
  await new Promise<void>((resolveStop) => {
    const timeout = setTimeout(() => {
      process.kill('SIGKILL');
      resolveStop();
    }, 5_000);
    process.once('exit', () => {
      clearTimeout(timeout);
      resolveStop();
    });
    process.kill('SIGTERM');
  });
}

async function main(): Promise<void> {
  const runtimeEnvironment = parsePilotE2eEnvironment(process.env);
  const seeded = await resetMigrateSeedPilotE2e(process.env);
  const controlApiOrigin = seeded.environment.controlApiOrigin;
  const webOrigin = seeded.environment.webOrigin;
  const shared = { ...process.env, PILOT_E2E: 'true' };
  const independentSecrets = {
    SESSION_SECRET: secret(),
    PROJECT_GRANT_SIGNING_SECRET: secret(),
    PRODUCTION_PLANE_INTERNAL_TOKEN: secret(),
    REGISTRATION_IDEMPOTENCY_SECRET: secret(),
    RECHARGE_PAYMENT_DIGEST_SECRET: secret(),
    TEST_PAYMENT_INTERNAL_TOKEN: secret(),
  };

  let controlApi: ChildProcess | undefined;
  let web: ChildProcess | undefined;
  let browser: ChildProcess | undefined;
  const shutdown = async () => {
    await stop(browser);
    await stop(web);
    await stop(controlApi);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());

  try {
    controlApi = spawnProcess(controlApiTsx, ['src/server.ts'], controlApiRoot, {
      ...shared,
      ...independentSecrets,
      NODE_ENV: 'test',
      DATABASE_URL: runtimeEnvironment.databaseUrl,
      DATABASE_SSL: 'disable',
      CONTROL_API_HOST: runtimeEnvironment.controlApiHost,
      CONTROL_API_PORT: String(runtimeEnvironment.controlApiPort),
      PROJECT_GRANT_ACTIVE_KID: 'pilot-e2e-kid',
      PILOT_E2E_EMAIL_VERIFICATION_TOKEN: seeded.secrets.emailVerificationToken,
      APP_VERSION: 'pilot-e2e',
    });
    await waitForUrl(`${controlApiOrigin}/health/ready`, controlApi);

    web = spawnProcess(
      vite,
      [
        '--host',
        runtimeEnvironment.webHost,
        '--port',
        String(runtimeEnvironment.webPort),
        '--mode',
        'test',
      ],
      repositoryRoot,
      {
        ...shared,
        VITE_APP_MODE: 'pilot',
        VITE_CONTROL_API_BASE_URL: webOrigin,
        VITE_PILOT_E2E: 'true',
        PILOT_E2E_CONTROL_API_PORT: String(runtimeEnvironment.controlApiPort),
      },
    );
    await waitForUrl(`${webOrigin}/login`, web);

    browser = spawnProcess(
      playwright,
      ['test', '--config=playwright.pilot.config.ts'],
      repositoryRoot,
      {
        ...shared,
        PILOT_E2E_WEB_ORIGIN: webOrigin,
        PILOT_E2E_EMAIL_VERIFICATION_TOKEN: seeded.secrets.emailVerificationToken,
        PILOT_E2E_CREDENTIALS_JSON: JSON.stringify(seeded.secrets.accounts),
        PILOT_E2E_INVITATION_TOKENS_JSON: JSON.stringify(seeded.secrets.invitationTokens),
      },
    );
    const exitCode = await new Promise<number>((resolveExit, rejectExit) => {
      browser.once('error', rejectExit);
      browser.once('exit', (code, signal) => {
        if (signal) rejectExit(new Error('PILOT_E2E_BROWSER_TERMINATED'));
        else resolveExit(code ?? 1);
      });
    });
    if (exitCode !== 0) throw new Error('PILOT_E2E_BROWSER_FAILED');
  } finally {
    await shutdown();
  }
}

try {
  await main();
} catch (error) {
  const code = error instanceof Error ? error.message : 'PILOT_E2E_RUNTIME_FAILED';
  console.error(JSON.stringify({ event: 'pilot_e2e_runtime_failed', code }));
  process.exitCode = 1;
}
