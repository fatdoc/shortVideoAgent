#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const requiredProduct = [
  'src/features/canvas-v1/api/index.ts',
  'src/features/canvas-v1/api/CanvasV1RouteContainer.tsx',
  'src/services/pilotStoryCanvasBridge.ts',
];
const requiredEnvironment = [
  'CANVAS_V1_BROWSER_BASE_URL',
  'CANVAS_V1_BROWSER_PROJECT_ID',
  'CANVAS_V1_BROWSER_PACKAGE_ID',
  'CANVAS_V1_BROWSER_PROJECT_NAME',
  'CANVAS_V1_BROWSER_LOGIN_EMAIL',
  'CANVAS_V1_BROWSER_LOGIN_PASSWORD',
];

function fail(code) {
  process.stderr.write(`[shared-g5-browser-gate] ${code}\n`);
  process.exit(2);
}

if (process.env.CANVAS_V1_EXTERNAL_SERVICES_READY !== 'true') {
  fail('EXTERNAL_THREE_SERVICES_REQUIRED');
}
if (process.env.CANVAS_V1_BROWSER_CAPTURE_EVIDENCE !== 'true') {
  fail('BROWSER_EVIDENCE_CAPTURE_EXPLICIT_OPT_IN_REQUIRED');
}
if (!requiredProduct.every((relativePath) => fs.existsSync(path.join(rootDir, relativePath)))) {
  fail('SHARED_G5_PRODUCT_REQUIRED');
}
for (const name of requiredEnvironment) {
  if (!process.env[name]) fail(`${name}_REQUIRED`);
}

let baseUrl;
try {
  baseUrl = new URL(process.env.CANVAS_V1_BROWSER_BASE_URL);
} catch {
  fail('CANVAS_V1_BROWSER_BASE_URL_INVALID');
}
if (
  baseUrl.protocol !== 'http:' ||
  baseUrl.hostname !== '127.0.0.1' ||
  !/^\d{1,5}$/u.test(baseUrl.port) ||
  baseUrl.pathname !== '/'
) {
  fail('CANVAS_V1_BROWSER_BASE_URL_LOOPBACK_REQUIRED');
}

const cli = path.join(rootDir, 'node_modules/@playwright/test/cli.js');
if (!fs.existsSync(cli)) fail('PLAYWRIGHT_RUNTIME_REQUIRED');
const result = spawnSync(
  process.execPath,
  [cli, 'test', '--config', 'scripts/t0-canvas-v1-gate/playwright.shared-g5.config.ts'],
  { cwd: rootDir, env: { ...process.env, NODE_OPTIONS: '' }, shell: false, stdio: 'inherit' },
);
if (result.error || result.status !== 0) {
  process.stderr.write(
    `[shared-g5-browser-gate] SHARED_G5_BROWSER_RED ${result.error?.message ?? `exit ${result.status}`}\n`,
  );
  process.exit(1);
}
process.stdout.write('[shared-g5-browser-gate] SHARED_G5_BROWSER_PASS\n');
