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

export type ProjectProductionPackage = {
  objectType: 'ProjectProductionPackage';
  contractVersion: '0.2';
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
  approvedScript: {
    scriptVersionId: string;
    content: string;
    approvedAt: string;
    approvedBy: string;
  };
  storyboard: StoryboardShot[];
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
  capabilityRequirements: ProductionCapability[];
  expiresInSeconds: number;
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
    input: CreatePackageInput,
    idempotency: IdempotencyInput,
  ): Promise<IdempotentResult<ProjectProductionPackage> | null>;
  getPackage(
    actor: SessionActor,
    projectId: string,
    packageId: string,
  ): Promise<ProjectProductionPackage | null>;
  issueGrant(
    actor: SessionActor,
    projectId: string,
    input: IssueGrantInput,
    idempotency: IdempotencyInput,
  ): Promise<IdempotentResult<IssuedProjectGrant> | null>;
}
