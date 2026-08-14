import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PilotProject } from '../../services/pilotControlApi';
import type {
  PilotContentProductionApi,
  PilotProductionPackage,
} from '../../services/pilotContentProductionApi';
import { PilotTenantOverviewPage } from './PilotTenantOverviewPages';

const activeProject: PilotProject = {
  id: '00b4826e-d2d9-58ca-9f88-999bc1013ccb',
  name: '[CANVAS_FULL_CASE_PROJECT] 街角咖啡探店',
  status: 'production',
  platform: 'douyin',
  aspectRatio: '9:16',
  targetDurationSeconds: 30,
  createdBy: '71000000-0000-4000-8000-000000000010',
  createdAt: '2026-08-14T01:00:00.000Z',
  updatedAt: '2026-08-14T02:00:00.000Z',
};

const secondProject: PilotProject = {
  ...activeProject,
  id: '10000000-0000-4000-8000-000000000002',
  name: '第二家真实门店',
  status: 'active',
};

const productionPackage: PilotProductionPackage = {
  objectType: 'ProjectProductionPackage',
  contractVersion: '0.3',
  projectId: activeProject.id,
  packageId: '366f7983-0c30-4017-ac71-3a0ef73311ce',
  packageVersion: 1,
  scriptVersionId: '71000000-0000-4000-8000-000000000020',
  storyboardVersionId: '72000000-0000-4000-8000-000000000020',
  capabilityRequirements: ['video.generate', 'audio.tts', 'media.export'],
  status: 'ready',
  createdAt: '2026-08-14T02:00:00.000Z',
  expiresAt: '2026-08-15T02:00:00.000Z',
};

function contentApi(packages: PilotProductionPackage[] = []) {
  return {
    listProductionPackages: vi.fn().mockResolvedValue(packages),
  } as Pick<PilotContentProductionApi, 'listProductionPackages'>;
}

describe('Pilot Tenant real overview pages', () => {
  it('renders only the current server-visible Project summaries and active case marker', () => {
    const api = contentApi();
    render(
      <PilotTenantOverviewPage
        routeKey="dashboard"
        projects={[activeProject, secondProject]}
        activeProjectId={activeProject.id}
        contentApi={api}
      />,
    );

    const page = screen.getByTestId('pilot-dashboard-real-projects');
    expect(page).toHaveTextContent('[CANVAS_FULL_CASE_PROJECT] 街角咖啡探店');
    expect(page).toHaveTextContent('第二家真实门店');
    expect(page).toHaveTextContent('当前项目');
    expect(page).toHaveTextContent('production');
    expect(page).toHaveTextContent('douyin');
    expect(page).not.toHaveTextContent('demo-local-001');
    expect(api.listProductionPackages).not.toHaveBeenCalled();
  });

  it('labels exact active-Project Package requirements as production capabilities only', async () => {
    const api = contentApi([productionPackage]);
    render(
      <PilotTenantOverviewPage
        routeKey="products"
        projects={[activeProject]}
        activeProjectId={activeProject.id}
        contentApi={api}
      />,
    );

    const page = await screen.findByTestId('pilot-products-real-capabilities');
    expect(page).toHaveTextContent('生产能力需求');
    expect(page).toHaveTextContent('video.generate');
    expect(page).toHaveTextContent('audio.tts');
    expect(page).toHaveTextContent('media.export');
    expect(page).toHaveTextContent('不代表已购买商品');
    expect(page).toHaveTextContent('不包含订单、价格、充值或支付状态');
    expect(api.listProductionPackages).toHaveBeenCalledWith(
      activeProject.id,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('shows honest real empty states without guessing a Project or capability', async () => {
    const noProjectApi = contentApi([productionPackage]);
    const view = render(
      <PilotTenantOverviewPage
        routeKey="products"
        projects={[]}
        activeProjectId={null}
        contentApi={noProjectApi}
      />,
    );
    expect(screen.getByTestId('pilot-products-no-active-project')).toHaveTextContent(
      '未选择真实项目',
    );
    expect(noProjectApi.listProductionPackages).not.toHaveBeenCalled();

    const emptyApi = contentApi([]);
    view.rerender(
      <PilotTenantOverviewPage
        routeKey="products"
        projects={[activeProject]}
        activeProjectId={activeProject.id}
        contentApi={emptyApi}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('pilot-products-empty')).toHaveTextContent(
        '没有真实 ProductionPackage 候选',
      );
    });
  });

  it('fails closed for a Package outside the explicitly active Project', async () => {
    const api = contentApi([{ ...productionPackage, projectId: secondProject.id }]);
    render(
      <PilotTenantOverviewPage
        routeKey="products"
        projects={[activeProject, secondProject]}
        activeProjectId={activeProject.id}
        contentApi={api}
      />,
    );
    expect(await screen.findByTestId('pilot-products-invalid')).toHaveTextContent(
      '生产能力响应无法安全确认',
    );
    expect(document.body).not.toHaveTextContent('video.generate');
  });
});
