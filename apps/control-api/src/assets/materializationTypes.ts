export const CANVAS_MATERIALIZATION_MAX_BYTES = 8 * 1024 * 1024;
export const CANVAS_MATERIALIZATION_MAX_REQUEST_BYTES = 16 * 1024;

export type CanvasMaterializationMime = 'image/jpeg' | 'image/png' | 'image/webp';

export type CanvasAssetMaterializationRequest = {
  objectType: 'CanvasAssetMaterializationRequest';
  contractVersion: '0.1';
  tenantId: string;
  projectId: string;
  packageId: string;
  canvasSessionId: string;
  assetId: string;
  actorId: string;
  materializationAttemptId: string;
  requestId: string;
  occurredAt: string;
};

export type CanvasAssetMaterializationResponse = Omit<
  CanvasAssetMaterializationRequest,
  'objectType' | 'actorId'
> & {
  objectType: 'CanvasAssetMaterialization';
  materializationId: string;
  category: 'virtual_character';
  mimeType: CanvasMaterializationMime;
  byteSize: number;
  checksum: string;
  contentEncoding: 'base64';
  contentBase64: string;
  replayed: boolean;
};

export type CanvasAssetMaterializationAttempt = {
  materializationAttemptId: string;
  materializationId: string;
  tenantId: string;
  projectId: string;
  packageId: string;
  canvasSessionId: string;
  actorId: string;
  assetId: string;
  authorityChecksum: string;
  mimeType: CanvasMaterializationMime;
  byteSize: number;
  createdAt: Date;
};

export type CanvasAssetMaterializationAttemptOutcome =
  | { kind: 'created' | 'replayed'; value: CanvasAssetMaterializationAttempt }
  | { kind: 'conflict' };

export interface CanvasAssetMaterializationAttemptStore {
  createOrReplay(
    input: CanvasAssetMaterializationAttempt,
  ): Promise<CanvasAssetMaterializationAttemptOutcome>;
}

export type CanvasAssetMaterializationBytes = {
  bytes: Buffer;
  mimeType: CanvasMaterializationMime;
  byteSize: number;
  checksum: string;
};

export interface CanvasAssetMaterializationStorage {
  read(storageReference: string): Promise<CanvasAssetMaterializationBytes>;
}
