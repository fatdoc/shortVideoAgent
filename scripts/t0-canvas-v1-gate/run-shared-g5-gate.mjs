#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const verifiedDepsRoot = process.env.CANVAS_V1_VERIFIED_DEPS_ROOT;
const dependencyRoots = [rootDir, verifiedDepsRoot].filter(Boolean);
const resolveDependency = (relativePath) =>
  dependencyRoots
    .map((dependencyRoot) => path.join(dependencyRoot, relativePath))
    .find((candidate) => fs.existsSync(candidate));
const tsxCli =
  resolveDependency('apps/control-api/node_modules/tsx/dist/cli.mjs') ??
  resolveDependency('apps/storycanvas/node_modules/tsx/dist/cli.mjs');
const vitestCli = resolveDependency('node_modules/vitest/vitest.mjs');

if (!tsxCli || !vitestCli) {
  process.stderr.write('[shared-g5-gate] ENVIRONMENT_FAILURE missing tsx or Vitest runtime\n');
  process.exit(2);
}

const productSurfaces = [
  'src/features/canvas-v1/api/index.ts',
  'src/features/canvas-v1/api/CanvasV1RouteContainer.tsx',
  'src/services/pilotStoryCanvasBridge.ts',
];
const productPresent = productSurfaces.every((relativePath) =>
  fs.existsSync(path.join(rootDir, relativePath)),
);
const allowExpectedRed = process.argv.includes('--allow-expected-red') && !productPresent;

const phases = [
  {
    name: 'CV1 Activation Transport 25-vector validator',
    command: [
      process.execPath,
      '--test',
      'docs/program/contracts/canvas-v1/validate-activation-transport.mjs',
    ],
    expectedRed: false,
  },
  {
    name: 'CV6 Shared G5 public/static policy',
    command: [process.execPath, '--test', 'tests/e2e/canvas-v1/shared-g5-policy.gate.mjs'],
    expectedRed: allowExpectedRed,
  },
  {
    name: 'CV6 Shared G5 public runtime harness',
    command: [
      process.execPath,
      tsxCli,
      '--test',
      'tests/e2e/canvas-v1/shared-g5-runtime.gate.test.ts',
    ],
    expectedRed: allowExpectedRed,
  },
  {
    name: 'CV6 Shared G5 external-browser harness policy',
    command: [process.execPath, '--test', 'tests/e2e/canvas-v1/shared-g5-browser-policy.gate.mjs'],
    expectedRed: false,
  },
  {
    name: 'historical Shared exact 4-RED/real-product-GREEN attestation',
    command: [process.execPath, '--test', 'tests/e2e/canvas-v1/shared-g5-historical.gate.mjs'],
    expectedRed: false,
  },
];

let failed = false;
let observedExpectedRed = 0;
for (const phase of phases) {
  process.stdout.write(`\n[shared-g5-gate] ${phase.name}\n`);
  const result = spawnSync(phase.command[0], phase.command.slice(1), {
    cwd: rootDir,
    env: { ...process.env, NODE_OPTIONS: '' },
    shell: false,
    stdio: 'inherit',
  });
  if (result.error || result.status !== 0) {
    if (phase.expectedRed) {
      observedExpectedRed += 1;
      process.stdout.write(`[shared-g5-gate] EXPECTED_RED ${phase.name}\n`);
    } else {
      failed = true;
      process.stderr.write(
        `[shared-g5-gate] PRODUCT_RED ${phase.name}: ${result.error?.message ?? `exit ${result.status}`}\n`,
      );
    }
  }
}

if (failed) {
  process.stderr.write('\n[shared-g5-gate] SHARED_G5_GATE_RED\n');
  process.exitCode = 1;
} else if (observedExpectedRed > 0) {
  process.stdout.write(`\n[shared-g5-gate] SHARED_G5_EXPECTED_RED phases=${observedExpectedRed}\n`);
} else {
  process.stdout.write('\n[shared-g5-gate] SHARED_G5_GATE_PASS\n');
}
