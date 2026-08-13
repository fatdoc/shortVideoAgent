import type { ProjectGrant, ProjectProductionPackageV03 } from '../production/types.js';

export const CANVAS_ENTRY_CONTRACT_VERSION = '0.2' as const;
export const CANVAS_ENTRY_REDEMPTION_CONTRACT_VERSION = '0.1' as const;
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

/** Exact server-only command accepted by CanvasEntryService.redeemEntry. */
export type RedeemCanvasEntryInput = CanvasEntryBinding & {
  handle: string;
  idempotencyKey: string;
  redeemedBy: string;
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

/** Immutable redemption facts handed to the transactional Repository boundary. */
export type RedeemCanvasEntryRecord = RedeemCanvasEntryInput & {
  requestDigest: string;
  redeemedAt: Date;
};

/**
 * Full server-only authority restored by redemption. This value is permitted
 * only on the trusted Control API -> StoryCanvas server connection.
 */
export type CanvasEntryRedemptionValue = ConsumedCanvasEntry & {
  objectType: 'CanvasEntryRedemption';
  contractVersion: typeof CANVAS_ENTRY_REDEMPTION_CONTRACT_VERSION;
  productionPackage: ProjectProductionPackageV03;
  grant: ProjectGrant;
  tokenType: 'Bearer';
  accessToken: string;
};

export type RedeemCanvasEntryResult = {
  value: CanvasEntryRedemptionValue;
  replayed: boolean;
};

export interface CanvasEntryStore {
  createEntry(input: CreateCanvasEntryRecord): Promise<CreateCanvasEntryResult>;
  readEntry(input: ReadCanvasEntryRecord): Promise<CanvasEntryPublicDto>;
  redeemEntry(input: RedeemCanvasEntryRecord): Promise<RedeemCanvasEntryResult>;
}
