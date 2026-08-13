import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const storyAppPath = path.join(root, 'apps/storycanvas/src/app.ts');
const runtimePath = path.join(
  root,
  'apps/storycanvas/src/services/storycanvas/canvas-v1/runtime.ts',
);
const acceptancePath = path.join(
  root,
  'apps/storycanvas/src/services/storycanvas/canvas-v1/runtimeAuthorityAcceptance.ts',
);
const adapterPath = path.join(
  root,
  'apps/storycanvas/src/services/storycanvas/canvas-v1/shotProductionAdapter.ts',
);
const approvalValidatorPath = path.join(
  root,
  'apps/storycanvas/src/services/storycanvas/canvas-v1/runtimeApprovalValidator.ts',
);
const assetAdaptersPath = path.join(
  root,
  'apps/storycanvas/src/services/storycanvas/canvas-v1/runtimeAssetAdapters.ts',
);

function source(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

function runtimeOptions(application: string): string {
  const marker = 'createCanvasV1RuntimeRouter({';
  const start = application.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  return application.slice(start, application.indexOf('}));', start) + 4);
}

describe('CV6 independent production runtime wiring gate', () => {
  it('accepts only exact ready ProjectProductionPackage/0.3 with a unique canonical project mapping', () => {
    const acceptance = source(acceptancePath);
    expect(acceptance).toContain("approvedPackage.contractVersion !== '0.3'");
    expect(acceptance).toContain("approvedPackage.status !== 'ready'");
    expect(acceptance).toContain("entityType: 'project'");
    expect(acceptance).toContain('if (mappings.length !== 1)');
    expect(acceptance).toContain('candidate.tenantId === approvedPackage.tenantId');
    expect(acceptance).toContain('candidate.externalProjectId === approvedPackage.projectId');
    expect(acceptance).toContain("throw new CanvasCommandServiceError('CANVAS_SCOPE_MISMATCH')");
  });

  it('wires the server-only Control consumer and paid Provider adapter in production', () => {
    const options = runtimeOptions(source(storyAppPath));
    const application = source(storyAppPath);
    expect(options).toMatch(/\bvalidateApproval\b/u);
    expect(application).toContain('createCanvasV1ApprovalValidator({');
    expect(application).toContain('approvalClient.consume(command, scope)');
    expect(options).toContain('startShotProduction:');
    expect(options).toContain('production.start(input)');
  });

  it('does not apply GENERATE_SHOT Seedance/package checks to other high-cost approvals', () => {
    const approval = source(approvalValidatorPath);

    expect(approval).toMatch(/command\.commandType\s*===\s*["']GENERATE_SHOT["']/u);
    expect(approval).toContain('options.consume(command, scope)');
  });

  it.each([
    ['SYNC_PROVIDER_ASSET', 'syncProviderAsset:'],
    ['BIND_ASSET_TO_ENTITY', 'bindAssetToEntity:'],
    ['SELECT_SHOT_OUTPUT', 'assertOutputAsset:'],
  ])('wires the %s production adapter instead of relying on optional defaults', (_command, key) => {
    const runtime = source(runtimePath);
    expect(runtime).toContain(key);
  });

  it('keeps SAVE_CANVAS_DOCUMENT on the durable document store and GENERATE_SHOT on the paid adapter', () => {
    const runtime = source(runtimePath);
    const application = source(storyAppPath);
    expect(runtime).toContain('documentStore: documents');
    expect(application).toContain('startShotProduction: (input) => production.start(input)');
  });

  it('fails closed unless every required Seedance and remote-output credential exists', () => {
    const adapter = source(adapterPath);
    for (const variable of [
      'ARK_API_KEY',
      'ARK_ASSET_ACCESS_KEY',
      'ARK_ASSET_SECRET_KEY',
      'ARK_ASSET_GROUP_ID',
      'ARK_ASSET_TOS_BUCKET',
      'ARK_ASSET_TOS_ENDPOINT',
    ]) {
      expect(adapter).toContain(`env.${variable}?.trim()`);
    }
    expect(source(storyAppPath)).toContain('shotProductionConfigured: () => isCanvasV1ShotProductionConfigured()');
    expect(source(approvalValidatorPath)).toContain('!options.shotProductionConfigured()');
  });

  it('projects a safe local task id while raw Provider facts remain in the server task row', () => {
    const adapter = source(adapterPath);
    const runtime = source(runtimePath);
    expect(adapter).toContain('return { taskId };');
    expect(adapter).toContain('externalTaskId,');
    expect(adapter).toContain("outputJson: JSON.stringify({ outputAssetId: output.outputAssetId })");
    expect(runtime).not.toMatch(/response\.(?:json|send)\([^)]*externalTaskId/u);
    expect(runtime).not.toMatch(/response\.(?:json|send)\([^)]*videoUrl/u);
  });

  it('resolves SYNC/BIND from unique server mappings and SELECT from exact succeeded generated task output', () => {
    const adapters = source(assetAdaptersPath);
    expect(adapters).toContain('if (rows.length !== 1)');
    expect(adapters).toContain("entityType: 'canvas-v1-asset'");
    expect(adapters).toContain("entityType: 'character-asset'");
    expect(adapters).toContain("source: 'generated'");
    expect(adapters).toContain("taskType: 'canvas_v1_video_generation'");
    expect(adapters).toContain("status: 'succeeded'");
  });
});
