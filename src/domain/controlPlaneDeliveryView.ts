import {
  DEMO_DATA_LABEL,
  type ControlPlaneDemoState,
  type ControlPlaneErrorShape,
  type CreditReservation,
  type GenerationTaskReceipt,
  type GenerationTaskStatus,
  type ReceiptSyncResult,
  type StandardReceiptError,
  type StoryCanvasTransportPhase,
} from './controlPlane';

export const DELIVERY_EVIDENCE_DISCLAIMER = {
  dataMode: 'DEMO',
  truthMode: 'MOCK-CONTRACT',
  authority: 'NON_SERVER_SOURCE',
  label: DEMO_DATA_LABEL,
} as const;

export type DeliveryPackageStatus = 'missing' | 'ready' | 'expired';
export type DeliveryGrantStatus = 'missing' | 'active' | 'expired' | 'scope_mismatch';
export type DeliveryTransportStatus =
  'offline' | 'sending' | 'accepted' | 'duplicate' | 'rejected' | 'retryable';
export type DeliveryReceiptSyncStatus = 'idle' | 'clean' | 'partial_failure' | 'failed';
export type DeliveryCreditStatus = 'none' | 'reserved' | 'consumed' | 'released';
export type DeliveryAction =
  | 'create_package'
  | 'issue_grant'
  | 'dispatch_package'
  | 'retry_package'
  | 'sync_receipts'
  | 'retry_receipt_sync';

export interface SafeDeliveryError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface DeliveryCreditEvidence {
  status: DeliveryCreditStatus;
  reserved: number;
  consumed: number;
  released: number;
  unit: 'AI_VIDEO_CREDIT';
}

export interface TenantProjectDeliveryTaskView {
  generationTaskId: string;
  shotId: string;
  status: GenerationTaskStatus;
  terminalStatus: Extract<GenerationTaskStatus, 'succeeded' | 'failed' | 'cancelled'> | null;
  progress: number;
  assetEvidence: {
    total: number;
    registered: number;
    approved: number;
    qaBlocked: number;
  };
  exportEvidence: {
    total: number;
    succeeded: number;
    failed: number;
  };
  credit: DeliveryCreditEvidence;
  error: SafeDeliveryError | null;
}

export interface TenantProjectDeliveryView {
  scope: {
    tenantId: string;
    projectId: string;
  };
  package: {
    status: DeliveryPackageStatus;
    createdAt: string | null;
    expiresAt: string | null;
  };
  grant: {
    status: DeliveryGrantStatus;
    issuedAt: string | null;
    expiresAt: string | null;
  };
  transport: {
    status: DeliveryTransportStatus;
    connected: boolean;
    retryCount: number;
    lastAttemptAt: string | null;
    lastConnectedAt: string | null;
  };
  receiptSync: {
    status: DeliveryReceiptSyncStatus;
    accepted: number;
    duplicate: number;
    rejected: number;
    ackError: number;
  };
  tasks: TenantProjectDeliveryTaskView[];
  summary: {
    uniqueTaskCount: number;
    succeeded: number;
    failed: number;
    cancelled: number;
    inProgress: number;
    deliverableAssetCount: number;
    exportCount: number;
    credits: {
      reserved: number;
      consumed: number;
      released: number;
      unit: 'AI_VIDEO_CREDIT';
    };
  };
  lastError: SafeDeliveryError | null;
  availableActions: DeliveryAction[];
  disclaimer: typeof DELIVERY_EVIDENCE_DISCLAIMER;
}

export interface TenantProjectDeliveryViewInput {
  tenantId: string;
  projectId: string;
  now: string;
  receiptSync?: ReceiptSyncResult | null;
  error?: ControlPlaneErrorShape | StandardReceiptError | null;
}

const STATUS_RANK: Record<GenerationTaskStatus, number> = {
  requested: 0,
  queued: 1,
  running: 2,
  cancelled: 3,
  failed: 4,
  succeeded: 5,
};

function isExpired(expiresAt: string, now: string): boolean {
  return Date.parse(expiresAt) <= Date.parse(now);
}

function safeError(
  error: ControlPlaneErrorShape | StandardReceiptError | null | undefined,
): SafeDeliveryError | null {
  if (!error) return null;
  return {
    code: error.code,
    message: error.message,
    retryable: error.retryable,
  };
}

function selectLatestTaskReceipts(receipts: GenerationTaskReceipt[]): GenerationTaskReceipt[] {
  const latestByTask = new Map<string, GenerationTaskReceipt>();

  for (const receipt of receipts) {
    const current = latestByTask.get(receipt.generationTaskId);
    if (!current) {
      latestByTask.set(receipt.generationTaskId, receipt);
      continue;
    }

    const receiptTime = Date.parse(receipt.createdAt);
    const currentTime = Date.parse(current.createdAt);
    if (
      receiptTime > currentTime ||
      (receiptTime === currentTime && STATUS_RANK[receipt.status] > STATUS_RANK[current.status])
    ) {
      latestByTask.set(receipt.generationTaskId, receipt);
    }
  }

  return [...latestByTask.values()].sort((left, right) =>
    left.generationTaskId.localeCompare(right.generationTaskId),
  );
}

function selectCreditEvidence(reservations: CreditReservation[]): DeliveryCreditEvidence {
  const reserved = reservations.reduce(
    (total, reservation) =>
      total + (reservation.status === 'reserved' ? reservation.reservedCredits.value : 0),
    0,
  );
  const consumed = reservations.reduce(
    (total, reservation) => total + reservation.consumedCredits.value,
    0,
  );
  const released = reservations.reduce(
    (total, reservation) => total + reservation.releasedCredits.value,
    0,
  );
  const status: DeliveryCreditStatus =
    reserved > 0 ? 'reserved' : consumed > 0 ? 'consumed' : released > 0 ? 'released' : 'none';

  return {
    status,
    reserved,
    consumed,
    released,
    unit: 'AI_VIDEO_CREDIT',
  };
}

function mapTransportStatus(
  phase: StoryCanvasTransportPhase,
  error: StandardReceiptError | null,
): DeliveryTransportStatus {
  if (phase === 'offline') return 'offline';
  if (phase === 'connecting') return 'sending';
  if (phase === 'duplicate') return 'duplicate';
  if (['accepted', 'handoff_waiting', 'handoff_ready'].includes(phase)) return 'accepted';
  if (phase === 'retrying' || phase === 'handoff_timeout') return 'retryable';
  if (phase === 'error' || phase === 'rejected') {
    return error?.retryable ? 'retryable' : 'rejected';
  }
  return 'rejected';
}

function selectReceiptSync(receiptSync: ReceiptSyncResult | null | undefined) {
  if (!receiptSync) {
    return {
      status: 'idle' as const,
      accepted: 0,
      duplicate: 0,
      rejected: 0,
      ackError: 0,
    };
  }

  const accepted = receiptSync.items.filter((item) => item.status === 'accepted').length;
  const duplicate = receiptSync.items.filter((item) => item.status === 'duplicate').length;
  const rejected = receiptSync.items.filter((item) => item.status === 'rejected').length;
  const ackError = receiptSync.items.filter((item) => item.status === 'ack_error').length;
  const failed = rejected + ackError;
  const succeeded = accepted + duplicate;
  const status: DeliveryReceiptSyncStatus =
    failed === 0 ? 'clean' : succeeded === 0 ? 'failed' : 'partial_failure';

  return { status, accepted, duplicate, rejected, ackError };
}

function selectLastError(
  input: TenantProjectDeliveryViewInput,
  transportError: StandardReceiptError | null,
): SafeDeliveryError | null {
  if (input.error) return safeError(input.error);

  const failedSyncItem = [...(input.receiptSync?.items ?? [])]
    .reverse()
    .find((item) => item.status === 'rejected' || item.status === 'ack_error');
  if (failedSyncItem?.error) return safeError(failedSyncItem.error);

  return safeError(transportError);
}

function selectAvailableActions(input: {
  packageStatus: DeliveryPackageStatus;
  grantStatus: DeliveryGrantStatus;
  transportStatus: DeliveryTransportStatus;
  receiptSyncStatus: DeliveryReceiptSyncStatus;
}): DeliveryAction[] {
  if (input.packageStatus === 'missing' || input.packageStatus === 'expired') {
    return ['create_package'];
  }
  if (input.grantStatus !== 'active') {
    return ['issue_grant'];
  }

  const actions: DeliveryAction[] = [];
  if (input.transportStatus === 'offline') actions.push('dispatch_package');
  if (input.transportStatus === 'rejected' || input.transportStatus === 'retryable') {
    actions.push('retry_package');
  }
  if (
    input.transportStatus === 'accepted' ||
    input.transportStatus === 'duplicate' ||
    input.receiptSyncStatus !== 'idle'
  ) {
    actions.push('sync_receipts');
  }
  if (input.receiptSyncStatus === 'partial_failure' || input.receiptSyncStatus === 'failed') {
    actions.push('retry_receipt_sync');
  }
  return actions;
}

export function selectTenantProjectDeliveryView(
  snapshot: ControlPlaneDemoState,
  input: TenantProjectDeliveryViewInput,
): TenantProjectDeliveryView {
  const productionPackage =
    snapshot.package?.tenantId === input.tenantId && snapshot.package.projectId === input.projectId
      ? snapshot.package
      : null;
  const packageStatus: DeliveryPackageStatus = !productionPackage
    ? 'missing'
    : isExpired(productionPackage.expiresAt, input.now)
      ? 'expired'
      : 'ready';

  const packageGrantCandidates = productionPackage
    ? snapshot.grants.filter((grant) => grant.packageId === productionPackage.packageId)
    : [];
  const matchingGrants = packageGrantCandidates
    .filter((grant) => grant.tenantId === input.tenantId && grant.projectId === input.projectId)
    .sort((left, right) => Date.parse(right.issuedAt) - Date.parse(left.issuedAt));
  const currentGrant = matchingGrants[0] ?? null;
  const grantStatus: DeliveryGrantStatus = !productionPackage
    ? 'missing'
    : currentGrant
      ? isExpired(currentGrant.expiresAt, input.now)
        ? 'expired'
        : 'active'
      : packageGrantCandidates.length > 0
        ? 'scope_mismatch'
        : 'missing';

  const scopedReceipts = snapshot.generationTaskReceipts.filter(
    (receipt) => receipt.tenantId === input.tenantId && receipt.projectId === input.projectId,
  );
  const latestTaskReceipts = selectLatestTaskReceipts(scopedReceipts);
  const taskIds = new Set(latestTaskReceipts.map((receipt) => receipt.generationTaskId));
  const scopedAssets = snapshot.assetReceipts.filter(
    (receipt) =>
      receipt.tenantId === input.tenantId &&
      receipt.projectId === input.projectId &&
      receipt.generationTaskId !== null &&
      taskIds.has(receipt.generationTaskId),
  );
  const scopedExports = snapshot.exportReceipts.filter(
    (receipt) =>
      receipt.tenantId === input.tenantId &&
      receipt.projectId === input.projectId &&
      taskIds.has(receipt.generationTaskId),
  );
  const scopedReservations = snapshot.commercial.creditState.reservations.filter((reservation) =>
    taskIds.has(reservation.taskId),
  );

  const tasks = latestTaskReceipts.map<TenantProjectDeliveryTaskView>((receipt) => {
    const assets = scopedAssets.filter(
      (asset) => asset.generationTaskId === receipt.generationTaskId,
    );
    const exports = scopedExports.filter(
      (exportReceipt) => exportReceipt.generationTaskId === receipt.generationTaskId,
    );
    const reservations = scopedReservations.filter(
      (reservation) => reservation.taskId === receipt.generationTaskId,
    );
    const terminalStatus = ['succeeded', 'failed', 'cancelled'].includes(receipt.status)
      ? (receipt.status as TenantProjectDeliveryTaskView['terminalStatus'])
      : null;

    return {
      generationTaskId: receipt.generationTaskId,
      shotId: receipt.shotId,
      status: receipt.status,
      terminalStatus,
      progress: receipt.progress,
      assetEvidence: {
        total: assets.length,
        registered: assets.filter((asset) => asset.reviewStatus === 'registered').length,
        approved: assets.filter((asset) => asset.reviewStatus === 'approved').length,
        qaBlocked: assets.filter((asset) => asset.reviewStatus === 'qa_blocked').length,
      },
      exportEvidence: {
        total: exports.length,
        succeeded: exports.filter((exportReceipt) => exportReceipt.status === 'succeeded').length,
        failed: exports.filter((exportReceipt) => exportReceipt.status === 'failed').length,
      },
      credit: selectCreditEvidence(reservations),
      error: safeError(receipt.error),
    };
  });

  const runtimeTransport = input.receiptSync?.transport ?? snapshot.transport;
  const transportAppliesToProject =
    runtimeTransport.projectId === null || runtimeTransport.projectId === input.projectId;
  const transportStatus = transportAppliesToProject
    ? mapTransportStatus(runtimeTransport.phase, runtimeTransport.lastError)
    : 'offline';
  const receiptSync = selectReceiptSync(input.receiptSync);
  const credits = tasks.reduce(
    (total, task) => ({
      reserved: total.reserved + task.credit.reserved,
      consumed: total.consumed + task.credit.consumed,
      released: total.released + task.credit.released,
      unit: 'AI_VIDEO_CREDIT' as const,
    }),
    { reserved: 0, consumed: 0, released: 0, unit: 'AI_VIDEO_CREDIT' as const },
  );

  return {
    scope: {
      tenantId: input.tenantId,
      projectId: input.projectId,
    },
    package: {
      status: packageStatus,
      createdAt: productionPackage?.createdAt ?? null,
      expiresAt: productionPackage?.expiresAt ?? null,
    },
    grant: {
      status: grantStatus,
      issuedAt: currentGrant?.issuedAt ?? null,
      expiresAt: currentGrant?.expiresAt ?? null,
    },
    transport: {
      status: transportStatus,
      connected: transportAppliesToProject && runtimeTransport.connected,
      retryCount: transportAppliesToProject ? runtimeTransport.retryCount : 0,
      lastAttemptAt: transportAppliesToProject ? runtimeTransport.lastAttemptAt : null,
      lastConnectedAt: transportAppliesToProject ? runtimeTransport.lastConnectedAt : null,
    },
    receiptSync,
    tasks,
    summary: {
      uniqueTaskCount: tasks.length,
      succeeded: tasks.filter((task) => task.status === 'succeeded').length,
      failed: tasks.filter((task) => task.status === 'failed').length,
      cancelled: tasks.filter((task) => task.status === 'cancelled').length,
      inProgress: tasks.filter((task) => ['requested', 'queued', 'running'].includes(task.status))
        .length,
      deliverableAssetCount: scopedAssets.length,
      exportCount: scopedExports.length,
      credits,
    },
    lastError: selectLastError(
      input,
      transportAppliesToProject ? runtimeTransport.lastError : null,
    ),
    availableActions: selectAvailableActions({
      packageStatus,
      grantStatus,
      transportStatus,
      receiptSyncStatus: receiptSync.status,
    }),
    disclaimer: DELIVERY_EVIDENCE_DISCLAIMER,
  };
}
