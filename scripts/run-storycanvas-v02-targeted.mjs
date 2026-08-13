import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repositoryRoot = process.cwd();
const storycanvasRoot = path.join(repositoryRoot, 'apps/storycanvas');
const tsxCli = path.join(storycanvasRoot, 'node_modules/tsx/dist/cli.mjs');
const testNode = [
  process.env.STORYCANVAS_TEST_NODE,
  path.join(os.homedir(), '.hermes/node/bin/node'),
  process.execPath,
].find((candidate) => candidate && fs.existsSync(candidate));

const testPaths = [
  'src/contracts/v0.2/runtime.test.ts',
  'src/contracts/v0.2/security.test.ts',
  'src/routes/production/v0.2/index.test.ts',
  'src/services/storycanvas/pilotV02Receiver.test.ts',
];

if (!testNode || !fs.existsSync(tsxCli)) {
  console.error('BLOCKED STORYCANVAS_V02_TEST_RUNTIME_REQUIRED');
  process.exitCode = 2;
} else {
  const environment = {
    ...process.env,
    NODE_ENV: 'test',
    ARK_API_KEY: '',
    BYTEPLUS_TTS_ACCESS_TOKEN: '',
    BYTEPLUS_TTS_APP_ID: '',
  };
  delete environment.NODE_TEST_CONTEXT;

  const result = spawnSync(testNode, [tsxCli, '--test', ...testPaths], {
    cwd: storycanvasRoot,
    encoding: 'utf8',
    stdio: 'inherit',
    env: environment,
  });
  process.exitCode = result.status ?? 1;
}
