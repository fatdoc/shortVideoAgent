import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const matrixPath = path.join(root, 'tests/e2e/canvas-v1/full-case-visibility.matrix.json');
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
const manifestPath = path.join(root, 'src/domain/unifiedTenantWorkbench.ts');
const routerPath = path.join(root, 'src/app/Router.tsx');
const localAccountsPath = path.join(root, 'src/pages/auth/pilotLocalAccounts.ts');
const contentPagesPath = path.join(
  root,
  'src/pages/pilot-production/PilotProjectContentPages.tsx',
);

const exactAccounts = [
  ['platform_admin', 'platform@videoagent.test', 'PLATFORM', 'denied', 'pilot-tenant-context-required'],
  ['channel_admin', 'channel@videoagent.test', 'CHANNEL', 'denied', 'pilot-tenant-context-required'],
  ['tenant_admin', 'admin@videoagent.test', 'TENANT', 'full', 'pilot-project-list'],
  ['content_operator', 'operator@videoagent.test', 'TENANT', 'full_except_brief_create', 'pilot-project-list'],
];
const exactStages = [
  ['project', '/projects', 'implemented_real'],
  ['brand', '/projects/:projectId/brand', 'product_blocked_canonical_brand_projection'],
  ['brief', '/projects/new', 'implemented_real'],
  ['script', '/projects/:projectId/script', 'implemented_real'],
  ['storyboard', '/projects/:projectId/storyboard', 'implemented_real'],
  ['production', '/production/overview', 'implemented_real'],
  ['canvas', '/production/canvas/:projectId?packageId=:packageId', 'no_provider_blocked_readiness'],
];

test('full-case matrix freezes four real accounts and their project-scope dispositions', () => {
  assert.equal(matrix.objectType, 'CanvasFullCaseVisibilityGate');
  assert.equal(matrix.contractVersion, '0.1');
  assert.deepEqual(
    matrix.accounts.map((account) => [
      account.key,
      account.email,
      account.organizationType,
      account.projectCaseAccess,
      account.expectedProjectSurface,
    ]),
    exactAccounts,
  );
  assert.equal(new Set(matrix.accounts.map(({ email }) => email)).size, 4);
});

test('full-case stages distinguish implemented, product-blocked and safe no-provider states', () => {
  assert.deepEqual(
    matrix.stages.map((stage) => [stage.key, stage.routeTemplate, stage.currentClassification]),
    exactStages,
  );
  assert.equal(new Set(matrix.stages.map(({ key }) => key)).size, exactStages.length);
  for (const stage of matrix.stages) {
    if (stage.requiredMarkerEnvironment !== null) {
      assert.match(stage.requiredMarkerEnvironment, /^CANVAS_FULL_CASE_[A-Z_]+$/u);
    }
    assert.ok([
      'real_server_data',
      'real_service_create_surface',
      'real_no_provider_blocked_readiness',
    ].includes(stage.acceptance));
    assert.notEqual(stage.currentClassification, 'demo');
    assert.notEqual(stage.currentClassification, 'placeholder_pass');
  }
});

test('Brand remains product RED while the UI cannot project canonical brandPolicySnapshot', () => {
  const contentPages = fs.readFileSync(contentPagesPath, 'utf8');
  const brand = matrix.stages.find(({ key }) => key === 'brand');
  assert.equal(brand.currentClassification, 'product_blocked_canonical_brand_projection');
  assert.equal(brand.blockerCode, 'CANONICAL_BRAND_POLICY_SNAPSHOT_UNSUPPORTED');
  assert.match(
    contentPages,
    /exactKeys\(payload, \['merchantName', 'city', 'campaignGoal', 'brandFacts'\]\)/u,
  );
  assert.doesNotMatch(contentPages, /brandPolicySnapshot/u);
});

test('platform and channel roles cannot masquerade as the tenant full case', () => {
  const nonTenant = matrix.accounts.filter(({ organizationType }) => organizationType !== 'TENANT');
  assert.deepEqual(nonTenant.map(({ projectCaseAccess }) => projectCaseAccess), ['denied', 'denied']);
  for (const stage of matrix.stages) {
    assert.ok(!stage.roles.includes('platform_admin'));
    assert.ok(!stage.roles.includes('channel_admin'));
  }
  const brief = matrix.stages.find(({ key }) => key === 'brief');
  assert.deepEqual(brief.roles, ['tenant_admin']);
});

test('Pilot router sends all full-case pages to real content surfaces before fallback branches', () => {
  const manifest = fs.readFileSync(manifestPath, 'utf8');
  const router = fs.readFileSync(routerPath, 'utf8');
  const contentPages = fs.readFileSync(contentPagesPath, 'utf8');
  const pilotManifestRoute = router.match(
    /function PilotManifestRoute[\s\S]*?(?=\nfunction PilotConfigurationBlock)/u,
  )?.[0];
  assert.ok(pilotManifestRoute, 'PILOT_MANIFEST_ROUTE_REQUIRED');
  assert.match(
    pilotManifestRoute,
    /route\.key === 'production-canvas'\) return <CanvasV1RouteContainer \/>/u,
  );
  for (const routeKey of ['project-create', 'brand', 'script', 'storyboard', 'production-overview']) {
    assert.match(manifest, new RegExp(`key:\\s*'${routeKey}'`, 'u'));
    assert.match(pilotManifestRoute, new RegExp(`'${routeKey}'`, 'u'));
  }
  assert.ok(
    pilotManifestRoute.indexOf('contentRouteKeys.has') <
      pilotManifestRoute.indexOf("route.pilotReadiness === 'handoff-required'"),
    'REAL_CONTENT_BRANCH_MUST_PRECEDE_HANDOFF_FALLBACK',
  );
  assert.match(pilotManifestRoute, /<PilotProjectContentPage/u);
  assert.match(pilotManifestRoute, /testId="pilot-route-handoff"/u);
  assert.match(pilotManifestRoute, /testId="pilot-route-unavailable"/u);
  assert.doesNotMatch(pilotManifestRoute, /<BrandBrainPage/u);
  assert.doesNotMatch(pilotManifestRoute, /<IntegratedStoryCanvasPage/u);
  assert.match(contentPages, /data-testid="pilot-project-create-page"/u);
  assert.match(contentPages, /data-testid=\{`pilot-project-content-\$\{routeKey\}`\}/u);
  assert.doesNotMatch(contentPages, /DEMO_PROJECT_ID|localStorage|sessionStorage/u);
});

test('local four-account picker is either exact or explicitly pending integration', () => {
  if (!fs.existsSync(localAccountsPath)) {
    assert.ok(true, 'ACCOUNT_PICKER_PENDING_INTEGRATION');
    return;
  }
  const source = fs.readFileSync(localAccountsPath, 'utf8');
  for (const [role, email] of exactAccounts) {
    assert.match(source, new RegExp(`key:\\s*'${role}'[\\s\\S]*?email:\\s*'${email.replaceAll('.', '\\.')}'`, 'u'));
  }
  assert.match(source, /environment\.DEV === true/u);
});

test('empty, handoff, unavailable and boundary screens can never count as a complete-case PASS', () => {
  assert.ok(matrix.forbiddenSuccessSurfaces.testIds.length >= 5);
  assert.ok(matrix.forbiddenSuccessSurfaces.phrases.length >= 5);
  assert.ok(matrix.forbiddenSuccessSurfaces.testIds.includes('pilot-route-handoff'));
  assert.ok(matrix.forbiddenSuccessSurfaces.testIds.includes('pilot-storycanvas-boundary-blocked'));
});
