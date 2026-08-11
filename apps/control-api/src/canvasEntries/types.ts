export const CANVAS_ENTRY_CONTRACT_VERSION = '0.2' as const;
export const CANVAS_ENTRY_MIN_TTL_SECONDS = 30;
export const CANVAS_ENTRY_MAX_TTL_SECONDS = 300;
export const CANVAS_ENTRY_DEFAULT_TTL_SECONDS = 120;

export type CanvasEntryBinding = {
  tenantId: string;
  projectId: string;
  packageId: string;
};

export type CreateCanvasEntryCommand = CanvasEntryBinding & {
  idempotencyKey: string;
  ttlSeconds: number;
};

/**
 * Browser-safe reference to server-held production authorization.
 *
 * The handle is deliberately not a bearer grant: using it must still require
 * an authenticated Control API session and an exact tenant/project/package
 * scope match. Raw ProjectGrant material never belongs in this DTO.
 */
export type CanvasEntryPublicDto = CanvasEntryBinding & {
  objectType: 'CanvasEntry';
  contractVersion: typeof CANVAS_ENTRY_CONTRACT_VERSION;
  handle: string;
  state: 'active';
  issuedAt: string;
  expiresAt: string;
};

export type CreateCanvasEntryResult = {
  value: CanvasEntryPublicDto;
  replayed: boolean;
};

/** Server-only result proving that the opaque entry was consumed once. */
export type ConsumedCanvasEntry = CanvasEntryBinding & {
  handle: string;
  consumedAt: string;
};

export type CreateCanvasEntryInput = {
  packageId: string;
  idempotencyKey: string;
  ttlSeconds: number;
};

export type ConsumeCanvasEntryInput = {
  packageId: string;
  handle: string;
};

export type CreateCanvasEntryRecord = CanvasEntryBinding & {
  handle: string;
  idempotencyKey: string;
  requestDigest: string;
  issuedAt: Date;
  expiresAt: Date;
  createdBy: string;
};

export type ReadCanvasEntryRecord = {
  tenantId: string;
  projectId: string;
  handle: string;
  readAt: Date;
};

export type ConsumeCanvasEntryRecord = CanvasEntryBinding & {
  handle: string;
  consumedAt: Date;
};

/**
 * Server-only authorization reference returned after the one-time transition.
 * The grant id is not a bearer credential and this object must not be returned
 * as the browser-facing Canvas Entry DTO.
 */
export type ConsumedCanvasEntryAuthorization = ConsumedCanvasEntry & {
  grantId: string;
};

export interface CanvasEntryStore {
  createEntry(input: CreateCanvasEntryRecord): Promise<CreateCanvasEntryResult>;
  readEntry(input: ReadCanvasEntryRecord): Promise<CanvasEntryPublicDto>;
  consumeEntry(input: ConsumeCanvasEntryRecord): Promise<ConsumedCanvasEntryAuthorization>;
}
