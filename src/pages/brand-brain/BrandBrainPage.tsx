import {
  ArrowRightOutlined,
  AuditOutlined,
  ClockCircleOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Divider,
  Empty,
  Space,
  Tag,
  Typography,
} from 'antd';
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
import type { BrandProfile, ClaimStatus } from '../../domain/types';
import { useProjectStore } from '../../stores/projectStore';

function cloneBrand(brand: BrandProfile): BrandProfile {
  return structuredClone(brand);
}

const claimTypeLabels: Record<string, string> = {
  fact: '基础事实',
  price: '价格套餐',
  service: '服务体验',
  policy: '会员权益',
  disclaimer: '免责声明',
};

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
        (draft.facts.reduce((total, fact) => total + fact.confidence, 0) /
          draft.facts.length) *
          100,
      )
    : 0;

  const categoryCounts = useMemo(() => {
    return draft.facts.reduce<Record<string, number>>((counts, fact) => {
      counts[fact.type] = (counts[fact.type] ?? 0) + 1;
      return counts;
    }, {});
  }, [draft.facts]);

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

  return (
    <div className="brand-brain-page" data-testid="brand-brain-page">
      <div className="brand-page-toolbar">
        <div className="brand-page-title">
          <Typography.Title level={3}>品牌 / 商家大脑</Typography.Title>
          <Typography.Text type="secondary">
            {workspace.project.name} · 管理事实、语气、套餐、人物 IP 与合规口径。
          </Typography.Text>
        </div>
        <div className="brand-toolbar-actions">
          <Tag color={dirty ? 'orange' : saved ? 'success' : 'green'}>
            {dirty ? '有未保存修改' : saved ? '已保存' : '资料正常'}
          </Tag>
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
      </div>

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
          value={`${Math.round(((approvedCount + draft.packages.length) / (draft.facts.length + 2)) * 100)}%`}
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

      <div className="brand-overview-grid">
        <div className="brand-main-column">
          <section className="brand-panel">
            <div className="brand-panel-heading">
              <div>
                <Typography.Title level={5}>商家基本资料</Typography.Title>
                <Typography.Text type="secondary">Brief 与品牌规则的统一工作面</Typography.Text>
              </div>
              <Button type="link" icon={<EditOutlined />} onClick={() => setEditorOpen(true)}>
                编辑
              </Button>
            </div>
            <div className="brand-identity">
              <div className="brand-logo">Hi</div>
              <div className="brand-identity-copy">
                <Typography.Title level={4}>{draft.merchant}</Typography.Title>
                <Typography.Text type="secondary">本地探店 · Demo ID 10086</Typography.Text>
                <div className="brand-tone-row" style={{ marginTop: 8 }}>
                  {draft.tone.map((tone) => <Tag color="blue" key={tone}>{tone}</Tag>)}
                </div>
              </div>
            </div>
            <div className="brand-detail-grid">
              <span className="brand-detail-label">门店地址</span><span>{workspace.brief.address}</span>
              <span className="brand-detail-label">所在城市</span><span>{workspace.brief.city}</span>
              <span className="brand-detail-label">目标平台</span><span>{workspace.brief.platforms.join(' / ')}</span>
              <span className="brand-detail-label">目标受众</span><span>{workspace.brief.targetAudience.join('、')}</span>
              <span className="brand-detail-label">转化动作</span><span>{workspace.brief.cta}</span>
            </div>
          </section>

          <section className="brand-panel">
            <div className="brand-panel-heading">
              <div>
                <Typography.Title level={5}>套餐 / 商品信息</Typography.Title>
                <Typography.Text type="secondary">价格事实必须与 C3、C4 保持一致</Typography.Text>
              </div>
              <Tag>{draft.packages.length} 个套餐</Tag>
            </div>
            <div className="brand-package-grid">
              {draft.packages.map((item) => (
                <div className="brand-package-item" key={item.id}>
                  <div className="brand-package-top">
                    <Typography.Text strong>{item.name}</Typography.Text>
                    <span className="brand-package-price">¥{item.price}</span>
                  </div>
                  <Typography.Text type="secondary" className="brand-package-description">
                    {item.description}
                  </Typography.Text>
                  <Space size={6}>
                    {item.claimIds.map((claimId) => <Tag color="blue" key={claimId}>{claimId}</Tag>)}
                    <Typography.Text type="secondary">已绑定事实</Typography.Text>
                  </Space>
                </div>
              ))}
            </div>
            <Divider />
            <div className="brand-person">
              <div className="brand-person-avatar">{draft.personProfile.name.slice(-1)}</div>
              <div className="brand-person-copy">
                <Typography.Text strong>{draft.personProfile.name} · {draft.personProfile.role}</Typography.Text>
                <Typography.Text>{draft.personProfile.tone}</Typography.Text>
                <Typography.Text type="secondary">{draft.personProfile.notes}</Typography.Text>
              </div>
              <Tag color="purple">人物 IP</Tag>
            </div>
          </section>
        </div>

        <aside className="brand-side-column">
          <section className="brand-panel">
            <div className="brand-panel-heading">
              <div>
                <Typography.Title level={5}>内容可引用事实</Typography.Title>
                <Typography.Text type="secondary">已确认内容优先用于脚本</Typography.Text>
              </div>
              <Tag color="blue">{draft.facts.length}</Tag>
            </div>
            <div className="brand-category-grid">
              {Object.entries(categoryCounts).map(([type, count]) => (
                <div className="brand-category-item" key={type}>
                  <span>{claimTypeLabels[type] ?? type}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="brand-panel">
            <div className="brand-panel-heading">
              <div>
                <Typography.Title level={5}>最近引用记录</Typography.Title>
                <Typography.Text type="secondary">A/B/C 脚本实时反向统计</Typography.Text>
              </div>
            </div>
            <div className="brand-reference-list">
              {workspace.scripts.map((script) => (
                <div className="brand-reference-item" key={script.id}>
                  <span className="brand-reference-icon"><AuditOutlined /></span>
                  <span className="brand-reference-copy">
                    <Typography.Text strong>{script.name}</Typography.Text>
                    <Typography.Text type="secondary">
                      引用 {script.citations.length} 条 · {script.citations.join('、')}
                    </Typography.Text>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="brand-panel">
            <div className="brand-panel-heading">
              <div>
                <Typography.Title level={5}>风险提醒</Typography.Title>
                <Typography.Text type="secondary">低可信度或非确认事实需复核</Typography.Text>
              </div>
              <Tag color={reviewFacts.length ? 'orange' : 'green'}>{reviewFacts.length}</Tag>
            </div>
            {reviewFacts.length ? (
              <div className="brand-risk-list">
                {reviewFacts.slice(0, 3).map((fact) => (
                  <div className="brand-risk-item" key={fact.id}>
                    <span className="brand-risk-icon"><ExclamationCircleOutlined /></span>
                    <span className="brand-risk-copy">
                      <Typography.Text strong>{fact.id} · 建议复核</Typography.Text>
                      <Typography.Text type="secondary">{fact.text}</Typography.Text>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待复核事实" />
            )}
          </section>
        </aside>
      </div>

      <section className="brand-panel">
        <div className="brand-panel-heading">
          <div>
            <Typography.Title level={5}>品牌禁用词</Typography.Title>
            <Typography.Text type="secondary">脚本生成与编辑时命中即提示风险</Typography.Text>
          </div>
          <Button type="link" icon={<EditOutlined />} onClick={() => setEditorOpen(true)}>
            编辑规则
          </Button>
        </div>
        <div className="brand-prohibited-cloud">
          {draft.prohibitedWords.map((word) => (
            <Tag color="red" icon={<ExclamationCircleOutlined />} key={word}>{word}</Tag>
          ))}
        </div>
      </section>

      <BrandFactsTable
        facts={draft.facts}
        scripts={workspace.scripts}
        disabled={loading}
        onStatusChange={changeFactStatus}
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
