import { DEMO_PROJECT_ID } from '../../domain/constants';
import type { DemoProjectGrant } from '../../domain/controlPlane';
import { demoProjectGrantSchema } from '../../domain/controlPlaneSchemas';

export const STORYCANVAS_PACKAGE_ID = 'package-demo-local-001-v1';

const REQUIRED_SCOPES = [
  'production.package.read',
  'production.receipt.write',
] as const satisfies readonly DemoProjectGrant['scopes'][number][];

export interface StoryCanvasAppProps {
  grant?: DemoProjectGrant | null;
}

export type Phase1TaskStatus =
  | 'draft'
  | 'awaiting_confirmation'
  | 'queued'
  | 'running'
  | 'validating'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type Phase1AttemptDecision =
  | 'undecided'
  | 'selected'
  | 'alternative'
  | 'rejected';

export interface Phase1MediaAsset {
  id: string;
  assetType: 'image' | 'video' | string;
  playableUrl?: string | null;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  duration?: number | null;
  validationStatus: 'pending' | 'valid' | 'invalid' | 'missing' | 'inaccessible';
}

export interface Phase1ShotAttempt {
  id: string;
  shotId: string;
  generationTaskId: string;
  attemptNumber: number;
  assetId?: string | null;
  asset?: Phase1MediaAsset | null;
  qualityStatus?: string | null;
  operatorDecision: Phase1AttemptDecision;
  isSelected: boolean;
  createdAt: string;
}

export interface Phase1GenerationTask {
  id: string;
  shotId: string;
  attemptId?: string | null;
  taskType: 'image.generate' | 'video.generate' | string;
  provider?: string | null;
  model?: string | null;
  providerTaskId?: string | null;
  status: Phase1TaskStatus;
  progress: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  reservedCredit?: number;
  consumedCredit?: number;
  releasedCredit?: number;
  createdAt: string;
}

export interface Phase1GenerationPlan {
  shotId: string;
  planVersion: number;
  imagePrompt: string;
  videoPrompt: string;
  negativePrompt?: string;
  recommendedImageModel?: string | null;
  recommendedVideoModel?: string | null;
  referenceAssetIds: string[];
  continuityEntityIds?: string[];
  cameraPlan?: Record<string, unknown> | null;
  estimatedCredit?: number | null;
  generatedBy: string;
  approvedByOperator: boolean;
  approvedAt?: string | null;
}

export interface Phase1ProductionShot {
  id: string;
  externalStoryboardShotId: string;
  productionPackageId: string;
  projectId: string;
  sequence: number;
  title: string;
  duration: number;
  approvedScriptSegment: string;
  claimIds: string[];
  brandFactIds: string[];
  lockedBusinessFields: Record<string, unknown>;
  editableCreativeFields: Record<string, unknown>;
  shotContract: Record<string, unknown>;
  status: string;
  selectedAttemptId?: string | null;
  generationPlan?: Phase1GenerationPlan | null;
  attempts: Phase1ShotAttempt[];
  tasks: Phase1GenerationTask[];
}

export interface Phase1RuntimeWorkbench {
  projectId: string;
  packageId: string;
  mode: 'DEMO' | 'REAL' | string;
  shots: Phase1ProductionShot[];
  assets?: Phase1MediaAsset[];
  referenceAssets?: Array<Phase1MediaAsset & { name?: string; referenceRole?: string }>;
  modelOptions?: {
    image?: Array<{ id: string; label: string; available: boolean }>;
    video?: Array<{ id: string; label: string; available: boolean }>;
  };
  provenance?: Record<string, unknown>;
}

export type StoryCanvasGrantRejectionCode =
  | 'EXPLICIT_GRANT_REQUIRED'
  | 'GRANT_CONTRACT_INVALID'
  | 'GRANT_PROJECT_SCOPE_MISMATCH'
  | 'GRANT_PACKAGE_SCOPE_MISMATCH'
  | 'GRANT_SCOPE_MISMATCH'
  | 'GRANT_NOT_YET_VALID'
  | 'GRANT_EXPIRED';

export type StoryCanvasGrantValidation =
  | { ok: true; grant: DemoProjectGrant }
  | {
      ok: false;
      error: {
        code: StoryCanvasGrantRejectionCode;
        message: string;
      };
    };

function reject(
  code: StoryCanvasGrantRejectionCode,
  message: string,
): StoryCanvasGrantValidation {
  return { ok: false, error: { code, message: `${code}：${message}` } };
}

export function validateEmbeddedStoryCanvasGrant(
  value: unknown,
  now: Date = new Date(),
): StoryCanvasGrantValidation {
  if (value === null || value === undefined) {
    return reject('EXPLICIT_GRANT_REQUIRED', '画布必须接收当前项目的内存 Grant');
  }

  let grant: DemoProjectGrant;
  try {
    grant = demoProjectGrantSchema.parse(value);
  } catch {
    return reject('GRANT_CONTRACT_INVALID', 'Grant 不符合 DemoProjectGrant 合同');
  }

  if (grant.projectId !== DEMO_PROJECT_ID) {
    return reject(
      'GRANT_PROJECT_SCOPE_MISMATCH',
      `拒绝非 canonical Project ${grant.projectId}`,
    );
  }

  if (grant.packageId !== STORYCANVAS_PACKAGE_ID || grant.packageVersion !== 1) {
    return reject(
      'GRANT_PACKAGE_SCOPE_MISMATCH',
      `拒绝 Package ${grant.packageId} v${grant.packageVersion}`,
    );
  }

  const missingScopes = REQUIRED_SCOPES.filter(
    (scope) => !grant.scopes.includes(scope),
  );
  if (missingScopes.length > 0) {
    return reject(
      'GRANT_SCOPE_MISMATCH',
      `缺少 Scope ${missingScopes.join(', ')}`,
    );
  }

  const nowMs = now.getTime();
  const issuedAtMs = Date.parse(grant.issuedAt);
  const expiresAtMs = Date.parse(grant.expiresAt);
  if (!Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs)) {
    return reject('GRANT_CONTRACT_INVALID', 'Grant 时间字段不可解析');
  }
  if (issuedAtMs > nowMs) {
    return reject('GRANT_NOT_YET_VALID', 'Grant 尚未生效');
  }
  if (expiresAtMs <= nowMs) {
    return reject('GRANT_EXPIRED', 'Grant 已过期，请控制平面重新签发');
  }

  return { ok: true, grant };
}
