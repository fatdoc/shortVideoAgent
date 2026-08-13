import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

test('browser runner never starts services and requires explicit external readiness and evidence capture', () => {
  const source = read('scripts/t0-canvas-v1-gate/run-shared-g5-browser-gate.mjs');
  assert.match(source, /CANVAS_V1_EXTERNAL_SERVICES_READY/u);
  assert.match(source, /CANVAS_V1_BROWSER_CAPTURE_EVIDENCE/u);
  assert.match(source, /127\.0\.0\.1/u);
  assert.doesNotMatch(source, /webServer/u);
  assert.doesNotMatch(source, /npm\s+(?:run|start|exec)|docker|resetMigrateSeed/u);
});

test('browser config freezes both viewports and disables trace/video/implicit screenshots', () => {
  const source = read('scripts/t0-canvas-v1-gate/playwright.shared-g5.config.ts');
  assert.match(source, /1440[^\n]+900/u);
  assert.match(source, /1672[^\n]+941/u);
  assert.match(source, /trace:\s*'off'/u);
  assert.match(source, /video:\s*'off'/u);
  assert.match(source, /screenshot:\s*'off'/u);
  assert.doesNotMatch(source, /webServer/u);
});

test('browser spec freezes canonical package, containment, hydration/refresh and exact approval equality', () => {
  const source = read('tests/e2e/canvas-v1/shared-g5-browser.spec.ts');
  for (const marker of [
    'packageId=',
    'activationAttemptId',
    'localStorage',
    'sessionStorage',
    'indexedDbNames',
    'consoleOutput',
    'workspaceResponses',
    'page.reload()',
    "Object.keys(action).sort()).toEqual(['commandId', 'payload'])",
    'action.commandId',
    'action.payload',
    'command.approvalId',
    'videoagent_session',
  ])
    assert.ok(source.includes(marker), marker);
  assert.doesNotMatch(source, /test\.(?:skip|fixme|only)\s*\(/u);
});
