import type {
  AssetReceipt,
  DemoProjectGrant,
  ExportReceipt,
  GenerationTaskReceipt,
  ProjectProductionPackage,
  StandardReceiptError,
  StoryCanvasPackageResponse,
} from './controlPlane';
import { digestValue } from './controlPlaneUtils';

export type Phase1RuntimeTaskStatus =
  | 'draft'
  | 'awaiting_confirmation'
  | 'queued'
  | 'running'
  | 'validating'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface Phase1ProductionShot {
  id: string;
  externalStoryboardShotId: string;
  productionPackageId: string;
  projectId: string;
  sequence: number;
  description: string;
  durationSeconds: number;
  status: 'ready' | 'in_production' | 'selected';
  selectedAttemptId: string | null;
}

export interface Phase1HandoffProjection {
  packageId: string;
  projectId: string;
  packageDigest: string;
  status: 'accepted' | 'duplicate' | 'rejected' | 'grant_invalid';
  grantStatus: 'valid' | 'missing' | 'invalid';
  grantId: string | null;
  deepLink: string | null;
  error: Phase1ProjectionError | null;
  updatedAt: string;
}

export interface Phase1RuntimeTask {
  id: string;
  shotId: string;
  attemptId: string;
  taskType: 'image.generate' | 'video.generate' | 'export';
  provider: string;
  model: string;
  providerTaskId: string | null;
  status: Phase1RuntimeTaskStatus;
  progress: number;
  outputAssetIds: string[];
  idempotencyKey: string;
  error: StandardReceiptError | null;
  createdAt: string;
  completedAt: string | null;
}

export interface Phase1ShotAttempt {
  id: string;
  shotId: string;
  generationTaskId: string;
  attemptNumber: number;
  parentAttemptId: string | null;
  assetId: string | null;
  operatorDecision: 'undecided' | 'selected' | 'alternative' | 'rejected';
  createdAt: string;
}

export interface Phase1MediaAsset {
  id: string;
  projectId: string;
  shotId: string;
  attemptId: string;
  generationTaskId: string;
  assetType: 'image' | 'video' | 'export';
  localPath: string | null;
  remoteUrl: string | null;
  playableUrl: string | null;
  mimeType: string;
  durationSeconds: number;
  sha256: string | null;
  validationStatus: 'pending' | 'valid' | 'invalid' | 'missing' | 'inaccessible';
  createdAt: string;
}

export interface Phase1RoughCut {
  id: string;
  projectId: string;
  orderedShotSelections: Array<{ shotId: string; attemptId: string }>;
  previewAssetId: string;
  approvalStatus: 'draft' | 'pending_tenant' | 'approved' | 'rejected';
  approvedAt: string | null;
}

export interface Phase1ExportArtifact {
  id: string;
  projectId: string;
  roughCutId: string | null;
  assetId: string | null;
  status: 'pending' | 'blocked' | 'succeeded' | 'failed';
  provenanceTaskIds: string[];
  createdAt: string;
}

export interface Phase1CreditAllocation {
  taskId: string;
  attemptId: string;
  reservationId: string;
  status: 'reserved' | 'consumed' | 'released';
  reservedCredit: number;
  consumedCredit: number;
  releasedCredit: number;
}

export interface Phase1CreditEntry {
  id: string;
  taskId: string;
  attemptId: string;
  operation: 'reserve' | 'consume' | 'release';
  amount: number;
  idempotencyKey: string;
  occurredAt: string;
}

interface ProcessedPhase1CreditCommand {
  idempotencyKey: string;
  payloadDigest: string;
}

export interface Phase1ProjectionError {
  code: string;
  message: string;
  retryable: boolean;
  details: Record<string, string | number | boolean>;
}

export interface Phase1ControlPlaneProjection {
  schemaVersion: 1;
  shots: Phase1ProductionShot[];
  handoffs: Phase1HandoffProjection[];
  tasks: Phase1RuntimeTask[];
  attempts: Phase1ShotAttempt[];
  assets: Phase1MediaAsset[];
  roughCuts: Phase1RoughCut[];
  exports: Phase1ExportArtifact[];
  creditAllocations: Phase1CreditAllocation[];
  creditEntries: Phase1CreditEntry[];
  processedCreditCommands: ProcessedPhase1CreditCommand[];
}

export type Phase1CreditCommand =
  | {
      type: 'reserve';
      taskId: string;
      attemptId: string;
      reservationId: string;
      credits: number;
      idempotencyKey: string;
      occurredAt: string;
    }
  | {
      type: 'settle_success';
      taskId: string;
      attemptId: string;
      actualCredits: number;
      idempotencyKey: string;
      occurredAt: string;
    }
  | {
      type: 'settle_failure' | 'settle_cancel';
      taskId: string;
      attemptId: string;
      idempotencyKey: string;
      occurredAt: string;
    };

export class Phase1ProductionError extends Error {
  readonly code: string;
  readonly details: Record<string, string | number | boolean>;

  constructor(
    code: string,
    message: string,
    details: Record<string, string | number | boolean> = {},
  ) {
    super(message);
    this.name = 'Phase1ProductionError';
    this.code = code;
    this.details = details;
  }
}

export function createPhase1ControlPlaneProjection(): Phase1ControlPlaneProjection {
  return {
    schemaVersion: 1,
    shots: [],
    handoffs: [],
    tasks: [],
    attempts: [],
    assets: [],
    roughCuts: [],
    exports: [],
    creditAllocations: [],
    creditEntries: [],
    processedCreditCommands: [],
  };
}

export function isPhase1ControlPlaneProjection(
  value: unknown,
): value is Phase1ControlPlaneProjection {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Phase1ControlPlaneProjection>;
  return (
    candidate.schemaVersion === 1 &&
    Array.isArray(candidate.shots) &&
    Array.isArray(candidate.handoffs) &&
    Array.isArray(candidate.tasks) &&
    Array.isArray(candidate.attempts) &&
    Array.isArray(candidate.assets) &&
    Array.isArray(candidate.roughCuts) &&
    Array.isArray(candidate.exports) &&
    Array.isArray(candidate.creditAllocations) &&
    Array.isArray(candidate.creditEntries) &&
    Array.isArray(candidate.processedCreditCommands)
  );
}

function stableShotId(projectId: string, externalShotId: string) {
  return `${projectId}:shot:${externalShotId}`;
}

function upsert<T>(items: T[], next: T, key: (item: T) => string): T[] {
  const id = key(next);
  return [...items.filter((item) => key(item) !== id), next];
}

export function recordPhase1Handoff(
  state: Phase1ControlPlaneProjection,
  input: {
    productionPackage: ProjectProductionPackage;
    grant: DemoProjectGrant | null;
    response: StoryCanvasPackageResponse | null;
    error: Phase1ProjectionError | null;
    updatedAt?: string;
  },
): Phase1ControlPlaneProjection {
  const next = structuredClone(state);
  const accepted = input.response?.status === 'accepted';
  const duplicate = accepted && input.response?.result === 'duplicate';
  const grantInvalid = Boolean(input.error?.code.startsWith('GRANT_'));
  const handoff: Phase1HandoffProjection = {
    packageId: input.productionPackage.packageId,
    projectId: input.productionPackage.projectId,
    packageDigest: input.productionPackage.digest,
    status: grantInvalid
      ? 'grant_invalid'
      : duplicate
        ? 'duplicate'
        : accepted
          ? 'accepted'
          : 'rejected',
    grantStatus: grantInvalid ? 'invalid' : input.grant && accepted ? 'valid' : 'missing',
    grantId: input.grant?.grantId ?? null,
    deepLink: accepted ? (input.response?.deepLink ?? null) : null,
    error: input.error,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
  next.handoffs = upsert(next.handoffs, handoff, (item) => item.packageId);

  if (accepted) {
    for (const shot of input.productionPackage.shotDrafts) {
      const id = stableShotId(input.productionPackage.projectId, shot.id);
      const existing = next.shots.find((item) => item.id === id);
      next.shots = upsert(
        next.shots,
        {
          id,
          externalStoryboardShotId: shot.id,
          productionPackageId: input.productionPackage.packageId,
          projectId: input.productionPackage.projectId,
          sequence: shot.order,
          description: shot.description,
          durationSeconds: shot.duration,
          status: existing?.status ?? 'ready',
          selectedAttemptId: existing?.selectedAttemptId ?? null,
        },
        (item) => item.id,
      );
    }
    next.shots.sort((left, right) => left.sequence - right.sequence);
  }
  return next;
}

export function isPhase1HandoffReady(handoff: Phase1HandoffProjection | undefined) {
  return Boolean(
    handoff &&
      (handoff.status === 'accepted' || handoff.status === 'duplicate') &&
      handoff.grantStatus === 'valid',
  );
}

export function projectPhase1Task(
  state: Phase1ControlPlaneProjection,
  task: Phase1RuntimeTask,
): Phase1ControlPlaneProjection {
  const next = structuredClone(state);
  next.tasks = upsert(next.tasks, structuredClone(task), (item) => item.id);
  return next;
}

export function projectPhase1Attempt(
  state: Phase1ControlPlaneProjection,
  attempt: Phase1ShotAttempt,
): Phase1ControlPlaneProjection {
  const next = structuredClone(state);
  const taskOwner = next.attempts.find(
    (item) => item.generationTaskId === attempt.generationTaskId && item.id !== attempt.id,
  );
  if (taskOwner) {
    throw new Phase1ProductionError(
      'TASK_ATTEMPT_CONFLICT',
      '同一个 GenerationTask 只能属于一个 ShotAttempt。',
      { generationTaskId: attempt.generationTaskId },
    );
  }
  next.attempts = upsert(next.attempts, structuredClone(attempt), (item) => item.id);
  return next;
}

export function projectPhase1Asset(
  state: Phase1ControlPlaneProjection,
  asset: Phase1MediaAsset,
): Phase1ControlPlaneProjection {
  const next = structuredClone(state);
  next.assets = upsert(next.assets, structuredClone(asset), (item) => item.id);
  return next;
}

export function selectPhase1Attempt(
  state: Phase1ControlPlaneProjection,
  attemptId: string,
): Phase1ControlPlaneProjection {
  const next = structuredClone(state);
  const selected = next.attempts.find((item) => item.id === attemptId);
  if (!selected) {
    throw new Phase1ProductionError('ATTEMPT_NOT_FOUND', '找不到待采用的 ShotAttempt。', {
      attemptId,
    });
  }
  const asset = next.assets.find((item) => item.attemptId === attemptId);
  if (!asset || !isValidPlayableAsset(asset)) {
    throw new Phase1ProductionError(
      'ASSET_NOT_PLAYABLE',
      '只有已验证且可播放的视频资产才能成为采用版本。',
      { attemptId },
    );
  }
  next.attempts = next.attempts.map((item) =>
    item.shotId !== selected.shotId
      ? item
      : {
          ...item,
          operatorDecision:
            item.id === attemptId
              ? ('selected' as const)
              : item.operatorDecision === 'rejected'
                ? ('rejected' as const)
                : ('alternative' as const),
        },
  );
  next.shots = next.shots.map((shot) =>
    shot.id === selected.shotId
      ? { ...shot, selectedAttemptId: attemptId, status: 'selected' as const }
      : shot,
  );
  return next;
}

export function projectPhase1RoughCut(
  state: Phase1ControlPlaneProjection,
  roughCut: Phase1RoughCut,
): Phase1ControlPlaneProjection {
  for (const selection of roughCut.orderedShotSelections) {
    const attempt = state.attempts.find(
      (item) => item.id === selection.attemptId && item.shotId === selection.shotId,
    );
    const asset = state.assets.find((item) => item.attemptId === selection.attemptId);
    if (!attempt || attempt.operatorDecision !== 'selected' || !asset || !isValidPlayableAsset(asset)) {
      throw new Phase1ProductionError(
        'ROUGH_CUT_GATE_BLOCKED',
        'RoughCut 只能引用已采用且可播放的镜头版本。',
        { shotId: selection.shotId, attemptId: selection.attemptId },
      );
    }
  }
  const next = structuredClone(state);
  next.roughCuts = upsert(next.roughCuts, structuredClone(roughCut), (item) => item.id);
  return next;
}

export function projectPhase1Export(
  state: Phase1ControlPlaneProjection,
  artifact: Phase1ExportArtifact,
): Phase1ControlPlaneProjection {
  if (artifact.status === 'succeeded') {
    const roughCut = state.roughCuts.find(
      (item) => item.id === artifact.roughCutId && item.approvalStatus === 'approved',
    );
    const asset = state.assets.find((item) => item.id === artifact.assetId);
    if (!roughCut || !asset || !isValidPlayableAsset(asset)) {
      throw new Phase1ProductionError(
        'EXPORT_GATE_BLOCKED',
        '成功导出必须引用企业已确认 RoughCut 和真实可播放资产。',
        { exportId: artifact.id },
      );
    }
  }
  const next = structuredClone(state);
  next.exports = upsert(next.exports, structuredClone(artifact), (item) => item.id);
  return next;
}

export function isValidPlayableAsset(asset: Phase1MediaAsset) {
  return (
    (asset.assetType === 'video' || asset.assetType === 'export') &&
    asset.validationStatus === 'valid' &&
    typeof asset.playableUrl === 'string' &&
    asset.playableUrl.trim().length > 0 &&
    asset.mimeType.startsWith('video/') &&
    asset.durationSeconds > 0
  );
}

function creditPayload(command: Phase1CreditCommand) {
  return { ...command, occurredAt: undefined };
}

export function applyPhase1CreditCommand(
  state: Phase1ControlPlaneProjection,
  command: Phase1CreditCommand,
): { state: Phase1ControlPlaneProjection; duplicate: boolean } {
  const digest = digestValue(creditPayload(command));
  const processed = state.processedCreditCommands.find(
    (item) => item.idempotencyKey === command.idempotencyKey,
  );
  if (processed) {
    if (processed.payloadDigest !== digest) {
      throw new Phase1ProductionError(
        'IDEMPOTENCY_CONFLICT',
        '同一额度幂等键不能用于不同指令。',
        { idempotencyKey: command.idempotencyKey },
      );
    }
    return { state: structuredClone(state), duplicate: true };
  }

  const next = structuredClone(state);
  const allocation = next.creditAllocations.find(
    (item) => item.taskId === command.taskId && item.attemptId === command.attemptId,
  );
  if (command.type === 'reserve') {
    if (!Number.isInteger(command.credits) || command.credits <= 0 || allocation) {
      throw new Phase1ProductionError(
        'CREDIT_RESERVE_CONFLICT',
        '任务额度必须以正整数冻结一次。',
        { taskId: command.taskId },
      );
    }
    next.creditAllocations.push({
      taskId: command.taskId,
      attemptId: command.attemptId,
      reservationId: command.reservationId,
      status: 'reserved',
      reservedCredit: command.credits,
      consumedCredit: 0,
      releasedCredit: 0,
    });
    next.creditEntries.push({
      id: `${command.idempotencyKey}:reserve`,
      taskId: command.taskId,
      attemptId: command.attemptId,
      operation: 'reserve',
      amount: command.credits,
      idempotencyKey: command.idempotencyKey,
      occurredAt: command.occurredAt,
    });
  } else {
    if (!allocation || allocation.status !== 'reserved') {
      throw new Phase1ProductionError(
        'CREDIT_SETTLEMENT_CONFLICT',
        '只能结算处于 reserved 的同一 Task/Attempt。',
        { taskId: command.taskId, attemptId: command.attemptId },
      );
    }
    if (command.type === 'settle_success') {
      const task = next.tasks.find(
        (item) => item.id === command.taskId && item.attemptId === command.attemptId,
      );
      const playableAsset = next.assets.find(
        (item) =>
          item.generationTaskId === command.taskId &&
          item.attemptId === command.attemptId &&
          isValidPlayableAsset(item),
      );
      if (!task || !playableAsset || !task.outputAssetIds.includes(playableAsset.id)) {
        throw new Phase1ProductionError(
          'ASSET_NOT_PLAYABLE',
          '没有 valid playable Asset 时禁止消费额度或把任务标记为 succeeded。',
          { taskId: command.taskId },
        );
      }
      if (
        !Number.isInteger(command.actualCredits) ||
        command.actualCredits < 0 ||
        command.actualCredits > allocation.reservedCredit
      ) {
        throw new Phase1ProductionError(
          'CREDIT_SETTLEMENT_CONFLICT',
          '实际消费必须是不超过冻结额的非负整数。',
          { taskId: command.taskId },
        );
      }
      allocation.status = 'consumed';
      allocation.consumedCredit = command.actualCredits;
      allocation.releasedCredit = allocation.reservedCredit - command.actualCredits;
      task.status = 'succeeded';
      task.progress = 100;
      task.completedAt = command.occurredAt;
      next.creditEntries.push({
        id: `${command.idempotencyKey}:consume`,
        taskId: command.taskId,
        attemptId: command.attemptId,
        operation: 'consume',
        amount: allocation.consumedCredit,
        idempotencyKey: command.idempotencyKey,
        occurredAt: command.occurredAt,
      });
      if (allocation.releasedCredit > 0) {
        next.creditEntries.push({
          id: `${command.idempotencyKey}:release`,
          taskId: command.taskId,
          attemptId: command.attemptId,
          operation: 'release',
          amount: allocation.releasedCredit,
          idempotencyKey: command.idempotencyKey,
          occurredAt: command.occurredAt,
        });
      }
    } else {
      allocation.status = 'released';
      allocation.releasedCredit = allocation.reservedCredit;
      const task = next.tasks.find((item) => item.id === command.taskId);
      if (task) {
        task.status = command.type === 'settle_cancel' ? 'cancelled' : 'failed';
        task.completedAt = command.occurredAt;
      }
      next.creditEntries.push({
        id: `${command.idempotencyKey}:release`,
        taskId: command.taskId,
        attemptId: command.attemptId,
        operation: 'release',
        amount: allocation.reservedCredit,
        idempotencyKey: command.idempotencyKey,
        occurredAt: command.occurredAt,
      });
    }
  }
  next.processedCreditCommands.push({
    idempotencyKey: command.idempotencyKey,
    payloadDigest: digest,
  });
  return { state: next, duplicate: false };
}

function mapReceiptStatus(receipt: GenerationTaskReceipt): Phase1RuntimeTaskStatus {
  if (receipt.status === 'requested') return 'draft';
  if (receipt.status === 'succeeded') return 'validating';
  return receipt.status;
}

export function projectCanonicalReceipts(
  state: Phase1ControlPlaneProjection,
  input: {
    tasks: GenerationTaskReceipt[];
    assets: AssetReceipt[];
    exports: ExportReceipt[];
  },
): Phase1ControlPlaneProjection {
  let next = structuredClone(state);
  for (const receipt of input.tasks) {
    const shotId = stableShotId(receipt.projectId, receipt.shotId);
    const attemptId = `attempt:${receipt.generationTaskId}`;
    next = projectPhase1Task(next, {
      id: receipt.generationTaskId,
      shotId,
      attemptId,
      taskType: receipt.taskType,
      provider: receipt.provider,
      model: receipt.model,
      providerTaskId: null,
      status: mapReceiptStatus(receipt),
      progress: receipt.progress,
      outputAssetIds: [...receipt.outputAssetIds],
      idempotencyKey: receipt.idempotencyKey,
      error: receipt.error,
      createdAt: receipt.createdAt,
      completedAt: receipt.completedAt,
    });
    next = projectPhase1Attempt(next, {
      id: attemptId,
      shotId,
      generationTaskId: receipt.generationTaskId,
      attemptNumber:
        next.attempts.filter((item) => item.shotId === shotId && item.id !== attemptId).length + 1,
      parentAttemptId: null,
      assetId: receipt.outputAssetIds[0] ?? null,
      operatorDecision: 'undecided',
      createdAt: receipt.createdAt,
    });
  }
  for (const receipt of input.assets) {
    const attemptId = receipt.generationTaskId
      ? `attempt:${receipt.generationTaskId}`
      : `attempt:asset:${receipt.assetId}`;
    next = projectPhase1Asset(next, {
      id: receipt.assetId,
      projectId: receipt.projectId,
      shotId: stableShotId(receipt.projectId, receipt.shotId),
      attemptId,
      generationTaskId: receipt.generationTaskId ?? '',
      assetType: receipt.type,
      localPath: receipt.storageReference.startsWith('file:')
        ? receipt.storageReference
        : null,
      remoteUrl: /^https?:\/\//.test(receipt.storageReference)
        ? receipt.storageReference
        : null,
      playableUrl: null,
      mimeType: receipt.mimeType,
      durationSeconds: receipt.durationSeconds,
      sha256: receipt.checksum,
      validationStatus: 'pending',
      createdAt: receipt.createdAt,
    });
  }
  for (const receipt of input.exports) {
    next = projectPhase1Export(next, {
      id: receipt.exportId,
      projectId: receipt.projectId,
      roughCutId: null,
      assetId: receipt.outputAssetIds[0] ?? null,
      status: receipt.status === 'failed' ? 'failed' : 'blocked',
      provenanceTaskIds: [receipt.generationTaskId],
      createdAt: receipt.createdAt,
    });
  }
  return next;
}
