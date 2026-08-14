import { Alert, Empty, Spin, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import type { PilotProject } from '../../services/pilotControlApi';
import {
  pilotContentProductionApi,
  type PilotContentProductionApi,
  type PilotProductionPackage,
} from '../../services/pilotContentProductionApi';
import '../pilot/v3-ops.css';

export type PilotTenantOverviewRouteKey = 'dashboard' | 'products';

type CapabilityApi = Pick<PilotContentProductionApi, 'listProductionPackages'>;

interface PilotTenantOverviewPageProps {
  routeKey: PilotTenantOverviewRouteKey;
  projects: PilotProject[];
  activeProjectId: string | null;
  contentApi?: CapabilityApi;
}

type PackageState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready'; packages: PilotProductionPackage[] }
  | { phase: 'invalid' }
  | { phase: 'error' };

function Dashboard({
  projects,
  activeProjectId,
}: Pick<PilotTenantOverviewPageProps, 'projects' | 'activeProjectId'>) {
  if (projects.length === 0) {
    return (
      <main className="v3-ops-page d1-page-stack" data-testid="pilot-dashboard-empty">
        <Typography.Title level={2}>企业工作台</Typography.Title>
        <Empty description="当前 Membership 没有服务端可见 Project" />
      </main>
    );
  }
  return (
    <main className="v3-ops-page d1-page-stack" data-testid="pilot-dashboard-real-projects">
      <header className="d1-page-header">
        <div>
          <Tag color="orange">REAL CONTROL PROJECTS</Tag>
          <Typography.Title level={2}>企业工作台</Typography.Title>
          <Typography.Paragraph type="secondary">
            仅汇总当前 Membership 从 Control API 获得的真实可见项目，不补充 Demo
            项目或虚构生产结果。
          </Typography.Paragraph>
        </div>
      </header>
      <section className="d1-surface">
        <div className="d1-section-heading">
          <div>
            <Typography.Title level={3}>项目概览</Typography.Title>
            <Typography.Paragraph type="secondary">
              共 {projects.length} 个真实可见项目
            </Typography.Paragraph>
          </div>
        </div>
        <div className="v3-ops-table">
          {projects.map((project) => (
            <div className="v3-ops-row" key={project.id}>
              <strong>{project.name}</strong>
              {project.id === activeProjectId ? <Tag color="orange">当前项目</Tag> : null}
              <span>{project.status}</span>
              <span>
                {project.platform} · {project.aspectRatio} · {project.targetDurationSeconds} 秒
              </span>
              <span>更新于 {project.updatedAt}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Products({
  activeProject,
  contentApi,
}: {
  activeProject: PilotProject | null;
  contentApi: CapabilityApi;
}) {
  const [state, setState] = useState<PackageState>({ phase: 'idle' });

  useEffect(() => {
    if (!activeProject) {
      setState({ phase: 'idle' });
      return;
    }
    const controller = new AbortController();
    let active = true;
    setState({ phase: 'loading' });
    void contentApi.listProductionPackages(activeProject.id, { signal: controller.signal }).then(
      (packages) => {
        if (!active) return;
        if (
          packages.some((candidate) => candidate.projectId !== activeProject.id) ||
          new Set(packages.map((candidate) => candidate.packageId)).size !== packages.length
        ) {
          setState({ phase: 'invalid' });
          return;
        }
        setState({ phase: 'ready', packages });
      },
      () => {
        if (active) setState({ phase: 'error' });
      },
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [activeProject, contentApi]);

  if (!activeProject) {
    return (
      <main className="v3-ops-page d1-page-stack" data-testid="pilot-products-no-active-project">
        <Typography.Title level={2}>生产能力</Typography.Title>
        <Empty description="未选择真实项目，无法读取 ProductionPackage 能力需求" />
      </main>
    );
  }
  if (state.phase === 'idle' || state.phase === 'loading') {
    return (
      <main className="v3-ops-page d1-page-stack" data-testid="pilot-products-loading">
        <Typography.Title level={2}>生产能力</Typography.Title>
        <div role="status">
          <Spin size="small" /> 正在读取真实 ProductionPackage…
        </div>
      </main>
    );
  }
  if (state.phase === 'invalid' || state.phase === 'error') {
    return (
      <main className="v3-ops-page d1-page-stack" data-testid="pilot-products-invalid">
        <Typography.Title level={2}>生产能力</Typography.Title>
        <Alert
          type="error"
          showIcon
          message="生产能力响应无法安全确认"
          description="页面已 fail closed，不会回退 Demo、缓存或推断购买状态。"
        />
      </main>
    );
  }
  return (
    <main className="v3-ops-page d1-page-stack" data-testid="pilot-products-real-capabilities">
      <header className="d1-page-header">
        <div>
          <Tag color="orange">REAL PACKAGE REQUIREMENTS</Tag>
          <Typography.Title level={2}>生产能力</Typography.Title>
          <Typography.Paragraph type="secondary">
            当前项目：{activeProject.name}
          </Typography.Paragraph>
        </div>
      </header>
      <Alert
        type="info"
        showIcon
        message="这里只展示 ProductionPackage 的生产能力需求"
        description="不代表已购买商品；不包含订单、价格、充值或支付状态。"
      />
      {state.packages.length === 0 ? (
        <section className="d1-surface" data-testid="pilot-products-empty">
          <Empty description="当前项目没有真实 ProductionPackage 候选，暂无可展示的生产能力需求" />
        </section>
      ) : (
        <section className="d1-surface">
          <Typography.Title level={3}>生产能力需求</Typography.Title>
          <div className="v3-ops-table">
            {state.packages.map((candidate) => (
              <div className="v3-ops-row" key={candidate.packageId}>
                <strong>Package v{candidate.packageVersion}</strong>
                <span>{candidate.status}</span>
                <span>
                  {candidate.capabilityRequirements.map((capability) => (
                    <Tag key={capability}>{capability}</Tag>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export function PilotTenantOverviewPage({
  routeKey,
  projects,
  activeProjectId,
  contentApi = pilotContentProductionApi,
}: PilotTenantOverviewPageProps) {
  if (routeKey === 'dashboard') {
    return <Dashboard projects={projects} activeProjectId={activeProjectId} />;
  }
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  return <Products activeProject={activeProject} contentApi={contentApi} />;
}
