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
