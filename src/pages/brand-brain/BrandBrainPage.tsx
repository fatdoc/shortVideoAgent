import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  FileTextOutlined,
  MoreOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Alert, App, Button, Dropdown, Select, Tabs, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BrandEditorDrawer, BrandFactsTable } from '../../components/brand';
import '../../components/brand/brand-brain.css';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { DEMO_PROJECT_ID, ROUTES } from '../../domain/constants';
import { canAccessDemoPermission } from '../../domain/demoIdentity';
import { isDemoProject } from '../../domain/selectors';
import type { BrandProfile, ClaimStatus } from '../../domain/types';
import { useAuthStore } from '../../stores/authStore';
import { useProjectStore } from '../../stores/projectStore';

function cloneBrand(brand: BrandProfile): BrandProfile {
  return structuredClone(brand);
}

function formatDate(value: string | undefined) {
  if (!value) return '未设置';
  return value.slice(0, 10);
}

export function BrandBrainPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { projectId } = useParams();
  const identity = useAuthStore((state) => state.identity);
  const workspace = useProjectStore((state) => state.workspace);
  const loading = useProjectStore((state) => state.loading);
  const error = useProjectStore((state) => state.error);
  const lastAction = useProjectStore((state) => state.lastAction);
  const updateBrand = useProjectStore((state) => state.updateBrand);
  const hydrate = useProjectStore((state) => state.hydrate);
  const clearError = useProjectStore((state) => state.clearError);

  const [draft, setDraft] = useState(() => cloneBrand(workspace.brand));
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const validProject = isDemoProject(projectId) || projectId === DEMO_PROJECT_ID;
  const canManageBrand = canAccessDemoPermission(identity, 'enterprise.brand-manage');

  useEffect(() => {
    if (!dirty && lastAction === 'reset') {
      setDraft(cloneBrand(workspace.brand));
    }
  }, [dirty, lastAction, workspace.brand]);

  const brandProjectOptions = useMemo(
    () => [
      {
        value: workspace.project.id,
        label: draft.merchant || workspace.project.name,
      },
    ],
    [draft.merchant, workspace.project.id, workspace.project.name],
  );

  const storePhoto =
    workspace.assets.find((asset) => asset.tags.includes('门头') || asset.id.includes('storefront')) ??
    workspace.assets[0];
  const sourceNames = Array.from(new Set(draft.facts.map((fact) => fact.source))).filter(Boolean);
  const approvedFacts = draft.facts.filter((fact) => fact.status === 'approved').length;
  const pendingFacts = draft.facts.filter((fact) => fact.status !== 'approved').length;
  const factExpiry =
    draft.facts.find((fact) => fact.validUntil)?.validUntil ?? '未设置统一失效日期';
  const packageClaims = new Set(draft.packages.flatMap((item) => item.claimIds));

  const markDraft = (next: BrandProfile) => {
    if (!canManageBrand) return;
    setDraft(next);
    setDirty(true);
    setSaved(false);
  };

  const saveBrand = async () => {
    if (!canManageBrand) {
      message.warning('当前身份仅可查看品牌资料。');
      return false;
    }
    await updateBrand(draft);
    if (useProjectStore.getState().error) return false;
    setDraft(cloneBrand(useProjectStore.getState().workspace.brand));
    setDirty(false);
    setSaved(true);
    setEditorOpen(false);
    message.success('门店档案已保存到统一工作区');
    return true;
  };

  const changeFactStatus = (claimId: string, status: ClaimStatus) => {
    markDraft({
      ...draft,
      facts: draft.facts.map((fact) => (fact.id === claimId ? { ...fact, status } : fact)),
    });
  };

  const handleProjectSwitch = (nextProjectId: string) => {
    if (nextProjectId === workspace.project.id) return;
    navigate(ROUTES.brand(nextProjectId));
  };

  const proceedToScript = async () => {
    if (dirty && canManageBrand) {
      const savedSuccessfully = await saveBrand();
      if (!savedSuccessfully) return;
    }
    navigate(ROUTES.script(DEMO_PROJECT_ID));
  };

  if (projectId && !validProject) {
    return (
      <ErrorState
        title="品牌项目不存在"
        subTitle={`仅支持统一 Demo 项目 ${DEMO_PROJECT_ID}，当前为 ${projectId}`}
        onRetry={() => navigate(ROUTES.brand(DEMO_PROJECT_ID))}
        retryLabel="打开 Demo 品牌大脑"
      />
    );
  }

  if (!draft.merchant && draft.facts.length === 0) {
    return (
      <EmptyState
        description="暂无品牌资料，请先完成 Brief 或重置 Demo"
        actionLabel="重新加载工作区"
        onAction={() => void hydrate()}
        loading={loading}
      />
    );
  }

  const renderStoreProfile = () => (
    <div className="brand-v3-grid">
      <section className="brand-panel brand-v3-store-card">
        {storePhoto ? (
          <img
            src={storePhoto.thumbnail}
            alt={`${draft.merchant} 门店素材`}
            data-testid="brand-store-photo"
          />
        ) : (
          <div className="brand-v3-photo-empty" data-testid="brand-store-photo">
            门店素材待配置
          </div>
        )}
        <div className="brand-v3-store-copy">
          <Typography.Title level={3}>{draft.merchant}</Typography.Title>
          <Tag color={pendingFacts > 0 ? 'orange' : 'green'}>
            {pendingFacts > 0 ? '待复核' : '已验证'}
          </Tag>
        </div>
        <dl className="brand-v3-definition-list">
          <dt>门店地址</dt>
          <dd>{workspace.brief.city && workspace.brief.address ? `${workspace.brief.city} · ${workspace.brief.address}` : '待填写'}</dd>
          <dt>目标平台</dt>
          <dd>{workspace.brief.platforms.join(' / ') || '待选择'}</dd>
          <dt>目标 CTA</dt>
          <dd>{workspace.brief.cta || '待填写'}</dd>
          <dt>资料负责人</dt>
          <dd>{draft.personProfile.name || workspace.project.owner}</dd>
        </dl>
        <div className="brand-v3-package-mini">
          {draft.packages.map((item) => (
            <span key={item.id}>{item.name}</span>
          ))}
        </div>
        {canManageBrand ? (
          <Button icon={<EditOutlined />} onClick={() => setEditorOpen(true)}>
            编辑档案
          </Button>
        ) : null}
      </section>

      <section className="brand-panel brand-v3-main-table" data-testid="brand-facts-panel">
        <div className="brand-panel-heading">
          <div>
            <Typography.Title level={5}>经营事实</Typography.Title>
            <Typography.Text type="secondary">
              已确认事实会进入脚本引用；待复核事实只作为阻断提醒。
            </Typography.Text>
          </div>
          <Tag>{approvedFacts}/{draft.facts.length} 已确认</Tag>
        </div>
        <div className="brand-v3-fact-rows">
          {draft.facts.map((fact) => (
            <div className="brand-v3-fact-row" key={fact.id}>
              <Tag color={fact.status === 'approved' ? 'green' : 'orange'}>{fact.id}</Tag>
              <Typography.Text>{fact.text}</Typography.Text>
              <Typography.Text type="secondary">{fact.source}</Typography.Text>
              <Typography.Text type="secondary">{fact.validUntil ? `至 ${formatDate(fact.validUntil)}` : '长期/待配置'}</Typography.Text>
            </div>
          ))}
        </div>
      </section>

      <aside className="brand-panel brand-v3-inspector">
        <div className="brand-v3-inspector-block">
          <Typography.Title level={5}>资料来源</Typography.Title>
          <dl className="brand-v3-definition-list">
            <dt>信息来源</dt>
            <dd>{sourceNames.join(' / ') || '待配置'}</dd>
            <dt>最近更新</dt>
            <dd>{formatDate(workspace.project.updatedAt)}</dd>
            <dt>审批状态</dt>
            <dd>{pendingFacts > 0 ? `${pendingFacts} 条待复核` : '审核通过'}</dd>
          </dl>
        </div>
        <div className="brand-v3-inspector-block">
          <Typography.Title level={5}>有效期</Typography.Title>
          <dl className="brand-v3-definition-list">
            <dt>生效时间</dt>
            <dd>{formatDate(workspace.project.createdAt)}</dd>
            <dt>失效时间</dt>
            <dd>{factExpiry}</dd>
            <dt>到期提醒</dt>
            <dd>{factExpiry === '未设置统一失效日期' ? '待配置' : '到期前复核'}</dd>
          </dl>
        </div>
        <div className="brand-v3-inspector-block">
          <Typography.Title level={5}>变更记录</Typography.Title>
          <div className="brand-v3-timeline">
            <span><ClockCircleOutlined /> 更新项目资料 · {formatDate(workspace.project.updatedAt)}</span>
            <span><FileTextOutlined /> 当前事实 {draft.facts.length} 条</span>
            <span><SafetyCertificateOutlined /> 套餐引用事实 {packageClaims.size} 条</span>
          </div>
        </div>
      </aside>
    </div>
  );

  const renderPackagesPanel = () => (
    <section className="brand-panel brand-panel-wide">
      <div className="brand-panel-heading">
        <div>
          <Typography.Title level={5}>商品套餐</Typography.Title>
          <Typography.Text type="secondary">只展示品牌档案中已登记的套餐和事实引用。</Typography.Text>
        </div>
        {canManageBrand ? (
          <Button icon={<EditOutlined />} onClick={() => setEditorOpen(true)}>
            管理套餐
          </Button>
        ) : null}
      </div>
      <div className="brand-package-table">
        <div className="brand-package-table-head">
          <span>名称</span>
          <span>价格</span>
          <span>权益/卖点</span>
          <span>事实引用</span>
        </div>
        {draft.packages.map((item) => (
          <div className="brand-package-row" key={item.id}>
            <Typography.Text strong>{item.name}</Typography.Text>
            <span className="brand-package-price">¥{item.price}</span>
            <Typography.Text>{item.description}</Typography.Text>
            <Typography.Text type="secondary">{item.claimIds.join('、') || '待绑定'}</Typography.Text>
          </div>
        ))}
      </div>
    </section>
  );

  const renderRulesPanel = () => (
    <div className="brand-two-panel-grid">
      <section className="brand-panel">
        <div className="brand-panel-heading">
          <div>
            <Typography.Title level={5}>表达规则</Typography.Title>
            <Typography.Text type="secondary">脚本生成时按门店事实和限制执行。</Typography.Text>
          </div>
        </div>
        <div className="brand-rule-list">
          <div className="brand-rule-row">
            <span className="brand-detail-label">语气</span>
            <div className="brand-tone-row">
              {draft.tone.map((tone) => (
                <Tag key={tone}>{tone}</Tag>
              ))}
            </div>
          </div>
          <div className="brand-rule-row">
            <span className="brand-detail-label">负责人</span>
            <Typography.Text>{draft.personProfile.role || '待配置'}</Typography.Text>
          </div>
        </div>
      </section>
      <section className="brand-panel">
        <div className="brand-panel-heading">
          <div>
            <Typography.Title level={5}>禁用表达</Typography.Title>
            <Typography.Text type="secondary">命中后必须人工复核。</Typography.Text>
          </div>
        </div>
        <div className="brand-prohibited-cloud">
          {draft.prohibitedWords.map((word) => (
            <Tag color="red" icon={<WarningOutlined />} key={word}>
              {word}
            </Tag>
          ))}
        </div>
      </section>
    </div>
  );

  const renderFactsPanel = () => (
    <BrandFactsTable
      facts={draft.facts}
      scripts={workspace.scripts}
      tone={draft.tone}
      voiceExample={draft.personProfile.tone}
      disabled={loading || !canManageBrand}
      onStatusChange={changeFactStatus}
    />
  );

  const toolbarMenuItems = [
    ...(canManageBrand
      ? [
          {
            key: 'save',
            icon: <CheckCircleOutlined />,
            disabled: !dirty,
            label: <span data-testid="brand-save">{dirty ? '保存资料' : '资料已保存'}</span>,
          },
        ]
      : []),
    {
      key: 'script',
      icon: <ArrowRightOutlined />,
      label: <span data-testid="brand-to-script">进入脚本</span>,
    },
  ];

  return (
    <div className="brand-brain-page" data-testid="brand-brain-page">
      <section className="brand-page-toolbar">
        <div className="brand-page-title">
          <Typography.Title level={3} className="brand-page-heading" aria-label="门店档案">
            门店档案
          </Typography.Title>
          <span className="brand-toolbar-divider" />
          <Select
            variant="borderless"
            className="brand-project-select"
            value={workspace.project.id}
            onChange={handleProjectSwitch}
            options={brandProjectOptions}
            popupMatchSelectWidth={false}
            getPopupContainer={(node) => node.parentElement ?? node}
          />
        </div>
        <div className="brand-toolbar-actions">
          {canManageBrand ? (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => setEditorOpen(true)}
              data-testid="brand-edit"
            >
              编辑资料
            </Button>
          ) : null}
          <Dropdown
            trigger={['click']}
            menu={{
              items: toolbarMenuItems,
              onClick: ({ key }) => {
                if (key === 'save') void saveBrand();
                if (key === 'script') void proceedToScript();
              },
            }}
          >
            <Button
              icon={<MoreOutlined />}
              loading={loading && lastAction === 'updateBrand'}
              data-testid="brand-more"
              aria-label={
                dirty ? '更多操作，有未保存修改' : saved ? '更多操作，资料已保存' : '更多操作'
              }
            />
          </Dropdown>
        </div>
      </section>

      {!canManageBrand ? (
        <Alert
          type="info"
          showIcon
          data-testid="brand-readonly"
          message="品牌资料只读"
          description="当前内容运营身份可以查看品牌事实并进入生产链，但不能编辑资料、修改事实状态或保存品牌配置。"
        />
      ) : null}

      {error ? (
        <Alert
          type="warning"
          showIcon
          closable
          onClose={clearError}
          message="品牌资料操作异常"
          description={error}
          action={
            <Button size="small" onClick={() => void hydrate()} loading={loading}>
              重新加载
            </Button>
          }
        />
      ) : null}

      <Tabs
        className="brand-brain-tabs brand-v3-tabs"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'overview', label: '经营信息', children: renderStoreProfile() },
          { key: 'packages', label: '商品套餐', children: renderPackagesPanel() },
          { key: 'rules', label: '事实规则', children: renderRulesPanel() },
          { key: 'facts', label: '事实库', children: renderFactsPanel() },
        ]}
      />

      {canManageBrand ? (
        <BrandEditorDrawer
          open={editorOpen}
          brand={draft}
          onChange={markDraft}
          onClose={() => setEditorOpen(false)}
          onSave={() => void saveBrand()}
          saving={loading && lastAction === 'updateBrand'}
        />
      ) : null}
    </div>
  );
}
