import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PilotProject } from '../../services/pilotControlApi';
import type {
  PilotBriefVersion,
  PilotContentProductionApi,
  PilotProductionEligibility,
  PilotScriptVersion,
  PilotStoryboardVersion,
} from '../../services/pilotContentProductionApi';
import { PilotProjectContentPage } from './PilotProjectContentPages';

const project: PilotProject = {
  id: 'project-alpha',
  name: '南门咖啡探店',
  status: 'active',
  platform: 'douyin',
  aspectRatio: '9:16',
  targetDurationSeconds: 30,
  createdBy: 'user-1',
  createdAt: '2026-08-14T00:00:00.000Z',
  updatedAt: '2026-08-14T00:00:00.000Z',
};

const eligibility: PilotProductionEligibility = {
  projectId: project.id,
  eligible: false,
  scriptVersionId: 'script-v2',
  scriptVersion: 2,
  storyboardVersionId: null,
  storyboardVersion: null,
  reasonCode: 'NO_STORYBOARD_VERSION',
  scriptApproval: null,
  storyboardApproval: null,
};

function brief(
  version: number,
  payload: PilotBriefVersion['payload'],
): PilotBriefVersion {
  return {
    id: `brief-${version}`,
    projectId: project.id,
    version,
    status: version === 2 ? 'approved' : 'superseded',
    payload,
    createdBy: 'user-1',
    createdAt: `2026-08-14T0${version}:00:00.000Z`,
  };
}

function script(version: number): PilotScriptVersion {
  return {
    id: `script-v${version}`,
    projectId: project.id,
    version,
    status: version === 2 ? 'approved' : 'superseded',
    payload: { title: `脚本 v${version}`, content: `真实脚本正文 ${version}` },
    createdBy: 'user-1',
    createdAt: `2026-08-14T0${version}:00:00.000Z`,
  };
}

function storyboard(): PilotStoryboardVersion {
  return {
    id: 'storyboard-v1',
    projectId: project.id,
    scriptVersionId: 'script-v2',
    version: 1,
    status: 'draft',
    shots: [
      {
        shotId: 'shot-1',
        sequence: 1,
        durationSeconds: 4,
        description: '门头建立镜头',
        sourceMode: 'uploaded',
      },
    ],
    draftProvenance: {
      draftRevisionId: 'revision-1',
      draftRevisionNumber: 1,
      previousDraftRevisionId: null,
      sourceCommandId: 'command-1',
      sourceReceiptId: 'receipt-1',
      generationPolicyVersion: 'policy-1',
      validationSummary: 'passed',
    },
    createdBy: 'user-1',
    createdAt: '2026-08-14T03:00:00.000Z',
  };
}

function contentApi(overrides: Partial<PilotContentProductionApi> = {}): PilotContentProductionApi {
  return {
    listBriefVersions: vi.fn().mockResolvedValue([
      brief(1, { merchantName: '旧门店', city: '上海', campaignGoal: '旧目标', brandFacts: [] }),
      brief(2, {
        merchantName: '南门咖啡',
        city: '郑州',
        campaignGoal: '到店核销',
        brandFacts: ['临街门店', '手冲咖啡'],
      }),
    ]),
    createBriefVersion: vi.fn(),
    listScriptVersions: vi.fn().mockResolvedValue([script(1), script(2)]),
    createScriptVersion: vi.fn(),
    createScriptApproval: vi.fn(),
    listStoryboardVersions: vi.fn().mockResolvedValue([storyboard()]),
    createStoryboardVersion: vi.fn(),
    createStoryboardApproval: vi.fn(),
    readProductionEligibility: vi.fn().mockResolvedValue(eligibility),
    createProductionPackage: vi.fn(),
    listProductionPackages: vi.fn().mockResolvedValue([]),
    readProductionPackage: vi.fn(),
    createCanvasEntry: vi.fn(),
    readCanvasEntry: vi.fn(),
    ...overrides,
  };
}

describe('PilotProjectContentPage real Control facts', () => {
  it('projects only the latest strict Brief safe fields into Brand Brain', async () => {
    render(
      <PilotProjectContentPage
        routeKey="brand"
        projectId={project.id}
        project={project}
        contentApi={contentApi()}
      />,
    );

    expect(await screen.findByTestId('pilot-brand-facts')).toHaveTextContent('南门咖啡');
    expect(screen.getByTestId('pilot-brand-facts')).toHaveTextContent('郑州');
    expect(screen.getByTestId('pilot-brand-facts')).toHaveTextContent('到店核销');
    expect(screen.getByTestId('pilot-brand-facts')).toHaveTextContent('手冲咖啡');
    expect(screen.queryByText('旧门店')).not.toBeInTheDocument();
  });

  it('fails closed instead of rendering a malformed latest Brief payload', async () => {
    const api = contentApi({
      listBriefVersions: vi.fn().mockResolvedValue([
        brief(3, {
          merchantName: '不应泄漏',
          city: ['malformed'],
          accessToken: 'raw-secret',
          brandFacts: [],
        }),
      ]),
    });

    render(
      <PilotProjectContentPage
        routeKey="brand"
        projectId={project.id}
        project={project}
        contentApi={api}
      />,
    );

    expect(await screen.findByTestId('pilot-brand-invalid-brief')).toHaveTextContent(
      'Brief 无法安全投影',
    );
    expect(document.body).not.toHaveTextContent('不应泄漏');
    expect(document.body).not.toHaveTextContent('raw-secret');
  });

  it('renders real Script, Storyboard and eligibility facts without inventing output', async () => {
    const api = contentApi();
    const view = render(
      <PilotProjectContentPage
        routeKey="script"
        projectId={project.id}
        project={project}
        contentApi={api}
      />,
    );

    expect(await screen.findByTestId('pilot-script-facts')).toHaveTextContent('脚本 v2');
    expect(screen.getByTestId('pilot-script-facts')).toHaveTextContent('真实脚本正文 2');

    view.rerender(
      <PilotProjectContentPage
        routeKey="storyboard"
        projectId={project.id}
        project={project}
        contentApi={api}
      />,
    );
    expect(await screen.findByTestId('pilot-storyboard-facts')).toHaveTextContent('门头建立镜头');

    view.rerender(
      <PilotProjectContentPage
        routeKey="production-tasks"
        projectId={project.id}
        project={project}
        contentApi={api}
      />,
    );
    expect(await screen.findByTestId('pilot-production-empty')).toHaveTextContent(
      'NO_STORYBOARD_VERSION',
    );
    expect(screen.getByTestId('pilot-production-empty')).toHaveTextContent('没有可验证的真实任务');
    expect(document.body).not.toHaveTextContent('task-001');
    expect(document.body).not.toHaveTextContent('output.mp4');
  });

  it('lists explicit package candidates and opens Canvas only after the operator selects one', async () => {
    const packageA = {
      objectType: 'ProjectProductionPackage' as const,
      contractVersion: '0.3' as const,
      projectId: project.id,
      packageId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      packageVersion: 1,
      scriptVersionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      storyboardVersionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      capabilityRequirements: ['video.generate' as const, 'media.export' as const],
      status: 'ready' as const,
      createdAt: '2026-08-14T01:00:00.000Z',
      expiresAt: '2026-08-14T02:00:00.000Z',
    };
    const packageB = {
      ...packageA,
      packageId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      packageVersion: 2,
    };
    const onOpenCanvas = vi.fn();

    render(
      <PilotProjectContentPage
        routeKey="production-inbox"
        projectId={project.id}
        project={project}
        contentApi={contentApi({
          listProductionPackages: vi.fn().mockResolvedValue([packageA, packageB]),
        })}
        onOpenCanvas={onOpenCanvas}
      />,
    );

    expect(await screen.findByTestId('pilot-production-packages')).toHaveTextContent(
      'Package v1',
    );
    expect(screen.getByTestId('pilot-production-packages')).toHaveTextContent('Package v2');
    expect(onOpenCanvas).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '选择 Package v2 进入画布' }));
    expect(onOpenCanvas).toHaveBeenCalledTimes(1);
    expect(onOpenCanvas).toHaveBeenCalledWith(packageB.packageId);
  });

  it('creates a real Project and its first strict Brief before activating it', async () => {
    const createdProject = { ...project, id: 'project-created' };
    const createProject = vi.fn().mockResolvedValue({ project: createdProject, replayed: false });
    const createBriefVersion = vi.fn().mockResolvedValue({
      value: {
        ...brief(1, {
          merchantName: '南门咖啡',
          city: '郑州',
          campaignGoal: '到店核销',
          brandFacts: ['手冲咖啡'],
        }),
        projectId: createdProject.id,
      },
      replayed: false,
    });
    const onProjectCreated = vi.fn().mockResolvedValue(undefined);

    render(
      <PilotProjectContentPage
        routeKey="project-create"
        projectId={null}
        project={null}
        controlApi={{ createProject }}
        contentApi={contentApi({ createBriefVersion })}
        createIdempotencyKey={() => 'stable-create-key'}
        onProjectCreated={onProjectCreated}
      />,
    );

    fireEvent.change(screen.getByLabelText('项目名称'), { target: { value: '南门咖啡探店' } });
    fireEvent.change(screen.getByLabelText('门店名称'), { target: { value: '南门咖啡' } });
    fireEvent.change(screen.getByLabelText('城市'), { target: { value: '郑州' } });
    fireEvent.change(screen.getByLabelText('获客目标'), { target: { value: '到店核销' } });
    fireEvent.change(screen.getByLabelText('品牌事实（每行一条）'), {
      target: { value: '手冲咖啡' },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建真实项目与 Brief' }));

    await waitFor(() => expect(createProject).toHaveBeenCalledTimes(1));
    expect(createProject).toHaveBeenCalledWith(
      {
        name: '南门咖啡探店',
        status: 'draft',
        platform: 'douyin',
        aspectRatio: '9:16',
        targetDurationSeconds: 30,
      },
      'stable-create-key:project',
    );
    expect(createBriefVersion).toHaveBeenCalledWith(
      'project-created',
      {
        payload: {
          merchantName: '南门咖啡',
          city: '郑州',
          campaignGoal: '到店核销',
          brandFacts: ['手冲咖啡'],
        },
      },
      'stable-create-key:brief',
    );
    expect(onProjectCreated).toHaveBeenCalledWith(createdProject);
  });

  it('fails closed when a project route has no exact server-visible Project', async () => {
    const api = contentApi();
    render(
      <PilotProjectContentPage
        routeKey="production-overview"
        projectId={null}
        project={null}
        contentApi={api}
      />,
    );

    expect(screen.getByTestId('pilot-project-content-no-scope')).toHaveTextContent(
      '未选择真实项目',
    );
    expect(api.listBriefVersions).not.toHaveBeenCalled();
    expect(api.readProductionEligibility).not.toHaveBeenCalled();
  });
});
