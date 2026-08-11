import { randomBytes } from 'node:crypto';
import type { SessionActor } from '../projects/types.js';
import { canvasEntryRequestDigest } from './digest.js';
import { canvasEntryError } from './errors.js';
import {
  parseCanvasEntryHandle,
  parseCanvasEntryPublicDto,
  parseCanvasEntryUuid,
  parseConsumedCanvasEntryAuthorization,
  parseConsumeCanvasEntryInput,
  parseCreateCanvasEntryInput,
} from './parser.js';
import { assertCanvasEntryBinding } from './policy.js';
import type {
  CanvasEntryPublicDto,
  CanvasEntryStore,
  ConsumeCanvasEntryInput,
  ConsumedCanvasEntryAuthorization,
  CreateCanvasEntryInput,
  CreateCanvasEntryResult,
} from './types.js';

type CanvasEntryServiceOptions = {
  now?: () => Date;
  generateHandle?: () => string;
};

function defaultHandle(): string {
  return `ce_${randomBytes(24).toString('base64url')}`;
}

function currentTime(now: () => Date): Date {
  const value = now();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw canvasEntryError('CANVAS_ENTRY_SCHEMA_INVALID', 'Canvas Entry service clock is invalid.');
  }
  return new Date(value.getTime());
}

export class CanvasEntryService {
  private readonly now: () => Date;
  private readonly generateHandle: () => string;

  constructor(
    private readonly store: CanvasEntryStore,
    private readonly digestSecret: string,
    options: CanvasEntryServiceOptions = {},
  ) {
    if (Buffer.byteLength(digestSecret, 'utf8') < 32) {
      throw new Error('Canvas Entry digest secret must contain at least 32 bytes.');
    }
    this.now = options.now ?? (() => new Date());
    this.generateHandle = options.generateHandle ?? defaultHandle;
  }

  async createEntry(
    actor: SessionActor,
    projectIdInput: string,
    inputValue: CreateCanvasEntryInput,
  ): Promise<CreateCanvasEntryResult> {
    const input = parseCreateCanvasEntryInput(inputValue);
    const tenantId = parseCanvasEntryUuid(actor.tenantId);
    const projectId = parseCanvasEntryUuid(projectIdInput);
    const createdBy = parseCanvasEntryUuid(actor.userId);
    const issuedAt = currentTime(this.now);
    const expiresAt = new Date(issuedAt.getTime() + input.ttlSeconds * 1000);
    const handle = parseCanvasEntryHandle(this.generateHandle());
    const facts = {
      tenantId,
      projectId,
      packageId: input.packageId,
      idempotencyKey: input.idempotencyKey,
      ttlSeconds: input.ttlSeconds,
      createdBy,
    };

    const result = await this.store.createEntry({
      tenantId,
      projectId,
      packageId: input.packageId,
      handle,
      idempotencyKey: input.idempotencyKey,
      requestDigest: canvasEntryRequestDigest(this.digestSecret, facts),
      issuedAt,
      expiresAt,
      createdBy,
    });
    if (typeof result.replayed !== 'boolean') {
      throw canvasEntryError(
        'CANVAS_ENTRY_SCHEMA_INVALID',
        'Canvas Entry Store returned an invalid replay flag.',
      );
    }
    const value = parseCanvasEntryPublicDto(result.value);
    assertCanvasEntryBinding(value, { tenantId, projectId, packageId: input.packageId });
    return { value, replayed: result.replayed };
  }

  async readEntry(
    actor: SessionActor,
    projectIdInput: string,
    handleInput: string,
  ): Promise<CanvasEntryPublicDto> {
    const tenantId = parseCanvasEntryUuid(actor.tenantId);
    const projectId = parseCanvasEntryUuid(projectIdInput);
    const handle = parseCanvasEntryHandle(handleInput);
    const value = parseCanvasEntryPublicDto(
      await this.store.readEntry({
        tenantId,
        projectId,
        handle,
        readAt: currentTime(this.now),
      }),
    );
    if (value.tenantId !== tenantId || value.projectId !== projectId || value.handle !== handle) {
      throw canvasEntryError(
        'CANVAS_ENTRY_NOT_FOUND',
        'Canvas Entry tenant/project/handle binding mismatch.',
      );
    }
    return value;
  }

  async consumeEntry(
    actor: SessionActor,
    projectIdInput: string,
    inputValue: ConsumeCanvasEntryInput,
  ): Promise<ConsumedCanvasEntryAuthorization> {
    const input = parseConsumeCanvasEntryInput(inputValue);
    const tenantId = parseCanvasEntryUuid(actor.tenantId);
    const projectId = parseCanvasEntryUuid(projectIdInput);
    const consumed = await this.store.consumeEntry({
      handle: input.handle,
      tenantId,
      projectId,
      packageId: input.packageId,
      consumedAt: currentTime(this.now),
    });
    const parsed = parseConsumedCanvasEntryAuthorization(consumed);
    assertCanvasEntryBinding(parsed, { tenantId, projectId, packageId: input.packageId });
    return parsed;
  }
}
