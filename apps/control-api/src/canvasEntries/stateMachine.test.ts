import { describe, expect, it } from 'vitest';
import { assertNonSecretBrowserPayload } from './parser.js';
import { InMemoryCanvasEntryStateMachine } from './stateMachine.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const otherProjectId = '22222222-2222-4222-9222-222222222222';
const packageId = '33333333-3333-4333-8333-333333333333';
const otherPackageId = '33333333-3333-4333-9333-333333333333';
const firstHandle = `ce_${'A'.repeat(32)}`;
const secondHandle = `ce_${'B'.repeat(32)}`;

function command(
  overrides: Partial<{
    tenantId: string;
    projectId: string;
    packageId: string;
    idempotencyKey: string;
    ttlSeconds: number;
  }> = {},
) {
  return {
    tenantId,
    projectId,
    packageId,
    idempotencyKey: 'canvas-create-1',
    ttlSeconds: 120,
    ...overrides,
  };
}

describe('Canvas Entry in-memory state machine', () => {
  it('creates an opaque, short-lived, non-secret entry bound to tenant/project/package', () => {
    const machine = new InMemoryCanvasEntryStateMachine({
      now: () => new Date('2026-08-11T03:00:00.000Z'),
      generateHandle: () => firstHandle,
    });

    const result = machine.create(command());

    expect(result).toEqual({
      replayed: false,
      value: {
        objectType: 'CanvasEntry',
        contractVersion: '0.2',
        handle: firstHandle,
        tenantId,
        projectId,
        packageId,
        state: 'active',
        issuedAt: '2026-08-11T03:00:00.000Z',
        expiresAt: '2026-08-11T03:02:00.000Z',
      },
    });
    expect(result.value.handle).not.toContain(tenantId);
    expect(result.value.handle).not.toContain(projectId);
    expect(result.value.handle).not.toContain(packageId);
    expect(() => assertNonSecretBrowserPayload(result.value)).not.toThrow();
  });

  it('replays an identical scoped create without minting another handle', () => {
    const handles = [firstHandle, secondHandle];
    const machine = new InMemoryCanvasEntryStateMachine({
      now: () => new Date('2026-08-11T03:00:00.000Z'),
      generateHandle: () => handles.shift() ?? secondHandle,
    });

    const first = machine.create(command());
    const replay = machine.create(command());

    expect(first.replayed).toBe(false);
    expect(replay).toEqual({ value: first.value, replayed: true });
    expect(handles).toEqual([secondHandle]);
  });

  it.each([
    ['package binding', { packageId: otherPackageId }],
    ['TTL', { ttlSeconds: 121 }],
  ])('rejects the same scoped idempotency key with conflicting %s', (_label, overrides) => {
    const machine = new InMemoryCanvasEntryStateMachine({ generateHandle: () => firstHandle });
    machine.create(command());

    expect(() => machine.create(command(overrides))).toThrowError(
      expect.objectContaining({ code: 'CANVAS_ENTRY_IDEMPOTENCY_CONFLICT', status: 409 }),
    );
  });

  it('scopes idempotency by tenant and project rather than globally', () => {
    const handles = [firstHandle, secondHandle];
    const machine = new InMemoryCanvasEntryStateMachine({
      generateHandle: () => handles.shift() ?? secondHandle,
    });

    const first = machine.create(command());
    const second = machine.create(command({ projectId: otherProjectId }));

    expect(first.value.handle).toBe(firstHandle);
    expect(second.value.handle).toBe(secondHandle);
    expect(second.replayed).toBe(false);
  });

  it('allows exactly one consume and rejects replay', () => {
    let now = new Date('2026-08-11T03:00:00.000Z');
    const machine = new InMemoryCanvasEntryStateMachine({
      now: () => now,
      generateHandle: () => firstHandle,
    });
    machine.create(command());
    now = new Date('2026-08-11T03:00:10.000Z');

    expect(machine.consume(firstHandle, { tenantId, projectId, packageId })).toEqual({
      handle: firstHandle,
      tenantId,
      projectId,
      packageId,
      consumedAt: '2026-08-11T03:00:10.000Z',
    });
    expect(() => machine.consume(firstHandle, { tenantId, projectId, packageId })).toThrowError(
      expect.objectContaining({ code: 'CANVAS_ENTRY_REPLAYED', status: 409 }),
    );
  });

  it('expires at the exact expiresAt boundary and never consumes an expired entry', () => {
    let now = new Date('2026-08-11T03:00:00.000Z');
    const machine = new InMemoryCanvasEntryStateMachine({
      now: () => now,
      generateHandle: () => firstHandle,
    });
    machine.create(command());
    now = new Date('2026-08-11T03:02:00.000Z');

    expect(() => machine.consume(firstHandle, { tenantId, projectId, packageId })).toThrowError(
      expect.objectContaining({ code: 'CANVAS_ENTRY_EXPIRED', status: 410 }),
    );
  });

  it('checks the complete binding before changing single-use state', () => {
    const machine = new InMemoryCanvasEntryStateMachine({ generateHandle: () => firstHandle });
    machine.create(command());

    expect(() =>
      machine.consume(firstHandle, { tenantId, projectId, packageId: otherPackageId }),
    ).toThrowError(expect.objectContaining({ code: 'CANVAS_ENTRY_NOT_FOUND', status: 404 }));
    expect(() => machine.consume(firstHandle, { tenantId, projectId, packageId })).not.toThrow();
  });

  it('uses a strict not-found error for a well-formed unknown handle', () => {
    const machine = new InMemoryCanvasEntryStateMachine();

    expect(() => machine.consume(firstHandle, { tenantId, projectId, packageId })).toThrowError(
      expect.objectContaining({ code: 'CANVAS_ENTRY_NOT_FOUND', status: 404 }),
    );
  });

  it('rejects an invalid generated handle before storing or returning it', () => {
    const machine = new InMemoryCanvasEntryStateMachine({
      generateHandle: () => 'grant.raw.secret',
    });

    expect(() => machine.create(command())).toThrowError(
      expect.objectContaining({ code: 'CANVAS_ENTRY_SCHEMA_INVALID', status: 422 }),
    );
  });
});
