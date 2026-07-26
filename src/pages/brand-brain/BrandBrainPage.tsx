import {
  AuditOutlined,
  ArrowRightOutlined,
  ClockCircleOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  ShopOutlined,
  TeamOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import { Alert, App, Button, Select, Tabs, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BrandEditorDrawer,
  BrandFactsTable,
  BrandMetricCard,
} from '../../components/brand';
import '../../components/brand/brand-brain.css';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { DEMO_PROJECT_ID, ROUTES } from '../../domain/constants';
import { isDemoProject } from '../../domain/selectors';
import type { BrandProfile, ClaimStatus, ScriptVersion } from '../../domain/types';
import { useProjectStore } from '../../stores/projectStore';

function cloneBrand(brand: BrandProfile): BrandProfile {
  return structuredClone(brand);
}

function getLatestScriptCitations(scripts: ScriptVersion[], limit = 3) {
  return [...scripts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export function BrandBrainPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { projectId } = useParams();
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

  const validProject = isDemoProject(projectId) || projectId === DEMO_PROJECT_ID;

  useEffect(() => {
    if (!dirty && lastAction === 'reset') {
      setDraft(cloneBrand(workspace.brand));
    }
  }, [dirty, lastAction, workspace.brand]);

  const approvedCount = draft.facts.filter((fact) => fact.status === 'approved').length;
  const reviewFacts = draft.facts.filter(
    (fact) => fact.status !== 'approved' || fact.confidence < 0.9,
  );
  const averageConfidence = draft.facts.length
    ? Math.round(
        (draft.facts.reduce((total, fact) => total + fact.confidence, 0) / draft.facts.length) *
          100,
      )
    : 0;
  const completenessRate = Math.round(
    ((approvedCount + draft.packages.length) / (draft.facts.length + 2)) * 100,
  );

  const brandProjectOptions = useMemo(
    () => [
      {
        value: workspace.project.id,
        label: `${workspace.project.name} · ${workspace.project.id}`,
      },
    ],
    [workspace.project.id, workspace.project.name],
  );

  const markDraft = (next: BrandProfile) => {
    setDraft(next);
    setDirty(true);
    setSaved(false);
  };

  const saveBrand = async () => {
    await updateBrand(draft);
    if (useProjectStore.getState().error) return false;
    setDraft(cloneBrand(useProjectStore.getState().workspace.brand));
    setDirty(false);
    setSaved(true);
    setEditorOpen(false);
    message.success('品牌资料已保存到统一工作区');
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
    if (dirty) {
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

  const renderMerchantPanel = () => (
    <section className="brand-panel brand-merchant-panel">
      <div className="brand-panel-heading">
        <div>
          <Typography.Title level={5}>商家基本资料</Typography.Title>
          <Typography.Text type="secondary">Brief 与品牌规则工作台</Typography.Text>
        </div>
        <Button type="link" icon={<EditOutlined />} onClick={() => setEditorOpen(true)}>
          编辑
        </Button>
      </div>
      <div className="brand-identity">
        <div className="brand-logo">
          <ShopOutlined />
        </div>
        <div className="brand-identity-copy">
          <Typography.Text strong>{draft.merchant}</Typography.Text>
          <Typography.Text type="secondary">本地探店 · Demo ID 10086</Typography.Text>
          <div className="brand-tone-row">
            {draft.tone.map((tone) => (
              <Tag color="blue" key={tone}>
                {tone}
              </Tag>
            ))}
          </div>
        </div>
      </div>
      <div className="brand-detail-grid">
        <span className="brand-detail-label">门店地址</span>
        <span>{workspace.brief.address}</span>
        <span className="brand-detail-label">所在城市</span>
        <span>{workspace.brief.city}</span>
        <span className="brand-detail-label">目标平台</span>
        <span>{workspace.brief.platforms.join(' / ')}</span>
        <span className="brand-detail-label">目标受众</span>
        <span>{workspace.brief.targetAudience.join('、')}</span>
        <span className="brand-detail-label">转化动作</span>
        <span>{workspace.brief.cta}</span>
      </div>
    </section>
  );

  const renderPackagesPanel = (className = '') => (
    <section className={`brand-panel ${className}`}>
      <div className="brand-panel-heading">
        <div>
          <Typography.Title level={5}>套餐 / 商品信息</Typography.Title>
          <Typography.Text type="secondary">价格事实与套餐绑定</Typography.Text>
        </div>
        <Tag>{draft.packages.length} 个套餐</Tag>
      </div>
      <div className="brand-package-table">
        <div className="brand-package-table-head">
          <span>套餐 / 商品名称</span>
          <span>类型</span>
          <span>价格</span>
          <span>事实绑定</span>
        </div>
        {draft.packages.map((item) => (
          <div className="brand-package-row" key={item.id}>
            <div className="brand-package-name">
              <Typography.Text strong>{item.name}</Typography.Text>
              <Typography.Text type="secondary" title={item.description}>
                {item.description}
              </Typography.Text>
            </div>
            <Typography.Text type="secondary">套餐</Typography.Text>
            <span className="brand-package-price">¥{item.price}</span>
            <div className="brand-package-claims">
              {item.claimIds.map((claimId) => (
                <Tag color="blue" key={claimId}>
                  {claimId}
                </Tag>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const renderProhibitedPanel = () => (
    <section className="brand-panel">
      <div className="brand-panel-heading">
        <div>
          <Typography.Title level={5}>品牌禁用词</Typography.Title>
          <Typography.Text type="secondary">命中后提升风控级别</Typography.Text>
        </div>
      </div>
      <div className="brand-prohibited-cloud">
        {draft.prohibitedWords.map((word) => (
          <Tag color="red" icon={<ExclamationCircleOutlined />} key={word}>
            {word}
          </Tag>
        ))}
      </div>
    </section>
  );

  const renderPersonPanel = () => (
    <section className="brand-panel">
      <div className="brand-panel-heading">
        <div>
          <Typography.Title level={5}>人物 IP</Typography.Title>
          <Typography.Text type="secondary">统一口播人设设定</Typography.Text>
        </div>
      </div>
      <div className="brand-person">
        <div className="brand-person-avatar">
          <TeamOutlined />
        </div>
        <div className="brand-person-copy">
          <Typography.Text strong>{draft.personProfile.name}</Typography.Text>
          <Typography.Text type="secondary">{draft.personProfile.role}</Typography.Text>
          <Typography.Text>{draft.personProfile.tone}</Typography.Text>
        </div>
      </div>
      <Typography.Text type="secondary" className="brand-person-notes">
        {draft.personProfile.notes}
      </Typography.Text>
    </section>
  );

  const renderCitationsPanel = () => (
    <section className="brand-panel">
      <div className="brand-panel-heading">
        <div>
          <Typography.Title level={5}>最近引用记录</Typography.Title>
          <Typography.Text type="secondary">A/B/C 脚本反向统计</Typography.Text>
        </div>
      </div>
      <div className="brand-reference-list">
        {getLatestScriptCitations(workspace.scripts).map((script: ScriptVersion) => (
          <div className="brand-reference-item" key={script.id}>
            <span className="brand-reference-icon">
              <AuditOutlined />
            </span>
            <span className="brand-reference-copy">
              <Typography.Text strong>{script.name}</Typography.Text>
              <Typography.Text type="secondary">
                引用 {script.citations.length} 条 · {script.score} 分
              </Typography.Text>
            </span>
          </div>
        ))}
      </div>
    </section>
  );

  const renderRiskPanel = () => (
    <section className="brand-panel">
      <div className="brand-panel-heading">
        <div>
          <Typography.Title level={5}>风险提醒</Typography.Title>
          <Typography.Text type="secondary">低可信度或未确认事实需复核</Typography.Text>
        </div>
        <Tag color={reviewFacts.length ? 'orange' : 'success'}>{reviewFacts.length}</Tag>
      </div>
      {reviewFacts.length ? (
        <div className="brand-risk-list">
          {reviewFacts.map((fact) => (
            <div className="brand-risk-item" key={fact.id}>
              <span className="brand-risk-icon">
                <ExclamationCircleOutlined />
              </span>
              <span className="brand-risk-copy">
                <Typography.Text strong>{fact.id} · 建议复核</Typography.Text>
                <Typography.Text type="secondary">{fact.text}</Typography.Text>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <Typography.Text type="secondary" className="brand-empty-text">
          暂无待复核事实
        </Typography.Text>
      )}
    </section>
  );

  const renderTonePanel = () => (
    <section className="brand-panel">
      <div className="brand-panel-heading">
        <div>
          <Typography.Title level={5}>品牌表达规则</Typography.Title>
          <Typography.Text type="secondary">脚本生成时统一执行</Typography.Text>
        </div>
      </div>
      <div className="brand-rule-list">
        <div className="brand-rule-row">
          <span className="brand-detail-label">品牌语气</span>
          <div className="brand-tone-row">
            {draft.tone.map((tone) => (
              <Tag color="blue" key={tone}>
                {tone}
              </Tag>
            ))}
          </div>
        </div>
        <div className="brand-rule-row">
          <span className="brand-detail-label">引用原则</span>
          <Typography.Text>C1—C8 为脚本生成的唯一事实来源</Typography.Text>
        </div>
      </div>
    </section>
  );

  const renderFactsPanel = (className = '') => (
    <BrandFactsTable
      className={className}
      facts={draft.facts}
      scripts={workspace.scripts}
      disabled={loading}
      onStatusChange={changeFactStatus}
    />
  );

  return (
    <div className="brand-brain-page" data-testid="brand-brain-page">
      <Typography.Title level={3} className="brand-page-a11y-title">
        品牌 / 商家大脑
      </Typography.Title>
      <section className="brand-page-toolbar">
        <div className="brand-page-title">
          <div className="brand-project-selector">
            <Typography.Text type="secondary">品牌项目</Typography.Text>
            <Select
              className="brand-project-select"
              value={workspace.project.id}
              onChange={handleProjectSwitch}
              options={brandProjectOptions}
              popupMatchSelectWidth={false}
              getPopupContainer={(node) => node.parentElement ?? node}
            />
          </div>
          <div className="brand-page-meta">
            <Typography.Text strong>{draft.merchant}</Typography.Text>
            <Typography.Text type="secondary">
              {workspace.project.name} · {workspace.brief.city} · {workspace.brief.platforms.join(' / ')}
            </Typography.Text>
          </div>
        </div>
        <div className="brand-toolbar-actions">
          <Tag color={dirty ? 'orange' : saved ? 'success' : 'blue'}>{dirty ? '有未保存修改' : saved ? '已保存' : '资料正常'}</Tag>
          <Button icon={<EditOutlined />} onClick={() => setEditorOpen(true)} data-testid="brand-edit">
            编辑资料
          </Button>
          <Button
            icon={<SaveOutlined />}
            disabled={!dirty}
            loading={loading && lastAction === 'updateBrand'}
            onClick={() => void saveBrand()}
            data-testid="brand-save"
          >
            保存
          </Button>
          <Button
            type="primary"
            icon={<ArrowRightOutlined />}
            onClick={() => void proceedToScript()}
            data-testid="brand-to-script"
          >
            进入脚本
          </Button>
        </div>
      </section>

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

      <div className="brand-metrics-grid">
        <BrandMetricCard
          icon={<SafetyCertificateOutlined />}
          label="资料完整度"
          value={`${completenessRate}%`}
          hint={`${approvedCount} / ${draft.facts.length} 条事实已确认`}
        />
        <BrandMetricCard
          icon={<ClockCircleOutlined />}
          label="平均可信度"
          value={`${averageConfidence}%`}
          hint={`更新于 ${new Date(workspace.project.updatedAt).toLocaleString('zh-CN', { hour12: false })}`}
          tone="purple"
        />
        <BrandMetricCard
          icon={<FileTextOutlined />}
          label="事实条目"
          value={draft.facts.length}
          hint="统一编号 C1—C8"
          tone="green"
        />
        <BrandMetricCard
          icon={<TagsOutlined />}
          label="可用素材"
          value={workspace.assets.length}
          hint={`${draft.packages.length} 个套餐 · ${draft.tone.length} 个语气标签`}
          tone="orange"
        />
      </div>

      <Tabs
        className="brand-brain-tabs"
        defaultActiveKey="overview"
        items={[
          {
            key: 'overview',
            label: '商家资料',
            children: (
              <div className="brand-dashboard-grid">
                <div className="brand-dashboard-column">
                  {renderMerchantPanel()}
                  {renderFactsPanel()}
                </div>
                <div className="brand-dashboard-column">
                  {renderPackagesPanel()}
                  <div className="brand-dashboard-split">
                    {renderProhibitedPanel()}
                    {renderPersonPanel()}
                  </div>
                </div>
                <div className="brand-dashboard-column">
                  {renderCitationsPanel()}
                  {renderRiskPanel()}
                </div>
              </div>
            ),
          },
          {
            key: 'rules',
            label: '品牌规则',
            children: (
              <div className="brand-focus-grid">
                {renderTonePanel()}
                {renderProhibitedPanel()}
                {renderRiskPanel()}
              </div>
            ),
          },
          {
            key: 'packages',
            label: '商品套餐',
            children: renderPackagesPanel('brand-panel-wide'),
          },
          {
            key: 'person',
            label: 'IP 人物记忆',
            children: (
              <div className="brand-two-panel-grid">
                {renderPersonPanel()}
                {renderTonePanel()}
              </div>
            ),
          },
          {
            key: 'facts',
            label: '事实库',
            children: (
              <div className="brand-facts-focus-grid">
                {renderFactsPanel()}
                {renderCitationsPanel()}
              </div>
            ),
          },
        ]}
      />

      <BrandEditorDrawer
        open={editorOpen}
        brand={draft}
        onChange={markDraft}
        onClose={() => setEditorOpen(false)}
        onSave={() => void saveBrand()}
        saving={loading && lastAction === 'updateBrand'}
      />
    </div>
  );
}
