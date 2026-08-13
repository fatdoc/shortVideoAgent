import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const tsxLoader = join(repositoryRoot, 'apps/control-api/node_modules/tsx/dist/loader.mjs');
const cliPath = join(repositoryRoot, 'apps/control-api/src/e2e/migrationGateCli.ts');

const environment = {
  ...process.env,
  ARK_API_KEY: '',
  BYTEPLUS_TTS_ACCESS_TOKEN: '',
  BYTEPLUS_TTS_APP_ID: '',
};

const result = spawnSync(process.execPath, ['--import', tsxLoader, cliPath], {
  cwd: repositoryRoot,
  env: environment,
  stdio: 'inherit',
});

if (result.error || result.signal || typeof result.status !== 'number') {
  process.stderr.write('MIGRATION_GATE_LAUNCH_FAILED\n');
  process.exitCode = 1;
} else {
  process.exitCode = result.status;
}
