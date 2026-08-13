import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type {
  CanvasBootstrapV01,
  CanvasDocumentV01,
  CanvasEventV01,
  ShotReadinessV01,
} from '../model/contracts';
import {
  CanvasV1Page,
  type CanvasShotView,
  type CanvasV1PageProps,
} from './CanvasV1Page';

const scope = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  packageId: '33333333-3333-4333-8333-333333333333',
  canvasSessionId: 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678',
} as const;

const shotId = '66666666-6666-4666-8666-666666666666';
const assetId = '88888888-8888-4888-8888-888888888888';
const readinessId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function createBootstrap(status: CanvasBootstrapV01['status'] = 'ready'): CanvasBootstrapV01 {
  return {
    ...scope,
    objectType: 'CanvasBootstrap',
    contractVersion: '0.1',
    status,
    approvedScript: {
      scriptId: '44444444-4444-4444-8444-444444444444',
      version: 3,
      status: 'approved',
    },
    approvedStoryboard: {
      storyboardId: '55555555-5555-4555-8555-555555555555',
      version: 2,
      status: 'approved',
    },
    document: {
      documentId: '77777777-7777-4777-8777-777777777777',
      version: 4,
    },
    assetSummaries: [
      {
        assetId,
        category: 'virtual_character',
        displayName: '门店讲解员',
        rightsStatus: 'authorized',
        approvalStatus: 'approved',
        providerStatus: 'active',
        entityBindingStatus: 'approved',
        controlledPreviewUrl: '/api/canvas-v1/assets/88888888-8888-4888-8888-888888888888/preview',
      },
    ],
    capabilities: [
      { capability: 'video_generation', available: true, reasonCode: null },
      { capability: 'playlist_export', available: false, reasonCode: 'CAPABILITY_UNAVAILABLE' },
    ],
    requestId: 'req-canvas-bootstrap-001',
    occurredAt: '2026-08-14T02:00:00.000Z',
  };
}

function createDocument(shots = true): CanvasDocumentV01 {
  return {
    ...scope,
    objectType: 'CanvasDocument',
    contractVersion: '0.1',
    documentId: '77777777-7777-4777-8777-777777777777',
    status: 'active',
    version: 4,
    shots: shots
      ? [
          {
            shotId,
            position: 0,
            selectedOutputAssetId: null,
            prompt: '店员在明亮的门店入口介绍招牌套餐。',
            updatedAt: '2026-08-14T02:01:00.000Z',
          },
        ]
      : [],
    playlist: { shotIds: shots ? [shotId] : [] },
    createdAt: '2026-08-14T01:30:00.000Z',
    updatedAt: '2026-08-14T02:01:00.000Z',
    occurredAt: '2026-08-14T02:01:00.000Z',
  };
}

function createReadiness(ready = true): ShotReadinessV01 {
  return {
    ...scope,
    objectType: 'ShotReadiness',
    contractVersion: '0.1',
    readinessId,
    shotId,
    ready,
    reasonCodes: ready ? [] : ['RIGHTS_PENDING'],
    script: {
      scriptId: '44444444-4444-4444-8444-444444444444',
      version: 3,
      current: true,
    },
    storyboard: {
      storyboardId: '55555555-5555-4555-8555-555555555555',
      version: 2,
      current: true,
    },
    requirements: [
      {
        requirementId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        assetId,
        scopeMatched: true,
        rightsStatus: ready ? 'authorized' : 'pending',
        approvalStatus: 'approved',
        providerStatus: 'active',
        entityBindingStatus: 'approved',
        capabilityAvailable: true,
        ready,
        reasonCodes: ready ? [] : ['RIGHTS_PENDING'],
      },
    ],
    evaluatedAt: '2026-08-14T01:55:00.000Z',
    occurredAt: '2026-08-14T01:55:00.000Z',
  };
}

function createShot(ready = true): CanvasShotView {
  return {
    shotId,
    sequence: 1,
    title: '门店开场',
    durationSeconds: 6,
    scriptText: '今天带你看一家藏在街角的宝藏咖啡店。',
    storyboardText: '店员站在门店入口，镜头缓慢推进。',
    readiness: createReadiness(ready),
    requiredAssetLabels: ['门店讲解员'],
    outputs: [],
  };
}

function createEvent(status: CanvasEventV01['status']): CanvasEventV01 {
  const failed = status === 'failed';
  const providerSubmitted = ['provider_submitted', 'task_created', 'output_registered', 'receipt_recorded'].includes(status);
  const taskCreated = ['task_created', 'output_registered', 'receipt_recorded'].includes(status);
  const outputRegistered = ['output_registered', 'receipt_recorded'].includes(status);
  const receiptRecorded = status === 'receipt_recorded';
  return {
    ...scope,
    objectType: 'CanvasEvent',
    contractVersion: '0.1',
    eventId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    commandId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    commandType: 'GENERATE_SHOT',
    status,
    providerSubmitted,
    taskCreated,
    outputRegistered,
    receiptRecorded,
    taskId: taskCreated ? '15151515-1515-4515-8515-151515151515' : null,
    outputAssetId: outputRegistered ? '13131313-1313-4313-8313-131313131313' : null,
    receiptId: receiptRecorded ? '14141414-1414-4414-8414-141414141414' : null,
    replayed: false,
    error: failed
      ? { code: 'CANVAS_PROVIDER_FAILED', message: '视频生成失败，请稍后重试。', retryable: true }
      : null,
    requestId: 'req-canvas-command-001',
    occurredAt: '2026-08-14T02:02:00.100Z',
  };
}

function createProps(overrides: Partial<CanvasV1PageProps> = {}): CanvasV1PageProps {
  return {
    loadState: 'loaded',
    bootstrap: createBootstrap(),
    document: createDocument(),
    shots: [createShot()],
    taskEvents: {},
    saveState: 'saved',
    commandContext: {
      requestedByActorId: '12121212-1212-4212-8212-121212121212',
      approvalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    },
    onCommand: vi.fn(),
    ...overrides,
  };
}

describe('CanvasV1Page workspace states', () => {
  it.each([
    ['loading', createProps({ loadState: 'loading', bootstrap: null, document: null, shots: [] }), '正在加载门店生产台'],
    ['empty', createProps({ document: createDocument(false), shots: [] }), '还没有可制作的镜头'],
    ['blocked', createProps({ bootstrap: createBootstrap('blocked'), shots: [createShot(false)] }), '等待真人授权'],
    ['ready', createProps(), '镜头已就绪，可以生成'],
    ['running', createProps({ taskEvents: { [shotId]: createEvent('task_created') } }), '正在生成镜头'],
    ['failed', createProps({ taskEvents: { [shotId]: createEvent('failed') } }), '视频生成失败，请稍后重试。'],
    ['conflict', createProps({ saveState: 'conflict' }), '画布版本已更新'],
  ] as const)('renders the %s state', (_state, props, expected) => {
    render(<CanvasV1Page {...props} />);

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('creates the frozen GENERATE_SHOT command payload from injected facts', async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(<CanvasV1Page {...createProps({ onCommand })} />);

    await user.click(screen.getByRole('button', { name: '生成当前镜头' }));

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        ...scope,
        objectType: 'CanvasCommand',
        contractVersion: '0.1',
        commandType: 'GENERATE_SHOT',
        requestedByActorId: '12121212-1212-4212-8212-121212121212',
        requestSource: 'user',
        approvalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        payload: {
          shotId,
          readinessId,
          prompt: '店员在明亮的门店入口介绍招牌套餐。',
          referenceAssetIds: [assetId],
        },
      }),
    );
  });
});
