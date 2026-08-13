import { randomBytes } from 'node:crypto';
import { canvasEntryError } from './errors.js';
import {
  parseCanvasEntryBinding,
  parseCanvasEntryHandle,
  parseCanvasEntryPublicDto,
  parseCreateCanvasEntryCommand,
} from './parser.js';
import { assertCanvasEntryBinding } from './policy.js';
import {
  CANVAS_ENTRY_CONTRACT_VERSION,
  type CanvasEntryBinding,
  type CanvasEntryPublicDto,
  type ConsumedCanvasEntry,
  type CreateCanvasEntryCommand,
  type CreateCanvasEntryResult,
} from './types.js';

type ActiveEntryRecord = {
  dto: CanvasEntryPublicDto;
  requestFingerprint: string;
  lifecycle: 'active' | 'consumed' | 'expired';
  consumedAt?: string;
};

type CanvasEntryStateMachineOptions = {
  now?: () => Date;
  generateHandle?: () => string;
};

function defaultHandle(): string {
  return `ce_${randomBytes(24).toString('base64url')}`;
}

function validNow(now: () => Date): Date {
  const value = now();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw canvasEntryError('CANVAS_ENTRY_SCHEMA_INVALID', 'Canvas Entry clock is invalid.');
  }
  return value;
}

function idempotencyScope(command: CreateCanvasEntryCommand): string {
  return JSON.stringify([
    'canvas-entry.create',
    command.tenantId,
    command.projectId,
    command.idempotencyKey,
  ]);
}

function requestFingerprint(command: CreateCanvasEntryCommand): string {
  return JSON.stringify([
    command.tenantId,
    command.projectId,
    command.packageId,
    command.ttlSeconds,
  ]);
}

export class InMemoryCanvasEntryStateMachine {
  private readonly entries = new Map<string, ActiveEntryRecord>();
  private readonly idempotencyIndex = new Map<string, string>();
  private readonly now: () => Date;
  private readonly generateHandle: () => string;

  constructor(options: CanvasEntryStateMachineOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.generateHandle = options.generateHandle ?? defaultHandle;
  }

  create(input: CreateCanvasEntryCommand): CreateCanvasEntryResult {
    const command = parseCreateCanvasEntryCommand(input);
    const scope = idempotencyScope(command);
    const fingerprint = requestFingerprint(command);
    const existingHandle = this.idempotencyIndex.get(scope);
    if (existingHandle) {
      const existing = this.entries.get(existingHandle);
      if (!existing) {
        throw canvasEntryError(
          'CANVAS_ENTRY_SCHEMA_INVALID',
          'Canvas Entry idempotency index is inconsistent.',
        );
      }
      if (existing.requestFingerprint !== fingerprint) {
        throw canvasEntryError(
          'CANVAS_ENTRY_IDEMPOTENCY_CONFLICT',
          'Canvas Entry idempotency key was used with different immutable facts.',
        );
      }
      return { value: existing.dto, replayed: true };
    }

    const issuedAt = validNow(this.now);
    const expiresAt = new Date(issuedAt.getTime() + command.ttlSeconds * 1000);
    const handle = this.allocateHandle();
    const dto = parseCanvasEntryPublicDto({
      objectType: 'CanvasEntry',
      contractVersion: CANVAS_ENTRY_CONTRACT_VERSION,
      handle,
      tenantId: command.tenantId,
      projectId: command.projectId,
      packageId: command.packageId,
      state: 'active',
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
    this.entries.set(handle, {
      dto,
      requestFingerprint: fingerprint,
      lifecycle: 'active',
    });
    this.idempotencyIndex.set(scope, handle);
    return { value: dto, replayed: false };
  }

  consume(handleInput: string, bindingInput: CanvasEntryBinding): ConsumedCanvasEntry {
    const handle = parseCanvasEntryHandle(handleInput);
    const expectedBinding = parseCanvasEntryBinding(bindingInput);
    const record = this.entries.get(handle);
    if (!record) {
      throw canvasEntryError('CANVAS_ENTRY_NOT_FOUND', 'Canvas Entry handle was not found.');
    }

    assertCanvasEntryBinding(record.dto, expectedBinding);
    if (record.lifecycle === 'consumed') {
      throw canvasEntryError('CANVAS_ENTRY_REPLAYED', 'Canvas Entry was consumed more than once.');
    }

    const consumedAt = validNow(this.now);
    if (
      record.lifecycle === 'expired' ||
      consumedAt.getTime() >= new Date(record.dto.expiresAt).getTime()
    ) {
      record.lifecycle = 'expired';
      throw canvasEntryError('CANVAS_ENTRY_EXPIRED', 'Canvas Entry reached its expiry boundary.');
    }

    record.lifecycle = 'consumed';
    record.consumedAt = consumedAt.toISOString();
    return {
      handle,
      tenantId: record.dto.tenantId,
      projectId: record.dto.projectId,
      packageId: record.dto.packageId,
      consumedAt: record.consumedAt,
    };
  }

  private allocateHandle(): string {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const handle = parseCanvasEntryHandle(this.generateHandle());
      if (!this.entries.has(handle)) return handle;
    }
    throw canvasEntryError(
      'CANVAS_ENTRY_SCHEMA_INVALID',
      'Canvas Entry handle generator produced repeated values.',
    );
  }
}
