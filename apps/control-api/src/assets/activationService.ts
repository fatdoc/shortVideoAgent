import { createHmac } from 'node:crypto';
import type { CanvasEntryService } from '../canvasEntries/service.js';
import type { CanvasEntryPublicDto } from '../canvasEntries/types.js';
import type { SessionActor } from '../projects/types.js';
import { parseCanvasActivationInput, parseUuid, type CanvasActivationInput } from './parser.js';

export const CANVAS_ACTIVATION_ENTRY_TTL_SECONDS = 120;
const CANVAS_ACTIVATION_KEY_VERSION = 'canvas-entry-activation-v1';

type CanvasActivationEntryService = Pick<CanvasEntryService, 'createEntry'>;

export type CanvasActivationResult = {
  entry: CanvasEntryPublicDto;
  replayed: boolean;
};

function canonicalActivationFacts(input: {
  actorId: string;
  tenantId: string;
  projectId: string;
  packageId: string;
  activationAttemptId: string;
}): string {
  return JSON.stringify({
    version: CANVAS_ACTIVATION_KEY_VERSION,
    actorId: input.actorId,
    tenantId: input.tenantId,
    projectId: input.projectId,
    packageId: input.packageId,
    activationAttemptId: input.activationAttemptId,
  });
}

export class CanvasActivationService {
  constructor(
    private readonly entries: CanvasActivationEntryService,
    private readonly idempotencySecret: string,
  ) {
    if (Buffer.byteLength(idempotencySecret, 'utf8') < 32) {
      throw new Error('Canvas activation idempotency secret must contain at least 32 bytes.');
    }
  }

  async activate(
    actor: SessionActor,
    projectIdInput: string,
    packageIdInput: string,
    inputValue: CanvasActivationInput,
  ): Promise<CanvasActivationResult> {
    const input = parseCanvasActivationInput(inputValue);
    const projectId = parseUuid(projectIdInput);
    const packageId = parseUuid(packageIdInput);
    const actorId = parseUuid(actor.userId);
    const tenantId = parseUuid(actor.tenantId);
    const internalKey = `cva1.${createHmac('sha256', this.idempotencySecret)
      .update(
        canonicalActivationFacts({
          actorId,
          tenantId,
          projectId,
          packageId,
          activationAttemptId: input.activationAttemptId,
        }),
      )
      .digest('base64url')}`;
    const result = await this.entries.createEntry(actor, projectId, {
      packageId,
      ttlSeconds: CANVAS_ACTIVATION_ENTRY_TTL_SECONDS,
      idempotencyKey: internalKey,
    });
    return { entry: result.value, replayed: result.replayed };
  }
}
