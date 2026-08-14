import type { SessionActor } from '../projects/types.js';

export const productionCapabilities = [
  'image.generate',
  'video.generate',
  'audio.tts',
  'media.export',
] as const;
export type ProductionCapability = (typeof productionCapabilities)[number];

export const productionScopes = [
  'production.package.read',
  'production.task.write',
  'production.receipt.write',
  'production.asset.write',
  'production.export.write',
] as const;
export type ProductionScope = (typeof productionScopes)[number];

export type BrandPolicySnapshot = {
  facts: Array<{
    factId: string;
    text: string;
    sourceReference: string;
    approved: true;
  }>;
  prohibitedTerms: string[];
  requiredDisclosures: string[];
  sourceDigest: string;
};

export type StoryboardShot = {
  shotId: string;
  sequence: number;
  description: string;
  durationSeconds: number;
  sourceMode: 'uploaded' | 'generated' | 'mixed';
};

type ProjectProductionPackageBase = {
  objectType: 'ProjectProductionPackage';
  tenantId: string;
  projectId: string;
  idempotencyKey: string;
  occurredAt: string;
  payloadDigest: string;
  packageId: string;
  packageVersion: number;
  organizationId: string;
  briefSnapshot: {
    briefVersionId: string;
    objective: string;
    audience: string[];
    platforms: string[];
  };
  brandPolicySnapshot: BrandPolicySnapshot;
  target: {
    aspectRatio: string;
    durationSeconds: number;
    container: 'mp4';
    videoCodec: 'h264';
  };
  capabilityRequirements: ProductionCapability[];
  createdAt: string;
  expiresAt: string;
};

export type ProjectProductionPackageV02 = ProjectProductionPackageBase & {
  contractVersion: '0.2';
  approvedScript: {
    scriptVersionId: string;
    content: string;
    approvedAt: string;
    approvedBy: string;
  };
  storyboard: StoryboardShot[];
};

/**
 * Immutable server-side Production Package v0.3 snapshot. HTTP routes must
 * project this internal authority evidence to the strict browser-safe DTO.
 */
export type ProjectProductionPackageV03 = ProjectProductionPackageBase & {
  contractVersion: '0.3';
  status: 'ready';
  scriptVersionId: string;
  storyboardVersionId: string;
  approvedScriptDigest: string;
  approvedStoryboardDigest: string;
  approvedScript: {
    scriptVersionId: string;
    payloadDigest: string;
    content: string;
    approvedAt: string;
    approvedBy: string;
  };
  approvedStoryboard: {
    storyboardVersionId: string;
    scriptVersionId: string;
    scriptPayloadDigest: string;
    payloadDigest: string;
    approvedAt: string;
    approvedBy: string;
  };
  storyboard: StoryboardShot[];
};

export type ProjectProductionPackage = ProjectProductionPackageV02 | ProjectProductionPackageV03;

export type ProjectGrant = {
  objectType: 'ProjectGrant';
  contractVersion: '0.2';
  tenantId: string;
  projectId: string;
  idempotencyKey: string;
  occurredAt: string;
  payloadDigest: string;
  grantId: string;
  packageId: string;
  capabilities: ProductionCapability[];
  scopes: ProductionScope[];
  tokenDigest: string;
  keyId: string;
  issuedAt: string;
  expiresAt: string;
};

export type CreatePackageInput = {
  scriptVersionId: string;
  storyboardVersionId: string;
  capabilityRequirements: ProductionCapability[];
  expiresInSeconds: number;
};

/**
 * Temporary HTTP boundary used until the strict Package v0.3 route slice lands.
 * Repository callers use CreatePackageInput and fail closed when the Storyboard
 * authority ID is absent.
 */
export type TransitionalCreatePackageInput = Omit<CreatePackageInput, 'storyboardVersionId'> & {
  storyboardVersionId?: string;
};

export type IssueGrantInput = {
  packageId: string;
  requestedCapabilities: ProductionCapability[];
  requestedScopes: ProductionScope[];
  ttlSeconds: number;
};

export type IssuedProjectGrant = {
  grant: ProjectGrant;
  tokenType: 'Bearer';
  accessToken: string;
};

/** Exact server-side scope used to restore persisted Canvas authorization. */
export type RestoreGrantAuthorizationInput = {
  tenantId: string;
  projectId: string;
  packageId: string;
  grantId: string;
  now: Date;
};

/**
 * Server-only authority bundle. Browser-facing routes must never expose the
 * access token or the full immutable Production Package snapshot.
 */
export type RestoredGrantAuthorization = IssuedProjectGrant & {
  productionPackage: ProjectProductionPackageV03;
};

export type IdempotencyInput = {
  operation: string;
  key: string;
  scope: Record<string, string>;
  payload: unknown;
};

export type IdempotentResult<T> = { value: T; replayed: boolean };

export interface ProductionStore {
  createPackage(
    actor: SessionActor,
    projectId: string,
    input: TransitionalCreatePackageInput,
    idempotency: IdempotencyInput,
  ): Promise<IdempotentResult<ProjectProductionPackage> | null>;
  getPackage(
    actor: SessionActor,
    projectId: string,
    packageId: string,
  ): Promise<ProjectProductionPackage | null>;
  listPackages(actor: SessionActor, projectId: string): Promise<ProjectProductionPackage[]>;
  issueGrant(
    actor: SessionActor,
    projectId: string,
    input: IssueGrantInput,
    idempotency: IdempotencyInput,
  ): Promise<IdempotentResult<IssuedProjectGrant> | null>;
}
