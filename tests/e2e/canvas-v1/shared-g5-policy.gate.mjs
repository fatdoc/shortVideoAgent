import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(read(relativePath));
const policy = readJson('tests/e2e/canvas-v1/shared-g5-policy.fixture.json');

test('policy freezes the public Shared G5 surface and same-origin sequence', () => {
  assert.equal(policy.schemaVersion, 'cv6-shared-g5-policy.v1');
  assert.equal(policy.baseline, '6e7fd7f73483bfd4061cfb26b4dff5a7f03c4cd7');
  assert.equal(policy.publicSurfaces.length, 3);
  assert.equal(policy.httpSequence.length, 7);
  assert.equal(policy.canonicalRoute.pattern, '/production/canvas/:projectId?packageId=<uuid>');
  assert.deepEqual(policy.canonicalRoute.requiredQueryKeys, ['packageId']);
  assert.ok(policy.canonicalRoute.forbiddenQueryKeys.includes('activationAttemptId'));
  assert.equal(policy.proxy.changeOrigin, false);
  assert.match(policy.bridgePublicMethods.prepareApproval, /reacquires Control CSRF internally/u);
  assert.match(policy.bridgePublicMethods.dispatch, /unchanged complete command/u);
  assert.match(
    policy.bridgePublicMethods.refresh,
    /workspace, document, assets and shot readiness/u,
  );
  assert.deepEqual(policy.proxy.requiredFlags, {
    PILOT_E2E: 'true',
    PILOT_E2E_AB_GOLDEN_PATH: 'true',
  });
  assert.ok(policy.attemptContainment.forbiddenSinks.includes('history state'));
  assert.ok(policy.attemptContainment.forbiddenSinks.includes('indexedDB'));
  assert.match(policy.transportSecurity.session, /HttpOnly.*credentials include/u);
  assert.match(policy.transportSecurity.origin, /exact configured same origin/u);
  assert.match(policy.transportSecurity.controlCsrf, /activation and approval only/u);
  assert.match(policy.transportSecurity.storyCsrf, /pilot-canvas-bootstrap-v1/u);
  assert.match(policy.transportSecurity.canvasSession, /X-Canvas-Session-ID/u);
  for (const sink of ['URL', 'localStorage', 'sessionStorage', 'DOM', 'console', 'public log']) {
    assert.ok(policy.attemptContainment.forbiddenSinks.includes(sink), sink);
  }
});

test('the frozen Activation Transport catalog remains exactly 25 unique vectors', () => {
  const vectors = readJson(
    'docs/program/contracts/canvas-v1/activation-transport-negative-vectors.json',
  ).vectors;
  assert.equal(vectors.length, policy.requiredActivationVectorCount);
  assert.equal(new Set(vectors.map(({ id }) => id)).size, vectors.length);

  const ids = new Set(vectors.map(({ id }) => id));
  for (const required of [
    'canonical-route-package-query-required',
    'canonical-route-package-query-must-be-uuid',
    'activation-attempt-not-in-url',
    'activation-attempt-not-in-storage',
    'activation-attempt-not-in-log',
    'formal-bootstrap-requires-explicit-session-header',
    'formal-bootstrap-requires-exact-origin',
    'approval-action-requires-command-id-and-payload',
    'approval-command-type-must-match-dispatch',
    'approval-command-id-must-match-dispatch',
    'approval-payload-must-match-dispatch',
    'static-generic-approval-forbidden',
  ])
    assert.ok(ids.has(required), required);
});

test('all four historical Shared RED tests remain present and executable', () => {
  assert.equal(policy.historicalRed.length, 4);
  for (const historical of policy.historicalRed) {
    const source = read(historical.path);
    assert.ok(source.includes(historical.title), `${historical.path}: ${historical.title}`);
    assert.doesNotMatch(source, /(?:it|test|describe)\.(?:skip|todo|only)\s*\(/u);
  }
});

test('Shared G5 product exposes only the frozen public entrypoints (EXPECTED RED before owner product)', () => {
  const missing = [];
  for (const surface of policy.publicSurfaces) {
    const absolutePath = path.join(rootDir, surface.path);
    if (!fs.existsSync(absolutePath)) {
      missing.push(`${surface.path}#${surface.exports.join(',')}`);
      continue;
    }
    const source = fs.readFileSync(absolutePath, 'utf8');
    for (const exportName of surface.exports) {
      const exported = new RegExp(
        `(?:export\\s+(?:class|function|const|interface|type)\\s+${exportName}\\b|export\\s*\\{[^}]*\\b${exportName}\\b[^}]*\\})`,
        'u',
      );
      if (!exported.test(source)) missing.push(`${surface.path}#${exportName}`);
    }
  }
  assert.deepEqual(missing, [], `EXPECTED_RED missing Shared G5 surfaces:\n${missing.join('\n')}`);
});

test('Shared product sources contain no Demo, old bridge, MVP or storage fallback', () => {
  const sources = [
    'src/features/canvas-v1/api/index.ts',
    'src/features/canvas-v1/api/CanvasV1RouteContainer.tsx',
    'src/services/pilotStoryCanvasBridge.ts',
  ]
    .map((relativePath) => path.join(rootDir, relativePath))
    .filter((absolutePath) => fs.existsSync(absolutePath))
    .map((absolutePath) => fs.readFileSync(absolutePath, 'utf8'))
    .join('\n');

  for (const marker of policy.forbiddenProductMarkers) {
    assert.equal(sources.includes(marker), false, marker);
  }
  assert.doesNotMatch(sources, /\b(?:localStorage|sessionStorage|indexedDB)\b/u);
});

test('proxy keeps both explicit flags, loopback-only targets and changeOrigin false', () => {
  const source = read('src/config/pilotE2eProxy.ts');
  assert.match(source, /PILOT_E2E/u);
  assert.match(source, /PILOT_E2E_AB_GOLDEN_PATH/u);
  assert.match(source, /127\.0\.0\.1/u);
  assert.doesNotMatch(source, /changeOrigin\s*:\s*true/u);
  assert.equal((source.match(/changeOrigin\s*:\s*false/gu) ?? []).length >= 2, true);
});

test('Router has a dedicated Canvas V1 route and no generic or Demo Canvas fallback', () => {
  const source = read('src/app/Router.tsx');
  assert.match(source, /CanvasV1RouteContainer/u);
  assert.doesNotMatch(source, /IntegratedStoryCanvasPage/u);
  assert.doesNotMatch(
    source,
    /production-canvas[\s\S]{0,1000}pilotReadiness\s*===?\s*["']handoff-required["']/u,
  );
});
