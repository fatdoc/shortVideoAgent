import { spawn, type ChildProcess } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import dotenv from '../../apps/storycanvas/node_modules/dotenv/lib/main.js';

const root = path.resolve(import.meta.dirname, '../..');
const controlRoot = path.join(root, 'apps/control-api');
const storyRoot = path.join(root, 'apps/storycanvas');
const evidenceFile = path.join(
  root,
  'docs/program/t0-canvas-v1/evidence/full-case-visibility/services.json',
);
const testedIntegration = required('CANVAS_FULL_CASE_INTEGRATION_SHA');
if (!/^[0-9a-f]{40}$/u.test(testedIntegration)) {
  throw new Error('FULL_CASE_INTEGRATION_SHA_INVALID');
}
const origins = {
  control: 'http://127.0.0.1:10600',
  story: 'http://127.0.0.1:10588',
  browser: 'http://127.0.0.1:5173',
} as const;

type Service = {
  name: 'control' | 'story' | 'vite';
  process: ChildProcess;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`FULL_CASE_${name}_REQUIRED`);
  return value;
}

async function parseEnvironment(filename: string): Promise<NodeJS.ProcessEnv> {
  return dotenv.parse(await readFile(filename, 'utf8'));
}

function withoutProvider(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const safe = { ...environment };
  delete safe.TSX_TSCONFIG_PATH;
  delete safe.NODE_OPTIONS;
  for (const key of Object.keys(safe)) {
    if (/^(?:ARK_|BYTEPLUS_|SEEDANCE_|VOLCENGINE_|OPENAI_|LLM_|MODELS_)/u.test(key)) {
      delete safe[key];
    }
  }
  return safe;
}

async function assertPortFree(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`FULL_CASE_PORT_${port}_BUSY`)));
    server.listen(port, '127.0.0.1', () => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });
}

function spawnService(
  name: Service['name'],
  command: string,
  args: string[],
  cwd: string,
  environment: NodeJS.ProcessEnv,
  redact: string[],
): Service {
  const child = spawn(command, args, {
    cwd,
    env: environment,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const safeWrite = (chunk: Buffer) => {
    let output = chunk.toString('utf8');
    for (const secret of redact) {
      if (secret.length >= 8) output = output.split(secret).join('[REDACTED]');
    }
    process.stdout.write(`[full-case:${name}] ${output}`);
  };
  child.stdout?.on('data', safeWrite);
  child.stderr?.on('data', safeWrite);
  return { name, process: child };
}

async function waitFor(url: string, service: Service): Promise<number> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (service.process.exitCode !== null) {
      throw new Error(`FULL_CASE_${service.name.toUpperCase()}_EXITED`);
    }
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.status < 500) return response.status;
    } catch {
      // Bounded readiness retry. Response bodies are intentionally never logged.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`FULL_CASE_${service.name.toUpperCase()}_NOT_READY`);
}

async function terminate(service: Service): Promise<void> {
  if (service.process.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      service.process.kill('SIGKILL');
      resolve();
    }, 5_000);
    service.process.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    service.process.kill('SIGTERM');
  });
}

async function main(): Promise<void> {
  const controlFile = required('CANVAS_FULL_CASE_CONTROL_ENV_FILE');
  const storyFile = required('CANVAS_FULL_CASE_STORY_ENV_FILE');
  const controlFileEnvironment = await parseEnvironment(controlFile);
  const storyFileEnvironment = await parseEnvironment(storyFile);
  const localCaseRoot = path.resolve(path.dirname(controlFile), '../..', 'data/videoagent-story-local-case');
  if (
    !controlFileEnvironment.PRODUCTION_PLANE_INTERNAL_TOKEN
    || controlFileEnvironment.PRODUCTION_PLANE_INTERNAL_TOKEN
      !== storyFileEnvironment.PRODUCTION_PLANE_INTERNAL_TOKEN
  ) {
    throw new Error('FULL_CASE_INTERNAL_TOKEN_MISMATCH');
  }
  await Promise.all([10600, 10588, 5173].map(assertPortFree));

  const inherited = withoutProvider(process.env);
  const controlEnvironment: NodeJS.ProcessEnv = {
    ...inherited,
    ...controlFileEnvironment,
    CONTROL_API_HOST: '127.0.0.1',
    CONTROL_API_PORT: '10600',
    CANVAS_ASSET_STORAGE_ROOT: path.join(path.dirname(controlFile), 'data/canvas-assets'),
    CANVAS_ASSET_ALLOWED_ORIGINS: origins.browser,
    APP_VERSION: testedIntegration,
  };
  const storyEnvironment: NodeJS.ProcessEnv = withoutProvider({
    ...inherited,
    ...storyFileEnvironment,
    NODE_ENV: 'prod',
    ELECTRON_RUN_AS_NODE: '1',
    STORYCANVAS_PILOT_CANVAS_ENABLED: 'true',
    CONTROL_API_BASE_URL: origins.control,
    STORYCANVAS_PILOT_ALLOWED_ORIGIN: origins.browser,
    STORYCANVAS_DATA_ROOT: localCaseRoot,
    STORYCANVAS_PORT: '10588',
  });
  const viteEnvironment: NodeJS.ProcessEnv = withoutProvider({
    ...inherited,
    PILOT_E2E: 'true',
    PILOT_E2E_AB_GOLDEN_PATH: 'true',
    PILOT_E2E_CONTROL_API_PORT: '10600',
    PILOT_E2E_STORYCANVAS_PORT: '10588',
    VITE_APP_MODE: 'pilot',
    VITE_CONTROL_API_BASE_URL: origins.browser,
    VITE_PILOT_E2E: 'true',
  });
  const providerKeysPresent = Object.keys(storyEnvironment).filter((key) =>
    /^(?:ARK_|BYTEPLUS_|SEEDANCE_|VOLCENGINE_|OPENAI_|LLM_|MODELS_)/u.test(key)
  );
  if (providerKeysPresent.length > 0) throw new Error('FULL_CASE_PROVIDER_ENV_PRESENT');

  const redact = [...new Set(
    [...Object.entries(controlFileEnvironment), ...Object.entries(storyFileEnvironment)]
      .filter(([key, value]) =>
        Boolean(value)
        && (/(?:SECRET|TOKEN|PASSWORD|KEY|DATABASE_URL)/u.test(key)
          || /^(?:ARK_|BYTEPLUS_|SEEDANCE_|VOLCENGINE_|OPENAI_|LLM_|MODELS_)/u.test(key)))
      .map(([, value]) => value as string),
  )];
  const services: Service[] = [];
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await Promise.all([...services].reverse().map(terminate));
  };
  process.once('SIGINT', () => void shutdown().then(() => process.exit(0)));
  process.once('SIGTERM', () => void shutdown().then(() => process.exit(0)));

  try {
    const control = spawnService(
      'control',
      path.join(controlRoot, 'node_modules/.bin/tsx'),
      ['src/server.ts'],
      controlRoot,
      controlEnvironment,
      redact,
    );
    services.push(control);
    const controlHealthStatus = await waitFor(`${origins.control}/health/ready`, control);

    const story = spawnService(
      'story',
      path.join(storyRoot, 'node_modules/.bin/tsx'),
      ['src/app.ts'],
      storyRoot,
      storyEnvironment,
      redact,
    );
    services.push(story);
    const storyHealthStatus = await waitFor(
      `${origins.story}/api/production/pilot/canvas/capability`,
      story,
    );

    const vite = spawnService(
      'vite',
      path.join(root, 'node_modules/.bin/vite'),
      ['--mode', 'test', '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
      root,
      viteEnvironment,
      redact,
    );
    services.push(vite);
    const browserHealthStatus = await waitFor(`${origins.browser}/login`, vite);

    await mkdir(path.dirname(evidenceFile), { recursive: true });
    await writeFile(evidenceFile, `${JSON.stringify({
      testedIntegration,
      runtimeHead: process.env.CANVAS_FULL_CASE_RUNTIME_HEAD ?? null,
      startedAt: new Date().toISOString(),
      origins,
      pids: Object.fromEntries(services.map(({ name, process: child }) => [name, child.pid])),
      healthStatus: {
        control: controlHealthStatus,
        story: storyHealthStatus,
        browser: browserHealthStatus,
      },
      providerConfigured: false,
    }, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write('[full-case] FINAL_SERVICES_READY\n');

    await new Promise<void>((resolve, reject) => {
      for (const service of services) {
        service.process.once('exit', (code, signal) => {
          if (!shuttingDown) reject(new Error(
            `FULL_CASE_${service.name.toUpperCase()}_UNEXPECTED_EXIT_${code ?? signal}`,
          ));
        });
      }
      process.once('SIGINT', resolve);
      process.once('SIGTERM', resolve);
    });
  } finally {
    await shutdown();
  }
}

main().catch((error) => {
  const code = error instanceof Error ? error.message : 'FULL_CASE_SERVICE_START_FAILED';
  process.stderr.write(`[full-case] ${code}\n`);
  process.exitCode = 1;
});
