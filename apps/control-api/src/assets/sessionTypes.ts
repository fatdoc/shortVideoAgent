export type CanvasAssetSessionRegistration = {
  handle: string;
  tenantId: string;
  projectId: string;
  packageId: string;
  canvasSessionId: string;
  actorId: string;
};

export type CanvasAssetSessionScope = Omit<CanvasAssetSessionRegistration, 'handle'>;

export type CanvasAssetSessionAuthority = CanvasAssetSessionRegistration & {
  registeredAt: Date;
  expiresAt: Date;
};

export type RegisterCanvasAssetSessionOutcome =
  | { kind: 'created' | 'replayed'; value: CanvasAssetSessionAuthority }
  | { kind: 'conflict' };

export interface CanvasAssetSessionAuthorityStore {
  registerSession(
    input: CanvasAssetSessionRegistration & { registeredAt: Date },
  ): Promise<RegisterCanvasAssetSessionOutcome>;
  readActiveSession(
    input: CanvasAssetSessionScope & { verifiedAt: Date },
  ): Promise<CanvasAssetSessionAuthority | null>;
}

export type CanvasAssetSessionRegistrationResult = {
  status: 'active';
  expiresAt: string;
  replayed: boolean;
};

export interface CanvasAssetSessionVerifier {
  assertActiveSession(input: CanvasAssetSessionScope): Promise<void>;
}
