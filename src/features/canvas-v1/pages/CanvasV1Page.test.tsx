import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CanvasBootstrapV01,
  CanvasDocumentV01,
  CanvasEventV01,
  ShotReadinessV01,
} from '../model/contracts';
import { parseCanvasV1BrowserContract } from '../model/contracts';
import { useCanvasV1ViewState } from '../model/viewState';
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

function createBindableAsset(overrides: Partial<NonNullable<CanvasV1PageProps['assets']>[number]> = {}) {
  return {
    assetId,
    category: 'virtual_character' as const,
    displayName: '门店讲解员',
    rightsStatus: 'authorized' as const,
    approvalStatus: 'approved' as const,
    providerStatus: 'active' as const,
    entityBindingStatus: 'pending' as const,
    controlledPreviewUrl: null,
    targetEntityId: '16161616-1616-4616-8616-161616161616',
    ...overrides,
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
    prepareHighCostApproval: vi.fn<NonNullable<CanvasV1PageProps['prepareHighCostApproval']>>(async () => ({
      approvalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      status: 'active' as const,
    })),
    onCommand: vi.fn(),
    ...overrides,
  };
}

describe('CanvasV1Page workspace states', () => {
  beforeEach(() => {
    useCanvasV1ViewState.getState().resetView();
  });

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
    const prepareHighCostApproval = vi.fn<NonNullable<CanvasV1PageProps['prepareHighCostApproval']>>(async () => ({
      approvalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      status: 'active' as const,
    }));
    render(<CanvasV1Page {...createProps({ onCommand, prepareHighCostApproval })} />);

    await user.click(screen.getByRole('button', { name: '生成当前镜头' }));
    expect(onCommand).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '确认并继续' }));

    await waitFor(() => expect(onCommand).toHaveBeenCalledTimes(1));
    const dispatched = onCommand.mock.calls[0][0];
    expect(prepareHighCostApproval).toHaveBeenCalledWith({
      ...scope,
      requestedByActorId: '12121212-1212-4212-8212-121212121212',
      commandType: 'GENERATE_SHOT',
      action: { commandId: dispatched.commandId, payload: dispatched.payload },
    });
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

describe('CanvasV1Page interactions and safety', () => {
  beforeEach(() => {
    useCanvasV1ViewState.getState().resetView();
  });

  it('switches the production chain and inspector to the selected shot', async () => {
    const user = userEvent.setup();
    const secondShotId = '67676767-6767-4676-8676-676767676767';
    const secondReadinessId = 'cdcdcdcd-cdcd-4cdc-8dcd-cdcdcdcdcdcd';
    const secondShot: CanvasShotView = {
      ...createShot(),
      shotId: secondShotId,
      sequence: 2,
      title: '招牌套餐',
      scriptText: '接下来看看今天的招牌套餐。',
      storyboardText: '俯拍咖啡与甜点，手部入画。',
      readiness: { ...createReadiness(), shotId: secondShotId, readinessId: secondReadinessId },
    };
    const document = createDocument();
    document.shots.push({
      shotId: secondShotId,
      position: 1,
      selectedOutputAssetId: null,
      prompt: '俯拍招牌套餐，光线温暖。',
      updatedAt: '2026-08-14T02:01:00.000Z',
    });
    document.playlist.shotIds.push(secondShotId);
    render(<CanvasV1Page {...createProps({ document, shots: [createShot(), secondShot] })} />);

    await user.click(screen.getByRole('button', { name: /02.*招牌套餐/ }));

    expect(screen.getByRole('heading', { name: '招牌套餐', level: 1 })).toBeInTheDocument();
    expect(screen.getByDisplayValue('俯拍招牌套餐，光线温暖。')).toBeInTheDocument();
    expect(screen.getByText('俯拍咖啡与甜点，手部入画。')).toBeInTheDocument();
  });

  it('uses the edited prompt in a browser-safe command', async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(<CanvasV1Page {...createProps({ onCommand })} />);

    const prompt = screen.getByRole('textbox', { name: '生成提示' });
    await user.clear(prompt);
    await user.type(prompt, '镜头缓慢推进，店员自然介绍招牌套餐。');
    await user.click(screen.getByRole('button', { name: '生成当前镜头' }));
    await user.click(screen.getByRole('button', { name: '确认并继续' }));

    await waitFor(() => expect(onCommand).toHaveBeenCalledTimes(1));
    const command = onCommand.mock.calls[0][0];
    expect(command.payload).toEqual(expect.objectContaining({ prompt: '镜头缓慢推进，店员自然介绍招牌套餐。' }));
    expect(() => parseCanvasV1BrowserContract(command)).not.toThrow();
  });

  it('explains an authorization block and never dispatches generation', async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(<CanvasV1Page {...createProps({ onCommand, shots: [createShot(false)] })} />);

    expect(screen.getByText('等待真人授权')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成当前镜头' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '生成当前镜头' }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('ignores a legacy static approval and fails closed when dynamic approval preparation is unavailable', async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(<CanvasV1Page {...createProps({
      onCommand,
      prepareHighCostApproval: undefined,
      commandContext: { requestedByActorId: '12121212-1212-4212-8212-121212121212', approvalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' },
    })} />);

    expect(screen.getByText('生成确认服务当前不可用')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成当前镜头' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '生成当前镜头' }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('fails closed in the drawer and handler when dynamic binding approval preparation is unavailable', async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(
      <CanvasV1Page
        {...createProps({
          assets: [createBindableAsset()],
          onCommand,
          prepareHighCostApproval: undefined,
          commandContext: {
            requestedByActorId: '12121212-1212-4212-8212-121212121212',
            approvalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          },
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: '查看门店讲解员绑定' }));

    const bindButton = screen.getByRole('button', { name: '绑定到当前镜头' });
    expect(bindButton).toBeDisabled();
    await user.click(bindButton);
    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByText('操作确认服务当前不可用。')).toBeInTheDocument();
  });

  it('prepares the exact immutable BIND_ASSET_TO_ENTITY draft before dispatch', async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    const prepareHighCostApproval = vi.fn<NonNullable<CanvasV1PageProps['prepareHighCostApproval']>>(async () => ({
      approvalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      status: 'active' as const,
    }));
    render(<CanvasV1Page {...createProps({
      assets: [createBindableAsset()],
      onCommand,
      prepareHighCostApproval,
      commandContext: { requestedByActorId: '12121212-1212-4212-8212-121212121212', approvalId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    })} />);

    await user.click(screen.getByRole('button', { name: '查看门店讲解员绑定' }));
    await user.click(screen.getByRole('button', { name: '绑定到当前镜头' }));
    expect(onCommand).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '确认并继续' }));

    await waitFor(() => expect(onCommand).toHaveBeenCalledTimes(1));
    const dispatched = onCommand.mock.calls[0][0];
    expect(dispatched).toMatchObject({
      commandType: 'BIND_ASSET_TO_ENTITY',
      approvalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      payload: { assetId, entityId: '16161616-1616-4616-8616-161616161616' },
    });
    expect(prepareHighCostApproval.mock.calls[0][0].action).toEqual({
      commandId: dispatched.commandId,
      payload: dispatched.payload,
    });
  });

  it('prepares CREATE_VIRTUAL_CHARACTER from the authority prompt without exposing IDs in confirmation copy', async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    const prepareHighCostApproval = vi.fn<NonNullable<CanvasV1PageProps['prepareHighCostApproval']>>(async () => ({
      approvalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      status: 'active' as const,
    }));
    const asset = createBindableAsset({ providerStatus: 'processing' });
    render(<CanvasV1Page {...createProps({ assets: [asset], onCommand, prepareHighCostApproval })} />);

    await user.click(screen.getByRole('button', { name: '查看门店讲解员绑定' }));
    await user.click(screen.getByRole('button', { name: '创建虚拟人物' }));
    const dialog = screen.getByRole('dialog', { name: '确认创建虚拟人物' });
    expect(dialog).toHaveTextContent('门店讲解员 · 当前人物设定');
    expect(dialog).not.toHaveTextContent(assetId);
    await user.click(screen.getByRole('button', { name: '确认并继续' }));

    await waitFor(() => expect(onCommand).toHaveBeenCalledTimes(1));
    const dispatched = onCommand.mock.calls[0][0];
    expect(dispatched).toMatchObject({
      commandType: 'CREATE_VIRTUAL_CHARACTER',
      payload: {
        assetId,
        entityId: '16161616-1616-4616-8616-161616161616',
        prompt: '店员在明亮的门店入口介绍招牌套餐。',
      },
    });
    expect(prepareHighCostApproval.mock.calls[0][0].action).toEqual({ commandId: dispatched.commandId, payload: dispatched.payload });
  });

  it('prepares SELECT_SHOT_OUTPUT with the exact document version and candidate', async () => {
    const user = userEvent.setup();
    const outputAssetId = '19191919-1919-4919-8919-191919191919';
    const onCommand = vi.fn();
    const prepareHighCostApproval = vi.fn<NonNullable<CanvasV1PageProps['prepareHighCostApproval']>>(async () => ({
      approvalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      status: 'active' as const,
    }));
    const shot = createShot();
    shot.outputs = [{ assetId: outputAssetId, kind: 'image', previewUrl: '/api/canvas-v1/media/candidate.jpg', selected: false }];
    render(<CanvasV1Page {...createProps({ shots: [shot], onCommand, prepareHighCostApproval })} />);

    await user.click(screen.getByRole('button', { name: '选择此候选画面' }));
    await user.click(screen.getByRole('button', { name: '确认并继续' }));

    await waitFor(() => expect(onCommand).toHaveBeenCalledTimes(1));
    const dispatched = onCommand.mock.calls[0][0];
    expect(dispatched).toMatchObject({
      commandType: 'SELECT_SHOT_OUTPUT',
      payload: { shotId, outputAssetId, documentId: '77777777-7777-4777-8777-777777777777', expectedVersion: 4 },
    });
    expect(prepareHighCostApproval.mock.calls[0][0].action).toEqual({ commandId: dispatched.commandId, payload: dispatched.payload });
  });

  it('prepares EXPORT_PLAYLIST only when the bootstrap capability is available', async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    const prepareHighCostApproval = vi.fn<NonNullable<CanvasV1PageProps['prepareHighCostApproval']>>(async () => ({
      approvalId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      status: 'active' as const,
    }));
    const bootstrap = createBootstrap();
    bootstrap.capabilities = bootstrap.capabilities.map((entry) => entry.capability === 'playlist_export' ? { ...entry, available: true, reasonCode: null } : entry);
    render(<CanvasV1Page {...createProps({ bootstrap, onCommand, prepareHighCostApproval })} />);

    await user.click(screen.getByRole('button', { name: '导出成片' }));
    await user.click(screen.getByRole('button', { name: '确认并继续' }));

    await waitFor(() => expect(onCommand).toHaveBeenCalledTimes(1));
    const dispatched = onCommand.mock.calls[0][0];
    expect(dispatched).toMatchObject({
      commandType: 'EXPORT_PLAYLIST',
      payload: { documentId: '77777777-7777-4777-8777-777777777777', expectedVersion: 4 },
    });
    expect(prepareHighCostApproval.mock.calls[0][0].action).toEqual({ commandId: dispatched.commandId, payload: dispatched.payload });
  });

  it('restores the authority prompt when the same shot receives a newer document version', async () => {
    const user = userEvent.setup();
    const initialProps = createProps();
    const view = render(<CanvasV1Page {...initialProps} />);
    const prompt = screen.getByRole('textbox', { name: '生成提示' });

    await user.clear(prompt);
    await user.type(prompt, '当前版本内的本地编辑');
    view.rerender(<CanvasV1Page {...initialProps} saveState="saving" />);
    expect(screen.getByRole('textbox', { name: '生成提示' })).toHaveValue('当前版本内的本地编辑');

    const refreshedDocument = createDocument();
    refreshedDocument.version = 5;
    refreshedDocument.shots[0].prompt = '服务端刷新恢复提示';
    view.rerender(<CanvasV1Page {...initialProps} document={refreshedDocument} />);
    expect(screen.getByRole('textbox', { name: '生成提示' })).toHaveValue('服务端刷新恢复提示');
  });

  it.each([
    ['server asset URI', 'asset://server-only-preview'],
    ['data URI', 'data:image/svg+xml;base64,PHN2Zy8+'],
    ['blob URI', 'blob:https://example.test/private'],
    ['script URI', 'javascript:alert(1)'],
    ['external HTTPS URL', 'https://cdn.example.test/preview.jpg'],
    ['protocol-relative URL', '//cdn.example.test/preview.jpg'],
    ['signed URL', 'https://cdn.example.test/preview.jpg?X-Amz-Signature=secret'],
    ['credential URL', 'https://user:password@cdn.example.test/preview.jpg'],
  ])('keeps every media sink free of an unsafe %s', async (_label, unsafeUrl) => {
    const user = userEvent.setup();
    const shot = {
      ...createShot(),
      thumbnailUrl: unsafeUrl,
      outputs: [{
        assetId: '19191919-1919-4919-8919-191919191919',
        kind: 'image' as const,
        previewUrl: unsafeUrl,
        selected: true,
      }],
    };
    const asset = createBindableAsset({ controlledPreviewUrl: unsafeUrl });
    render(<CanvasV1Page {...createProps({ shots: [shot], assets: [asset] })} />);

    expect(document.querySelectorAll('img')).toHaveLength(0);
    expect(document.documentElement.outerHTML).not.toContain(unsafeUrl);
    await user.click(screen.getByRole('button', { name: '查看门店讲解员绑定' }));
    expect(document.querySelectorAll('img')).toHaveLength(0);
    expect(document.documentElement.outerHTML).not.toContain(unsafeUrl);
  });

  it('renders only same-origin absolute paths in every media sink', async () => {
    const user = userEvent.setup();
    const controlledUrl = '/api/canvas-v1/media/preview-safe.jpg';
    const shot = {
      ...createShot(),
      thumbnailUrl: controlledUrl,
      outputs: [{
        assetId: '19191919-1919-4919-8919-191919191919',
        kind: 'image' as const,
        previewUrl: controlledUrl,
        selected: true,
      }],
    };
    const asset = createBindableAsset({ controlledPreviewUrl: controlledUrl });
    render(<CanvasV1Page {...createProps({ shots: [shot], assets: [asset] })} />);

    expect(document.querySelectorAll(`img[src="${controlledUrl}"]`)).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: '查看门店讲解员绑定' }));
    expect(document.querySelectorAll(`img[src="${controlledUrl}"]`)).toHaveLength(5);
  });

  it('does not create a candidate asset when a task fails', () => {
    render(<CanvasV1Page {...createProps({ taskEvents: { [shotId]: createEvent('failed') } })} />);

    expect(screen.getByText('视频生成失败，请稍后重试。')).toBeInTheDocument();
    expect(screen.queryByAltText('门店开场候选画面')).not.toBeInTheDocument();
    expect(screen.getByText('生成后在这里选择候选画面')).toBeInTheDocument();
  });

  it('offers keyboard focus for the shot rail and primary action', async () => {
    const user = userEvent.setup();
    render(<CanvasV1Page {...createProps()} />);

    await user.tab();
    expect(screen.getByRole('button', { name: /01.*门店开场/ })).toHaveFocus();
    screen.getByRole('button', { name: '生成当前镜头' }).focus();
    expect(screen.getByRole('button', { name: '生成当前镜头' })).toHaveFocus();
  });

  it('does not write browser storage, log payloads, or render forbidden markers', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(<CanvasV1Page {...createProps()} />);

    const publicSurface = `${document.documentElement.outerHTML} ${window.location.href}`.toLowerCase();
    expect(publicSurface).not.toMatch(/asset:\/\/|bearer\s|x-amz-|x-tos-|access_token=|idempotencykey|providerassetid|projectgrant/);
    expect(setItem).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();

    setItem.mockRestore();
    consoleLog.mockRestore();
    consoleError.mockRestore();
  });
});
