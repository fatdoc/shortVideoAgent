import { describe, expect, it } from 'vitest';
import {
  applyPhase1CreditCommand,
  createPhase1ControlPlaneProjection,
  isPhase1HandoffReady,
  projectPhase1Asset,
  projectPhase1Attempt,
  projectPhase1Task,
  recordPhase1Handoff,
  selectPhase1Attempt,
  type Phase1MediaAsset,
  type Phase1RuntimeTask,
  type Phase1ShotAttempt,
} from './phase1Production';
import {
  CAPABILITY_IDS,
  canonicalProjectProductionPackage,
  createCanonicalDemoGrant,
} from '../mocks/controlPlaneDemo';

const now = '2026-08-02T12:00:00.000Z';

function task(id: string, attemptId: string): Phase1RuntimeTask {
  return {
    id,
    shotId: 'demo-local-001:shot:shot-01',
    attemptId,
    taskType: 'video.generate',
    provider: 'MockProvider',
    model: 'mock-video-v1',
    providerTaskId: `provider:${id}`,
    status: 'validating',
    progress: 90,
    outputAssetIds: [`asset:${id}`],
    idempotencyKey: `task:${id}`,
    error: null,
    createdAt: now,
    completedAt: null,
  };
}

function attempt(id: string, taskId: string, number = 1): Phase1ShotAttempt {
  return {
    id,
    shotId: 'demo-local-001:shot:shot-01',
    generationTaskId: taskId,
    attemptNumber: number,
    parentAttemptId: number === 1 ? null : 'attempt-1',
    assetId: `asset:${taskId}`,
    operatorDecision: 'undecided',
    createdAt: now,
  };
}

function asset(taskId: string, attemptId: string, playable = true): Phase1MediaAsset {
  return {
    id: `asset:${taskId}`,
    projectId: 'demo-local-001',
    shotId: 'demo-local-001:shot:shot-01',
    attemptId,
    generationTaskId: taskId,
    assetType: 'video',
    localPath: null,
    remoteUrl: playable ? 'https://mock.invalid/video.mp4' : null,
    playableUrl: playable ? 'https://mock.invalid/video.mp4' : null,
    mimeType: 'video/mp4',
    durationSeconds: 5,
    sha256: 'sha256:test',
    validationStatus: playable ? 'valid' : 'missing',
    createdAt: now,
  };
}

describe('Phase1 root control-plane projection', () => {
  it('accepts duplicate package delivery and keeps stable shot identities', () => {
    const grant = createCanonicalDemoGrant(
      canonicalProjectProductionPackage,
      [CAPABILITY_IDS.baseGeneration],
      new Date('2026-08-02T12:00:00.000Z'),
    );
    const response = {
      status: 'accepted' as const,
      result: 'duplicate' as const,
      packageId: canonicalProjectProductionPackage.packageId,
      projectId: canonicalProjectProductionPackage.projectId,
      duplicate: true,
      deepLink: 'http://localhost:50188/production/canvas/demo-local-001',
    };
    const first = recordPhase1Handoff(createPhase1ControlPlaneProjection(), {
      productionPackage: canonicalProjectProductionPackage,
      grant,
      response,
      error: null,
      updatedAt: now,
    });
    const replay = recordPhase1Handoff(first, {
      productionPackage: canonicalProjectProductionPackage,
      grant,
      response,
      error: null,
      updatedAt: now,
    });

    expect(isPhase1HandoffReady(replay.handoffs[0])).toBe(true);
    expect(replay.shots).toHaveLength(8);
    expect(replay.shots.map((shot) => shot.id)).toEqual(first.shots.map((shot) => shot.id));
  });

  it('blocks consumption without a valid playable asset, then settles 120 as 100 + 20 idempotently', () => {
    let state = createPhase1ControlPlaneProjection();
    state = projectPhase1Task(state, task('task-1', 'attempt-1'));
    state = projectPhase1Attempt(state, attempt('attempt-1', 'task-1'));
    state = projectPhase1Asset(state, asset('task-1', 'attempt-1', false));
    const reserve = {
      type: 'reserve' as const,
      taskId: 'task-1',
      attemptId: 'attempt-1',
      reservationId: 'reservation-1',
      credits: 120,
      idempotencyKey: 'reserve-1',
      occurredAt: now,
    };
    const reserved = applyPhase1CreditCommand(state, reserve);
    expect(() =>
      applyPhase1CreditCommand(reserved.state, {
        type: 'settle_success',
        taskId: 'task-1',
        attemptId: 'attempt-1',
        actualCredits: 100,
        idempotencyKey: 'settle-1',
        occurredAt: now,
      }),
    ).toThrowError(/valid playable Asset/);

    state = projectPhase1Asset(reserved.state, asset('task-1', 'attempt-1'));
    const settled = applyPhase1CreditCommand(state, {
      type: 'settle_success',
      taskId: 'task-1',
      attemptId: 'attempt-1',
      actualCredits: 100,
      idempotencyKey: 'settle-1',
      occurredAt: now,
    });
    const replay = applyPhase1CreditCommand(settled.state, {
      type: 'settle_success',
      taskId: 'task-1',
      attemptId: 'attempt-1',
      actualCredits: 100,
      idempotencyKey: 'settle-1',
      occurredAt: '2026-08-02T12:05:00.000Z',
    });

    expect(settled.state.creditAllocations[0]).toMatchObject({
      status: 'consumed',
      reservedCredit: 120,
      consumedCredit: 100,
      releasedCredit: 20,
    });
    expect(replay.duplicate).toBe(true);
    expect(replay.state.creditEntries).toHaveLength(3);
  });

  it.each([
    ['settle_failure' as const, 'failed'],
    ['settle_cancel' as const, 'cancelled'],
  ])('releases the full reservation for %s', (type, expectedStatus) => {
    let state = projectPhase1Task(
      createPhase1ControlPlaneProjection(),
      task(`task-${type}`, `attempt-${type}`),
    );
    state = applyPhase1CreditCommand(state, {
      type: 'reserve',
      taskId: `task-${type}`,
      attemptId: `attempt-${type}`,
      reservationId: `reservation-${type}`,
      credits: 80,
      idempotencyKey: `reserve-${type}`,
      occurredAt: now,
    }).state;
    state = applyPhase1CreditCommand(state, {
      type,
      taskId: `task-${type}`,
      attemptId: `attempt-${type}`,
      idempotencyKey: `release-${type}`,
      occurredAt: now,
    }).state;

    expect(state.creditAllocations[0]).toMatchObject({
      status: 'released',
      consumedCredit: 0,
      releasedCredit: 80,
    });
    expect(state.tasks[0].status).toBe(expectedStatus);
  });

  it('keeps retry attempts independent and enforces one selected attempt per shot', () => {
    let state = createPhase1ControlPlaneProjection();
    state = projectPhase1Task(state, task('task-1', 'attempt-1'));
    state = projectPhase1Attempt(state, attempt('attempt-1', 'task-1'));
    state = projectPhase1Asset(state, asset('task-1', 'attempt-1'));
    state = projectPhase1Task(state, task('task-2', 'attempt-2'));
    state = projectPhase1Attempt(state, attempt('attempt-2', 'task-2', 2));
    state = projectPhase1Asset(state, asset('task-2', 'attempt-2'));

    state = selectPhase1Attempt(state, 'attempt-1');
    state = selectPhase1Attempt(state, 'attempt-2');

    expect(state.attempts.find((item) => item.id === 'attempt-1')?.operatorDecision).toBe(
      'alternative',
    );
    expect(state.attempts.find((item) => item.id === 'attempt-2')?.operatorDecision).toBe(
      'selected',
    );
    expect(state.creditAllocations).toHaveLength(0);
  });
});
