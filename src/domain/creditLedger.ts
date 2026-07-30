import {
  DEMO_DATA_LABEL,
  type CreditCommand,
  type CreditLedgerEntry,
  type CreditReservation,
  type CreditState,
  type CreditTransitionResult,
  type DemoCreditValue,
} from './controlPlane';
import { digestValue } from './controlPlaneUtils';

const DEMO_ACTOR = 'control-plane-mock-adapter' as const;
const DEMO_WALLET_ID = 'wallet-demo-hdl-credit';
const DEMO_LOT_ID = 'lot-demo-foundation-1000';

export class CreditStateError extends Error {
  readonly code:
    | 'IDEMPOTENCY_CONFLICT'
    | 'INSUFFICIENT_CREDITS'
    | 'RESERVATION_NOT_FOUND'
    | 'RECEIPT_CONFLICT';
  readonly details: Record<string, string | number | boolean>;

  constructor(
    code:
      | 'IDEMPOTENCY_CONFLICT'
      | 'INSUFFICIENT_CREDITS'
      | 'RESERVATION_NOT_FOUND'
      | 'RECEIPT_CONFLICT',
    message: string,
    details: Record<string, string | number | boolean> = {},
  ) {
    super(message);
    this.name = 'CreditStateError';
    this.code = code;
    this.details = details;
  }
}

export function demoCredits(value: number): DemoCreditValue {
  if (!Number.isInteger(value)) {
    throw new CreditStateError(
      'RECEIPT_CONFLICT',
      'AI 视频额度必须使用整数。',
      { value },
    );
  }

  return {
    value,
    unit: 'AI_VIDEO_CREDIT',
    dataMode: 'DEMO',
    quoteStatus: 'NON_QUOTE',
    label: DEMO_DATA_LABEL,
  };
}

function entry(
  input: Omit<CreditLedgerEntry, 'delta' | 'actorType' | 'actorId' | 'disclaimer'> & {
    delta: number;
  },
): CreditLedgerEntry {
  return {
    ...input,
    delta: demoCredits(input.delta),
    actorType: 'DEMO_SYSTEM',
    actorId: DEMO_ACTOR,
    disclaimer: DEMO_DATA_LABEL,
  };
}

export function createDemoReadyCreditState(): CreditState {
  const issuedAt = '2026-07-30T00:00:00.000Z';
  const initialCredits = 1000;
  const postingGroupId = 'posting-demo-reset-001';
  const idempotencyKey = 'demo-ready-credit-issuance-v1';
  const issuanceEntries: CreditLedgerEntry[] = [
    entry({
      entryId: 'ledger-demo-issue-wallet',
      postingGroupId,
      accountId: DEMO_WALLET_ID,
      walletId: DEMO_WALLET_ID,
      bucket: 'available',
      delta: initialCredits,
      operation: 'DEMO_ISSUE_CREDIT',
      lotId: DEMO_LOT_ID,
      referenceType: 'DEMO_RESET',
      referenceId: 'DEMO_READY',
      reservationId: null,
      idempotencyKey,
      occurredAt: issuedAt,
      reasonCode: 'DEMO_FOUNDATION_SEED',
    }),
    entry({
      entryId: 'ledger-demo-issue-counterparty',
      postingGroupId,
      accountId: 'system:PURCHASE_ISSUANCE',
      walletId: DEMO_WALLET_ID,
      bucket: 'PURCHASE_ISSUANCE',
      delta: -initialCredits,
      operation: 'DEMO_ISSUE_CREDIT',
      lotId: DEMO_LOT_ID,
      referenceType: 'DEMO_RESET',
      referenceId: 'DEMO_READY',
      reservationId: null,
      idempotencyKey,
      occurredAt: issuedAt,
      reasonCode: 'DEMO_FOUNDATION_SEED',
    }),
  ];

  return {
    wallet: {
      walletId: DEMO_WALLET_ID,
      tenantId: 'tenant-demo-hdl',
      ownerContextType: 'TENANT',
      creditType: 'AI_VIDEO_CREDIT',
      status: 'active',
      available: demoCredits(initialCredits),
      reserved: demoCredits(0),
      createdAt: issuedAt,
      disclaimer: DEMO_DATA_LABEL,
    },
    lots: [
      {
        lotId: DEMO_LOT_ID,
        walletId: DEMO_WALLET_ID,
        sourceType: 'DEMO_ISSUANCE',
        sourceId: 'DEMO_READY',
        originalCredits: demoCredits(initialCredits),
        remainingAvailable: demoCredits(initialCredits),
        remainingReserved: demoCredits(0),
        issuedAt,
        expiresAt: '2027-07-30T00:00:00.000Z',
        transferPolicy: 'NON_TRANSFERABLE_DEMO',
        refundPolicy: 'NON_REFUNDABLE_DEMO',
        disclaimer: DEMO_DATA_LABEL,
      },
    ],
    ledger: issuanceEntries,
    reservations: [],
    processedCommands: [
      {
        idempotencyKey,
        payloadDigest: digestValue({ type: 'demo_ready_issuance', initialCredits }),
        postingGroupIds: [postingGroupId],
        processedAt: issuedAt,
      },
    ],
  };
}

function commandPayload(command: CreditCommand) {
  return {
    ...command,
    occurredAt: undefined,
  };
}

function findProcessed(
  state: CreditState,
  command: CreditCommand,
): CreditTransitionResult | null {
  const existing = state.processedCommands.find(
    (item) => item.idempotencyKey === command.idempotencyKey,
  );
  if (!existing) return null;

  const payloadDigest = digestValue(commandPayload(command));
  if (existing.payloadDigest !== payloadDigest) {
    throw new CreditStateError(
      'IDEMPOTENCY_CONFLICT',
      '同一幂等键不能用于不同额度指令。',
      { idempotencyKey: command.idempotencyKey },
    );
  }

  return {
    state: structuredClone(state),
    duplicate: true,
    postingGroupIds: [...existing.postingGroupIds],
  };
}

function appendCommand(
  state: CreditState,
  command: CreditCommand,
  entries: CreditLedgerEntry[],
  reservation: CreditReservation,
  postingGroupIds: string[],
): CreditTransitionResult {
  const next = structuredClone(state);
  next.ledger.push(...entries);
  next.reservations = next.reservations.filter(
    (item) => item.reservationId !== reservation.reservationId,
  );
  next.reservations.push(reservation);
  next.processedCommands.push({
    idempotencyKey: command.idempotencyKey,
    payloadDigest: digestValue(commandPayload(command)),
    postingGroupIds,
    processedAt: command.occurredAt,
  });
  projectBalances(next);

  return {
    state: next,
    duplicate: false,
    postingGroupIds,
  };
}

function projectBalances(state: CreditState) {
  const walletEntries = state.ledger.filter(
    (item) => item.accountId === state.wallet.walletId,
  );
  const available = walletEntries
    .filter((item) => item.bucket === 'available')
    .reduce((total, item) => total + item.delta.value, 0);
  const reserved = walletEntries
    .filter((item) => item.bucket === 'reserved')
    .reduce((total, item) => total + item.delta.value, 0);

  if (available < 0 || reserved < 0) {
    throw new CreditStateError(
      'RECEIPT_CONFLICT',
      '额度投影不能为负数。',
      { available, reserved },
    );
  }

  state.wallet.available = demoCredits(available);
  state.wallet.reserved = demoCredits(reserved);
  state.lots[0].remainingAvailable = demoCredits(available);
  state.lots[0].remainingReserved = demoCredits(reserved);
}

function applyReserve(
  state: CreditState,
  command: Extract<CreditCommand, { type: 'reserve' }>,
): CreditTransitionResult {
  if (command.credits <= 0 || !Number.isInteger(command.credits)) {
    throw new CreditStateError(
      'RECEIPT_CONFLICT',
      '冻结额度必须为正整数。',
      { credits: command.credits },
    );
  }
  if (state.wallet.available.value < command.credits) {
    throw new CreditStateError(
      'INSUFFICIENT_CREDITS',
      '可用 AI 视频额度不足，未进行部分冻结。',
      {
        available: state.wallet.available.value,
        required: command.credits,
        shortfall: command.credits - state.wallet.available.value,
      },
    );
  }
  if (state.reservations.some((item) => item.reservationId === command.reservationId)) {
    throw new CreditStateError(
      'RECEIPT_CONFLICT',
      'reservationId 已存在。',
      { reservationId: command.reservationId },
    );
  }

  const postingGroupId = `posting:${command.reservationId}:reserve`;
  const entries = [
    entry({
      entryId: `${postingGroupId}:available`,
      postingGroupId,
      accountId: state.wallet.walletId,
      walletId: state.wallet.walletId,
      bucket: 'available',
      delta: -command.credits,
      operation: 'RESERVE_CREDIT',
      lotId: state.lots[0].lotId,
      referenceType: 'GENERATION_TASK',
      referenceId: command.taskId,
      reservationId: command.reservationId,
      idempotencyKey: command.idempotencyKey,
      occurredAt: command.occurredAt,
      reasonCode: 'GENERATION_MAX_RESERVATION',
    }),
    entry({
      entryId: `${postingGroupId}:reserved`,
      postingGroupId,
      accountId: state.wallet.walletId,
      walletId: state.wallet.walletId,
      bucket: 'reserved',
      delta: command.credits,
      operation: 'RESERVE_CREDIT',
      lotId: state.lots[0].lotId,
      referenceType: 'GENERATION_TASK',
      referenceId: command.taskId,
      reservationId: command.reservationId,
      idempotencyKey: command.idempotencyKey,
      occurredAt: command.occurredAt,
      reasonCode: 'GENERATION_MAX_RESERVATION',
    }),
  ];
  const reservation: CreditReservation = {
    reservationId: command.reservationId,
    walletId: state.wallet.walletId,
    taskId: command.taskId,
    status: 'reserved',
    reservedCredits: demoCredits(command.credits),
    consumedCredits: demoCredits(0),
    releasedCredits: demoCredits(0),
    rateCardId: command.rateCardId,
    rateCardVersion: command.rateCardVersion,
    quoteSnapshotId: command.quoteSnapshotId,
    createdAt: command.occurredAt,
    updatedAt: command.occurredAt,
    disclaimer: DEMO_DATA_LABEL,
  };

  return appendCommand(
    state,
    command,
    entries,
    reservation,
    [postingGroupId],
  );
}

function getReserved(
  state: CreditState,
  reservationId: string,
  taskId: string,
): CreditReservation {
  const reservation = state.reservations.find(
    (item) => item.reservationId === reservationId && item.taskId === taskId,
  );
  if (!reservation) {
    throw new CreditStateError(
      'RESERVATION_NOT_FOUND',
      '找不到任务绑定的额度冻结记录。',
      { reservationId, taskId },
    );
  }
  if (reservation.status !== 'reserved') {
    throw new CreditStateError(
      'RECEIPT_CONFLICT',
      '额度冻结记录已经进入终态。',
      { reservationId, status: reservation.status },
    );
  }
  return reservation;
}

function applySuccess(
  state: CreditState,
  command: Extract<CreditCommand, { type: 'settle_success' }>,
): CreditTransitionResult {
  const current = getReserved(state, command.reservationId, command.taskId);
  const reserved = current.reservedCredits.value;
  if (
    command.actualCredits < 0 ||
    !Number.isInteger(command.actualCredits) ||
    command.actualCredits > reserved
  ) {
    throw new CreditStateError(
      'RECEIPT_CONFLICT',
      '实际消费必须是不超过冻结额的非负整数。',
      { actualCredits: command.actualCredits, reserved },
    );
  }

  const released = reserved - command.actualCredits;
  const consumeGroup = `posting:${command.reservationId}:consume`;
  const releaseGroup = `posting:${command.reservationId}:release-remainder`;
  const entries: CreditLedgerEntry[] = [];
  const postingGroupIds: string[] = [];

  if (command.actualCredits > 0) {
    postingGroupIds.push(consumeGroup);
    entries.push(
      entry({
        entryId: `${consumeGroup}:reserved`,
        postingGroupId: consumeGroup,
        accountId: state.wallet.walletId,
        walletId: state.wallet.walletId,
        bucket: 'reserved',
        delta: -command.actualCredits,
        operation: 'CONSUME_CREDIT',
        lotId: state.lots[0].lotId,
        referenceType: 'GENERATION_TASK',
        referenceId: command.taskId,
        reservationId: command.reservationId,
        idempotencyKey: command.idempotencyKey,
        occurredAt: command.occurredAt,
        reasonCode: 'DELIVERABLE_ASSET_REGISTERED',
      }),
      entry({
        entryId: `${consumeGroup}:sink`,
        postingGroupId: consumeGroup,
        accountId: 'system:CONSUMED_SINK',
        walletId: state.wallet.walletId,
        bucket: 'CONSUMED_SINK',
        delta: command.actualCredits,
        operation: 'CONSUME_CREDIT',
        lotId: state.lots[0].lotId,
        referenceType: 'GENERATION_TASK',
        referenceId: command.taskId,
        reservationId: command.reservationId,
        idempotencyKey: command.idempotencyKey,
        occurredAt: command.occurredAt,
        reasonCode: 'DELIVERABLE_ASSET_REGISTERED',
      }),
    );
  }

  if (released > 0) {
    postingGroupIds.push(releaseGroup);
    entries.push(
      entry({
        entryId: `${releaseGroup}:reserved`,
        postingGroupId: releaseGroup,
        accountId: state.wallet.walletId,
        walletId: state.wallet.walletId,
        bucket: 'reserved',
        delta: -released,
        operation: 'RELEASE_CREDIT',
        lotId: state.lots[0].lotId,
        referenceType: 'GENERATION_TASK',
        referenceId: command.taskId,
        reservationId: command.reservationId,
        idempotencyKey: command.idempotencyKey,
        occurredAt: command.occurredAt,
        reasonCode: 'UNUSED_RESERVATION_REMAINDER',
      }),
      entry({
        entryId: `${releaseGroup}:available`,
        postingGroupId: releaseGroup,
        accountId: state.wallet.walletId,
        walletId: state.wallet.walletId,
        bucket: 'available',
        delta: released,
        operation: 'RELEASE_CREDIT',
        lotId: state.lots[0].lotId,
        referenceType: 'GENERATION_TASK',
        referenceId: command.taskId,
        reservationId: command.reservationId,
        idempotencyKey: command.idempotencyKey,
        occurredAt: command.occurredAt,
        reasonCode: 'UNUSED_RESERVATION_REMAINDER',
      }),
    );
  }

  const reservation: CreditReservation = {
    ...current,
    status: 'consumed',
    consumedCredits: demoCredits(command.actualCredits),
    releasedCredits: demoCredits(released),
    updatedAt: command.occurredAt,
  };
  return appendCommand(state, command, entries, reservation, postingGroupIds);
}

function applyFailure(
  state: CreditState,
  command: Extract<CreditCommand, { type: 'settle_failure' }>,
): CreditTransitionResult {
  const current = getReserved(state, command.reservationId, command.taskId);
  const released = current.reservedCredits.value;
  const postingGroupId = `posting:${command.reservationId}:release-failure`;
  const entries = [
    entry({
      entryId: `${postingGroupId}:reserved`,
      postingGroupId,
      accountId: state.wallet.walletId,
      walletId: state.wallet.walletId,
      bucket: 'reserved',
      delta: -released,
      operation: 'RELEASE_CREDIT',
      lotId: state.lots[0].lotId,
      referenceType: 'GENERATION_TASK',
      referenceId: command.taskId,
      reservationId: command.reservationId,
      idempotencyKey: command.idempotencyKey,
      occurredAt: command.occurredAt,
      reasonCode: 'FAILED_WITHOUT_DELIVERABLE_ASSET',
    }),
    entry({
      entryId: `${postingGroupId}:available`,
      postingGroupId,
      accountId: state.wallet.walletId,
      walletId: state.wallet.walletId,
      bucket: 'available',
      delta: released,
      operation: 'RELEASE_CREDIT',
      lotId: state.lots[0].lotId,
      referenceType: 'GENERATION_TASK',
      referenceId: command.taskId,
      reservationId: command.reservationId,
      idempotencyKey: command.idempotencyKey,
      occurredAt: command.occurredAt,
      reasonCode: 'FAILED_WITHOUT_DELIVERABLE_ASSET',
    }),
  ];
  const reservation: CreditReservation = {
    ...current,
    status: 'released',
    consumedCredits: demoCredits(0),
    releasedCredits: demoCredits(released),
    updatedAt: command.occurredAt,
  };
  return appendCommand(
    state,
    command,
    entries,
    reservation,
    [postingGroupId],
  );
}

export function applyCreditCommand(
  state: CreditState,
  command: CreditCommand,
): CreditTransitionResult {
  const replay = findProcessed(state, command);
  if (replay) return replay;

  if (command.type === 'reserve') return applyReserve(state, command);
  if (command.type === 'settle_success') return applySuccess(state, command);
  return applyFailure(state, command);
}

export function rebuildWalletProjection(state: CreditState) {
  const next = structuredClone(state);
  projectBalances(next);
  return {
    available: next.wallet.available,
    reserved: next.wallet.reserved,
  };
}

export function validatePostingGroups(state: CreditState): boolean {
  const totals = new Map<string, number>();
  for (const ledgerEntry of state.ledger) {
    totals.set(
      ledgerEntry.postingGroupId,
      (totals.get(ledgerEntry.postingGroupId) ?? 0) + ledgerEntry.delta.value,
    );
  }
  return [...totals.values()].every((value) => value === 0);
}
