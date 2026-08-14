import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  SearchOutlined,
  VideoCameraOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Alert, Button, Empty, Input, Progress, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../components/project/project-workflow.css';
import { DEMO_PROJECT_ID, PROJECT_STATUS_LABEL, ROUTES } from '../../domain/constants';
import { selectTenantProjectDeliveryView } from '../../domain/controlPlaneDeliveryView';
import { selectTenantCommercialView } from '../../domain/controlPlaneViewModels';
import { summarizeWorkspace } from '../../domain/selectors';
import { DEMO_TENANT_ID } from '../../mocks/controlPlaneDemo';
import { useControlPlaneStore } from '../../stores/controlPlaneStore';
import { useProjectStore } from '../../stores/projectStore';

const shotStatusLabel = {
  matched: '素材已匹配',
  reshoot: '需要补拍',
  missing: '缺少素材',
  ai_placeholder: '待人工确认',
} as const;

export function DashboardPage() {
  const navigate = useNavigate();
  const workspace = useProjectStore((state) => state.workspace);
  const error = useProjectStore((state) => state.error);
  const loading = useProjectStore((state) => state.loading);
  const hydrate = useProjectStore((state) => state.hydrate);
  const clearError = useProjectStore((state) => state.clearError);
  const controlPlane = useControlPlaneStore((state) => state.snapshot);
  const lastReceiptSync = useControlPlaneStore((state) => state.lastReceiptSync);
  const controlPlaneError = useControlPlaneStore((state) => state.error);
  const [query, setQuery] = useState('');

  const summary = useMemo(() => summarizeWorkspace(workspace), [workspace]);
  const tenantView = useMemo(() => selectTenantCommercialView(controlPlane), [controlPlane]);
  const deliveryView = useMemo(
    () =>
      selectTenantProjectDeliveryView(controlPlane, {
        tenantId: DEMO_TENANT_ID,
        projectId: DEMO_PROJECT_ID,
        now: new Date().toISOString(),
        receiptSync: lastReceiptSync,
        error: controlPlaneError,
      }),
    [controlPlane, controlPlaneError, lastReceiptSync],
  );
  const activeEntitlementCount = tenantView.entitlements.filter(
    (entitlement) => entitlement.status === 'active',
  ).length;
  const assetById = useMemo(
    () => new Map(workspace.assets.map((asset) => [asset.id, asset])),
    [workspace.assets],
  );
  const storefrontAsset =
    workspace.assets.find((asset) => asset.tags.includes('门头') || asset.id.includes('storefront')) ??
    workspace.assets[0];
  const visibleShots = workspace.storyboard.filter((shot) => {
    const asset = shot.assetId ? assetById.get(shot.assetId) : undefined;
    const haystack = `${workspace.project.name} ${workspace.brief.merchantName} ${shot.description} ${asset?.name ?? ''}`;
    return haystack.toLowerCase().includes(query.trim().toLowerCase());
  });
  const blockingShots = workspace.storyboard.filter(
    (shot) => shot.matchStatus === 'missing' || shot.matchStatus === 'reshoot',
  );
  const approvedFacts = workspace.brand.facts.filter((fact) => fact.status === 'approved').length;
  const packageFactCount = workspace.brand.packages.reduce(
    (count, item) => count + item.claimIds.length,
    0,
  );
  const deliveryReady =
    deliveryView.package.status === 'ready' &&
    deliveryView.grant.status === 'active' &&
    deliveryView.transport.connected;
  const receiptIssueCount =
    deliveryView.receiptSync.rejected + deliveryView.receiptSync.ackError;

  const dueDays = Math.max(
    0,
    Math.ceil((new Date(workspace.project.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );

  return (
    <div className="project-workflow-page" data-testid="dashboard-page">
      <div className="project-page-toolbar">
        <div className="project-page-toolbar-copy">
          <Typography.Title level={3}>门店经营工作台</Typography.Title>
          <Typography.Text type="secondary">
            从门店建档、商品套餐、门店资产到获客任务，按真实工作区资料排队处理。
          </Typography.Text>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={() => navigate(ROUTES.projectNew)}
          data-testid="dashboard-new-project"
        >
          新建获客任务
        </Button>
      </div>

      {error ? (
        <Alert
          type="warning"
          showIcon
          closable
          onClose={clearError}
          message="最近一次工作区操作异常"
          description={error}
          action={
            <Button size="small" loading={loading} onClick={() => void hydrate()}>
              重新加载
            </Button>
          }
        />
      ) : null}

      <section className="store-workbench-hero" data-testid="dashboard-store-hero">
        <div className="store-hero-media">
          {storefrontAsset ? (
            <img src={storefrontAsset.thumbnail} alt={`${workspace.brief.merchantName} 门店素材`} />
          ) : (
            <div className="store-hero-empty">门店素材待配置</div>
          )}
        </div>
        <div className="store-hero-copy">
          <Typography.Text type="secondary">门店素材</Typography.Text>
          <Typography.Text type="secondary">{tenantView.tenant.displayName}</Typography.Text>
          <Typography.Title level={2}>{workspace.project.name}</Typography.Title>
          <Typography.Paragraph type="secondary">
            {workspace.brief.city || '城市待填写'} · {workspace.brief.address || '地址待填写'} ·{' '}
            {workspace.brief.platforms.join(' / ') || '平台待选择'}
          </Typography.Paragraph>
          <div className="store-progress-line">
            <span>门店资料</span>
            <Progress
              percent={summary.factCount ? Math.round((approvedFacts / summary.factCount) * 100) : 0}
              showInfo={false}
            />
            <strong>{approvedFacts}/{summary.factCount}</strong>
          </div>
          <div className="store-hero-facts">
            <span>商品套餐 {workspace.brand.packages.length}</span>
            <span>门店资产 {summary.assetCount}</span>
            <span>有效权益 {activeEntitlementCount}</span>
            <span>套餐事实引用 {packageFactCount}</span>
          </div>
        </div>
      </section>

      <section className="store-flow-strip" aria-label="门店经营链路">
        {[
          ['门店建档', `${approvedFacts}/${summary.factCount} 已确认`, <FileTextOutlined />],
          ['商品套餐', `${workspace.brand.packages.length} 项`, <FolderOpenOutlined />],
          ['门店资产', `${summary.matchedShots} 镜已匹配`, <VideoCameraOutlined />],
          ['获客任务', `${blockingShots.length} 项待处理`, <CheckCircleOutlined />],
        ].map(([label, meta, icon]) => (
          <button type="button" key={String(label)} className="store-flow-step">
            <span>{icon}</span>
            <strong>{label}</strong>
            <small>{meta}</small>
          </button>
        ))}
      </section>

      <section className="project-surface store-delivery-panel" data-testid="dashboard-delivery-status">
        <div className="project-section-heading">
          <div>
            <Typography.Title level={5}>门店资产入口</Typography.Title>
            <Typography.Text type="secondary">
              只展示安全投影后的结果；无真实生成结果时保持待配置。
            </Typography.Text>
          </div>
          <Tag color={deliveryReady ? 'green' : 'default'}>
            {deliveryReady ? '可进入资产工作流' : '待配置'}
          </Tag>
        </div>

        <div className="store-delivery-grid">
          <div>
            <Typography.Text type="secondary">生成状态</Typography.Text>
            <Typography.Text strong>
              {deliveryView.summary.uniqueTaskCount > 0
                ? `已生成 ${deliveryView.summary.succeeded}`
                : '没有可展示的生成结果'}
            </Typography.Text>
          </div>
          <div>
            <Typography.Text type="secondary">可交付素材</Typography.Text>
            <Typography.Text strong>
              可交付素材 {deliveryView.summary.deliverableAssetCount}
            </Typography.Text>
          </div>
          <div>
            <Typography.Text type="secondary">导出</Typography.Text>
            <Typography.Text strong>导出 {deliveryView.summary.exportCount}</Typography.Text>
          </div>
          <div>
            <Typography.Text type="secondary">回执确认</Typography.Text>
            <Typography.Text strong>{receiptIssueCount > 0 ? '回执确认待处理' : '无待处理'}</Typography.Text>
          </div>
        </div>

        {deliveryView.lastError ? (
          <Alert
            className="dashboard-delivery-error"
            type={deliveryView.lastError.retryable ? 'warning' : 'error'}
            showIcon
            message={`${deliveryView.lastError.code} · ${deliveryView.lastError.message}`}
            description={`可重试：${deliveryView.lastError.retryable ? '是' : '否'}`}
          />
        ) : null}
      </section>

      <div className="project-dashboard-grid store-dashboard-grid">
        <section className="project-surface" data-testid="dashboard-operations-queue">
          <div className="project-section-heading">
            <div>
              <Typography.Title level={5}>生产队列</Typography.Title>
              <Typography.Text type="secondary">按分镜、素材和风险状态推进获客内容。</Typography.Text>
            </div>
            <div className="project-list-tools">
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="搜索项目"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                style={{ width: 190 }}
              />
            </div>
          </div>

          {visibleShots.length ? (
            <div className="store-queue-table">
              <div className="store-queue-head">
                <span>内容</span>
                <span>类型</span>
                <span>状态</span>
                <span>负责人</span>
                <span>下一步</span>
              </div>
              {visibleShots.map((shot) => {
                const asset = shot.assetId ? assetById.get(shot.assetId) : undefined;
                const blocked = shot.matchStatus === 'missing' || shot.matchStatus === 'reshoot';
                return (
                  <div className="store-queue-row" key={shot.id} data-testid="dashboard-project-row">
                    <div className="store-queue-title">
                      {asset ? <img src={asset.thumbnail} alt="" /> : <span />}
                      <div>
                        <Typography.Text strong>{shot.description}</Typography.Text>
                        <Typography.Text type="secondary">
                          {workspace.brief.aspectRatio} · {shot.duration}s · {workspace.brief.cta || 'CTA 待填写'}
                        </Typography.Text>
                      </div>
                    </div>
                    <Typography.Text>探店视频</Typography.Text>
                    <Tag color={blocked ? 'orange' : 'green'}>{shotStatusLabel[shot.matchStatus]}</Tag>
                    <Typography.Text>{shot.assignee ?? workspace.project.owner}</Typography.Text>
                    <Button
                      onClick={() =>
                        navigate(blocked ? ROUTES.projectNew : ROUTES.script(DEMO_PROJECT_ID))
                      }
                      data-testid={blocked ? undefined : 'dashboard-open-project'}
                    >
                      {blocked ? '补齐资料' : '确认脚本'}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty description="没有匹配的项目" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button
                onClick={() => {
                  setQuery('');
                }}
              >
                清除筛选
              </Button>
            </Empty>
          )}
        </section>

        <aside className="project-surface" data-testid="dashboard-inspector">
          <div className="project-section-heading">
            <div>
              <Typography.Title level={5}>当前对象</Typography.Title>
              <Typography.Text type="secondary">来源、阻断原因和下一步。</Typography.Text>
            </div>
          </div>
          <div className="project-task-list">
            <div className="project-task-item">
              <span className="project-task-icon">
                <ClockCircleOutlined />
              </span>
              <span className="project-task-copy">
                <Typography.Text strong>项目状态</Typography.Text>
                <Typography.Text type="secondary">
                  {PROJECT_STATUS_LABEL[workspace.project.status] ?? workspace.project.status} · {dueDays} 天
                </Typography.Text>
              </span>
              <Tag>{workspace.project.owner}</Tag>
            </div>
            <div className="project-task-item">
              <span className="project-task-icon">
                <WarningOutlined />
              </span>
              <span className="project-task-copy">
                <Typography.Text strong>待确认</Typography.Text>
                <Typography.Text type="secondary">
                  {blockingShots.length > 0
                    ? blockingShots.map((shot) => shot.description).join('、')
                    : '暂无阻断项'}
                </Typography.Text>
              </span>
              <Tag color={blockingShots.length > 0 ? 'orange' : 'green'}>{blockingShots.length}</Tag>
            </div>
            <div className="project-task-item">
              <span className="project-task-icon">
                <ArrowRightOutlined />
              </span>
              <span className="project-task-copy">
                <Typography.Text strong>下一步</Typography.Text>
                <Typography.Text type="secondary">{summary.activeScriptName}</Typography.Text>
              </span>
              <Button onClick={() => navigate(ROUTES.script(DEMO_PROJECT_ID))}>
                去处理
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
