import { z } from 'zod';
import { canvasAssetError } from './errors.js';
import type {
  CanvasAssetSessionAuthorityStore,
  CanvasAssetSessionRegistration,
  CanvasAssetSessionRegistrationResult,
  CanvasAssetSessionScope,
} from './sessionTypes.js';

const uuid = z.string().uuid();
const handle = z.string().regex(/^ce_[A-Za-z0-9_-]{32,64}$/);
const canvasSessionId = z.string().regex(/^pcs_[A-Za-z0-9_-]{24,128}$/);
const registrationSchema = z
  .object({
    handle,
    tenantId: uuid,
    projectId: uuid,
    packageId: uuid,
    canvasSessionId,
    actorId: uuid,
  })
  .strict();
const scopeSchema = registrationSchema.omit({ handle: true }).strict();

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw canvasAssetError(
      'CANVAS_SESSION_INVALID',
      'Canvas session authority request cannot be accepted.',
    );
  }
  return result.data;
}

function now(clock: () => Date): Date {
  const value = clock();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw canvasAssetError('CANVAS_SESSION_INVALID', 'Canvas session clock is invalid.');
  }
  return new Date(value.getTime());
}

export function parseCanvasAssetSessionRegistration(
  input: unknown,
): CanvasAssetSessionRegistration {
  return parse(registrationSchema, input);
}

export function parseCanvasAssetSessionScope(input: unknown): CanvasAssetSessionScope {
  return parse(scopeSchema, input);
}

export class CanvasAssetSessionAuthorityService {
  private readonly now: () => Date;

  constructor(
    private readonly store: CanvasAssetSessionAuthorityStore,
    options: { now?: () => Date } = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async registerSession(inputValue: unknown): Promise<CanvasAssetSessionRegistrationResult> {
    const input = parseCanvasAssetSessionRegistration(inputValue);
    const registeredAt = now(this.now);
    const outcome = await this.store.registerSession({ ...input, registeredAt });
    if (outcome.kind === 'conflict') {
      throw canvasAssetError(
        'CANVAS_SESSION_CONFLICT',
        'Canvas session registration conflicts with immutable authority.',
      );
    }
    if (
      outcome.value.expiresAt.getTime() <= registeredAt.getTime() ||
      !Number.isFinite(outcome.value.expiresAt.getTime())
    ) {
      throw canvasAssetError('CANVAS_SESSION_INVALID', 'Canvas session authority is inactive.');
    }
    return {
      status: 'active',
      expiresAt: outcome.value.expiresAt.toISOString(),
      replayed: outcome.kind === 'replayed',
    };
  }

  async assertActiveSession(inputValue: unknown): Promise<void> {
    const input = parseCanvasAssetSessionScope(inputValue);
    const value = await this.store.readActiveSession({ ...input, verifiedAt: now(this.now) });
    if (!value) {
      throw canvasAssetError('CANVAS_SESSION_INVALID', 'Canvas session authority is invalid.');
    }
  }
}
