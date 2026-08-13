import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const depsRoot = process.env.CANVAS_V1_VERIFIED_DEPS_ROOT || rootDir;

function storyDependency(packageName) {
  const packageFile = path.join(
    depsRoot,
    'apps/storycanvas/node_modules',
    packageName,
    'package.json',
  );
  if (!fs.existsSync(packageFile)) throw new Error(`missing StoryCanvas dependency ${packageName}`);
  const manifest = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  return path.join(path.dirname(packageFile), manifest.main || 'index.js');
}

export default {
  resolve: {
    alias: {
      '@': path.join(rootDir, 'apps/storycanvas/src'),
      knex: storyDependency('knex'),
      zod: storyDependency('zod'),
    },
  },
  test: {
    environment: 'node',
    include: [
      'tests/e2e/canvas-v1/runtime-provider-recovery.gate.test.ts',
      'tests/e2e/canvas-v1/runtime-asset-adapters.gate.test.ts',
      'tests/e2e/canvas-v1/runtime-command-cost-parity.gate.test.ts',
    ],
    setupFiles: [],
  },
};
