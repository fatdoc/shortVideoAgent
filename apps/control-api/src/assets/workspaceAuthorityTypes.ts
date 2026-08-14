import type { AssetAuthorityRecord, AssetRecordProjection } from './types.js';
import type { CanvasAssetSessionVerifier } from './sessionTypes.js';

export const CANVAS_WORKSPACE_AUTHORITY_MAX_REQUEST_BYTES = 16 * 1024;

export type CanvasWorkspaceAuthorityRequest = {
  objectType: 'CanvasWorkspaceAuthorityRequest';
  contractVersion: '0.1';
  tenantId: string;
  projectId: string;
  packageId: string;
  canvasSessionId: string;
  actorId: string;
  requestId: string;
  occurredAt: string;
};

export type CanvasWorkspaceAuthorityResponse = {
  objectType: 'CanvasWorkspaceAuthority';
  contractVersion: '0.1';
  tenantId: string;
  projectId: string;
  packageId: string;
  canvasSessionId: string;
  project: { projectName: string };
  approvedScript: { scriptId: string; version: number };
  approvedStoryboard: { storyboardId: string; version: number };
  assets: AssetRecordProjection[];
  completeness: {
    project: true;
    approvedScript: true;
    approvedStoryboard: true;
    assets: true;
  };
  requestId: string;
  occurredAt: string;
};

export type CanvasWorkspaceProductionAuthority = {
  projectName: string;
  scriptId: string;
  scriptVersion: number;
  storyboardId: string;
  storyboardVersion: number;
};

export type CanvasWorkspaceProductionAuthorityInput = {
  tenantId: string;
  projectId: string;
  packageId: string;
  now: Date;
};

export interface CanvasWorkspaceProductionAuthorityStore {
  readExact(
    input: CanvasWorkspaceProductionAuthorityInput,
  ): Promise<CanvasWorkspaceProductionAuthority>;
}

export interface CanvasWorkspaceAssetStore {
  listAssets(input: { tenantId: string; projectId: string }): Promise<AssetAuthorityRecord[]>;
}

export type CanvasWorkspaceAuthorityDependencies = {
  sessionAuthority: CanvasAssetSessionVerifier;
  productionAuthority: CanvasWorkspaceProductionAuthorityStore;
  assets: CanvasWorkspaceAssetStore;
  now?: () => Date;
};

export type CanvasWorkspaceAuthorityLookupKind =
  | 'package'
  | 'project'
  | 'script'
  | 'storyboard'
  | 'dependency';

export class CanvasWorkspaceAuthorityLookupError extends Error {
  constructor(readonly kind: CanvasWorkspaceAuthorityLookupKind) {
    super(`Canvas workspace authority lookup failed: ${kind}`);
    this.name = 'CanvasWorkspaceAuthorityLookupError';
  }
}
