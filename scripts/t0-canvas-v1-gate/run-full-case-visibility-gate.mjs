#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const run = (command, args, environment = {}) => spawnSync(command, args, {
  cwd: root,
  env: { ...process.env, NODE_OPTIONS: '', ...environment },
  shell: false,
  stdio: 'inherit',
});

const policy = run(process.execPath, [
  '--test',
  'tests/e2e/canvas-v1/full-case-visibility-policy.gate.mjs',
]);
if (policy.error || policy.status !== 0) {
  process.stderr.write('[canvas-full-case] POLICY_RED\n');
  process.exit(1);
}

const matrix = JSON.parse(fs.readFileSync(
  path.join(root, 'tests/e2e/canvas-v1/full-case-visibility.matrix.json'),
  'utf8',
));
const missingPages = matrix.stages
  .filter(({ currentClassification }) => currentClassification === 'page_not_implemented')
  .map(({ key }) => key);
const productBlockers = matrix.stages
  .filter(({ currentClassification }) => currentClassification.startsWith('product_blocked_'))
  .map(({ key, currentClassification }) => `${key}:${currentClassification}`);
const externalReady = process.env.CANVAS_FULL_CASE_EXTERNAL_READY === 'true';
const requireComplete = process.argv.includes('--require-complete');

if (missingPages.length > 0) {
  process.stdout.write(
    `[canvas-full-case] EXPECTED_RED page_not_implemented=${missingPages.join(',')}\n`,
  );
}
if (productBlockers.length > 0) {
  process.stdout.write(`[canvas-full-case] PRODUCT_RED ${productBlockers.join(',')}\n`);
}
if (!externalReady) {
  process.stdout.write('[canvas-full-case] EXPECTED_RED external_seed_or_services_not_ready\n');
}
if (missingPages.length > 0 || productBlockers.length > 0 || !externalReady) {
  process.stdout.write('[canvas-full-case] FULL_CASE_VISIBILITY_EXPECTED_RED\n');
  if (requireComplete) process.exitCode = 1;
  process.exit();
}

const playwright = path.join(root, 'node_modules/@playwright/test/cli.js');
const browser = run(process.execPath, [
  playwright,
  'test',
  '--config',
  'scripts/t0-canvas-v1-gate/playwright.full-case-visibility.config.ts',
]);
if (browser.error || browser.status !== 0) {
  process.stderr.write('[canvas-full-case] BROWSER_RED\n');
  process.exit(1);
}
process.stdout.write('[canvas-full-case] FULL_CASE_VISIBILITY_PASS\n');
