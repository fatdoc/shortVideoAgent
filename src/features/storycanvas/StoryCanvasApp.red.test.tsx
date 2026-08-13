import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DemoProjectGrant } from '../../domain/controlPlane';
import { createMvpClient } from './mvpApi';
import { StoryCanvasApp } from './StoryCanvasApp';
import { StoryCanvasEditorHarness } from './StoryCanvasEditorHarness';

function createGrant(
  overrides: Partial<DemoProjectGrant> = {},
): DemoProjectGrant {
  const now = Date.now();
  return {
    grantId: 'grant-demo-local-001-v1',
    grantType: 'DEMO_PROJECT_GRANT',
    mock: true,
    truthMode: 'MOCK-CONTRACT',
    tenantId: 'tenant-demo-hdl',
    organizationId: 'tenant-demo-hdl',
    organizationType: 'TENANT',
    projectId: 'demo-local-001',
    packageId: 'package-demo-local-001-v1',
    packageVersion: 1,
    capabilityIds: ['cap-production-base-generation'],
    scopes: ['production.package.read', 'production.receipt.write'],
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
    mockHandle: 'mock-handle:grant-demo-local-001-v1',
    warning: 'DEMO ONLY · NOT A SIGNED TOKEN · DO NOT USE AS CREDENTIAL',
    ...overrides,
  };
}

function createBootstrapData() {
  return {
    production: {
      project: {
        projectId: 'demo-local-001',
        name: 'Demo Project',
      },
      package: {
        packageId: 'package-demo-local-001-v1',
        packageVersion: 1,
      },
      continuity: {
        shots: {},
        entities: {},
        events: [],
      },
      truthManifest: { entries: [] },
      links: {
        returnPath: '/enterprise/projects/demo-local-001',
      },
      projectId: 'demo-local-001',
    },
    shots: [
      {
        id: 0,
        internalId: 0,
        section: '章节 00',
        title: '示例镜头',
        shortTitle: '示例镜头',
        description: '示例镜头',
        imagePrompt: '一个基准主镜头，等待生成。',
        videoPrompt: '慢镜头，平稳推进。',
        screenText: '测试文本',
        duration: 4,
        status: 'sample',
        externalId: 'shot-07',
        sourceType: 'live',
        matchStatus: 'sample',
        assetId: 'asset-07',
        order: 0,
        range: '00:00–00:04',
      },
    ],
    continuity: {
      shots: {},
      entities: {},
      events: [],
      profile: { revision: 1 },
    },
    capabilities: {
      keyConfigured: true,
      image: { vendor: 'DemoGenerator', model: 'deterministic-demo-v1', available: true, truthMode: 'MOCK-CONTRACT' },
      video: { vendor: 'D1 Demo', model: 'mock-native', available: true, truthMode: 'MOCK-CONTRACT' },
    },
    productionTasks: [],
  };
}

function createMockEditorApi() {
  return {
    runDemoScenario: vi.fn(async () => ({
      task: {
        generationTaskId: 'task-shot-07',
        taskType: 'image.generate',
        shotId: 0,
        status: 'succeeded',
        progress: 100,
        error: null,
        errorCode: null,
        truthMode: 'MOCK-CONTRACT',
      },
    })),
  };
}

describe('StoryCanvasEditor (RED test for pure injected session/data)', () => {
  it('renders injected bootstrap, edits shot content, creates a shot, and records deterministic demo generation', async () => {
    const api = createMockEditorApi();
    render(
      <StoryCanvasEditorHarness api={api} bootstrap={createBootstrapData()} />,
    );

    expect(screen.getByRole('heading', { name: /镜头 00 · 示例镜头/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新增章节' })).toBeInTheDocument();

    const [imagePromptInput] = screen.getAllByRole('textbox') as HTMLTextAreaElement[];
    const user = userEvent.setup();
    await user.clear(imagePromptInput);
    await user.type(imagePromptInput, '编辑后的画面提示词');
    expect(imagePromptInput.value).toBe('编辑后的画面提示词');

    const generateButtons = screen.getAllByRole('button', { name: /(登记权益图卡|生成合规权益图卡|生成图片)/ });
    const regenerateButton = generateButtons.find((button) => button.className.includes('regenerate'));
    expect(regenerateButton).toBeTruthy();
    fireEvent.click(regenerateButton!);
    await waitFor(() => expect(api.runDemoScenario).toHaveBeenCalledWith('success'));
    expect(
      await screen.findByText(/MOCK-CONTRACT 任务、资产与回执已登记/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '新增章节' }));
    expect(screen.getByText('镜头数量：2')).toBeInTheDocument();
  });

  it('mounts only under explicit development/test harness guard', () => {
    expect(StoryCanvasEditorHarness).toBeDefined();
    const api = createMockEditorApi();
    render(<StoryCanvasEditorHarness api={api} bootstrap={createBootstrapData()} />);
    expect(screen.getByTestId('storycanvas-editor-harness')).toBeInTheDocument();
  });
});

describe('StoryCanvasApp wrapper', () => {
  it('bootstraps by in-memory grant and dispatches the production ready event', async () => {
    const api = {
      bootstrap: vi.fn(async () => createBootstrapData()),
    };
    const onReady = vi.fn();
    window.addEventListener('storycanvas:d1-ready', onReady);

    render(<StoryCanvasApp grant={createGrant()} api={api} />);
    await waitFor(() => expect(api.bootstrap).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('pilot-storycanvas-editor-loaded')).toBeInTheDocument();
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('storycanvas-app-forbidden')).not.toBeInTheDocument();
  });

  it('blocks invalid grants and does not invoke bootstrap', () => {
    const api = { bootstrap: vi.fn(async () => createBootstrapData()) };
    render(<StoryCanvasApp grant={createGrant({ projectId: 'project-other' })} api={api} />);
    expect(screen.getByTestId('storycanvas-app-forbidden')).toHaveTextContent('生产授权未通过');
    expect(screen.queryByTestId('storycanvas-app-loading')).not.toBeInTheDocument();
    expect(api.bootstrap).not.toHaveBeenCalled();
  });
});

describe('createMvpClient', () => {
  it('boots from injectable fetch without persisting to storage', async () => {
    const storageSpies = {
      localSet: vi.spyOn(window.localStorage, 'setItem'),
      localGet: vi.spyOn(window.localStorage, 'getItem'),
      localRemove: vi.spyOn(window.localStorage, 'removeItem'),
      sessionSet: vi.spyOn(window.sessionStorage, 'setItem'),
      sessionGet: vi.spyOn(window.sessionStorage, 'getItem'),
      sessionRemove: vi.spyOn(window.sessionStorage, 'removeItem'),
    };

    const responses = [
      new Response(
        JSON.stringify({ data: { token: 'mock-token' } }),
      ),
      new Response(
        JSON.stringify({
          data: {
            project: {
              internalProjectId: 'demo-local-001',
              projectId: 'demo-local-001',
            },
            shots: [],
          },
        }),
      ),
      new Response(
        JSON.stringify({
          data: [],
        }),
      ),
    ];
    const fetchImpl = vi.fn(() => Promise.resolve(responses.shift()));
    const api = createMvpClient({
      fetchImpl,
      staticApiBase: 'http://127.0.0.1:10588/api',
      projectId: 'demo-local-001',
      productionGrant: createGrant(),
    });

    await api.bootstrap();

    Object.values(storageSpies).forEach((spy) => expect(spy).not.toHaveBeenCalled());
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    vi.restoreAllMocks();
  });
});
