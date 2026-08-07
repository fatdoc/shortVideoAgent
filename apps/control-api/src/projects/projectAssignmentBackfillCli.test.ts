import type { Knex } from 'knex';
import { describe, expect, it, vi } from 'vitest';
import { executeProjectAssignmentBackfillCli } from './projectAssignmentBackfillCli.js';

const safeResult = {
  manifestId: 'pilot-tenant-a-001',
  manifestDigest: `sha256:${'a'.repeat(64)}`,
  assignmentCount: 2,
  replay: false,
} as const;

function createHarness(options: { source?: string; runError?: Error } = {}) {
  const destroy = vi.fn(async () => undefined);
  const database = { destroy } as unknown as Knex;
  const readManifestFile = vi.fn(async () => options.source ?? '{}');
  const openDatabase = vi.fn(() => database);
  const runBackfill = vi.fn(async () => {
    if (options.runError) throw options.runError;
    return safeResult;
  });
  const outputs: string[] = [];
  const errors: string[] = [];

  return {
    database,
    destroy,
    readManifestFile,
    openDatabase,
    runBackfill,
    outputs,
    errors,
    dependencies: {
      readManifestFile,
      openDatabase,
      runBackfill,
      writeOutput: (message: string) => outputs.push(message),
      writeError: (message: string) => errors.push(message),
    },
  };
}

describe('project assignment backfill CLI', () => {
  it('fails closed without an explicit manifest path', async () => {
    const harness = createHarness();

    const exitCode = await executeProjectAssignmentBackfillCli({}, harness.dependencies);

    expect(exitCode).toBe(1);
    expect(harness.readManifestFile).not.toHaveBeenCalled();
    expect(harness.openDatabase).not.toHaveBeenCalled();
    expect(harness.runBackfill).not.toHaveBeenCalled();
    expect(harness.outputs).toEqual([]);
    expect(harness.errors).toEqual(['项目授权回填失败。']);
  });

  it.each(['', '   ', '{invalid-json'])(
    'rejects empty or invalid JSON without opening the database',
    async (source) => {
      const harness = createHarness({ source });

      const exitCode = await executeProjectAssignmentBackfillCli(
        { PROJECT_ASSIGNMENT_MANIFEST_PATH: ' /secure/pilot-manifest.json ' },
        harness.dependencies,
      );

      expect(exitCode).toBe(1);
      expect(harness.readManifestFile).toHaveBeenCalledWith('/secure/pilot-manifest.json');
      expect(harness.openDatabase).not.toHaveBeenCalled();
      expect(harness.runBackfill).not.toHaveBeenCalled();
      expect(harness.outputs).toEqual([]);
      expect(harness.errors).toEqual(['项目授权回填失败。']);
    },
  );

  it('prints only a safe success summary and always destroys the database', async () => {
    const manifest = {
      manifestVersion: 1,
      manifestId: 'pilot-tenant-a-001',
      tenantId: '10000000-0000-4000-8000-000000000001',
      approvedByUserId: '10000000-0000-4000-8000-000000000002',
      assignments: [],
    };
    const harness = createHarness({ source: JSON.stringify(manifest) });
    const environment = {
      PROJECT_ASSIGNMENT_MANIFEST_PATH: '/secure/pilot-manifest.json',
      DATABASE_URL: 'postgresql://private-user:private-password@database/private',
    };

    const exitCode = await executeProjectAssignmentBackfillCli(environment, harness.dependencies);

    expect(exitCode).toBe(0);
    expect(harness.openDatabase).toHaveBeenCalledWith(environment);
    expect(harness.runBackfill).toHaveBeenCalledWith(harness.database, manifest);
    expect(harness.destroy).toHaveBeenCalledOnce();
    expect(harness.errors).toEqual([]);
    expect(harness.outputs).toEqual([
      JSON.stringify({ event: 'project_assignment_backfill_completed', ...safeResult }),
    ]);
    expect(harness.outputs.join('')).not.toContain('private-password');
    expect(harness.outputs.join('')).not.toContain('/secure/pilot-manifest.json');
  });

  it('uses a generic failure message without leaking runner errors or manifest contents', async () => {
    const secretEmail = 'private-customer@example.com';
    const secretToken = 'token-super-secret-value';
    const secretPassword = 'password-super-secret-value';
    const secretContent = 'confidential-content-body';
    const source = JSON.stringify({
      email: secretEmail,
      token: secretToken,
      password: secretPassword,
      content: secretContent,
    });
    const harness = createHarness({
      source,
      runError: new Error(`${secretEmail} ${secretToken} ${secretPassword} ${secretContent}`),
    });

    const exitCode = await executeProjectAssignmentBackfillCli(
      { PROJECT_ASSIGNMENT_MANIFEST_PATH: '/secure/pilot-manifest.json' },
      harness.dependencies,
    );

    expect(exitCode).toBe(1);
    expect(harness.destroy).toHaveBeenCalledOnce();
    expect(harness.outputs).toEqual([]);
    expect(harness.errors).toEqual(['项目授权回填失败。']);
    const serialized = JSON.stringify({ outputs: harness.outputs, errors: harness.errors });
    expect(serialized).not.toContain(secretEmail);
    expect(serialized).not.toContain(secretToken);
    expect(serialized).not.toContain(secretPassword);
    expect(serialized).not.toContain(secretContent);
  });
});
