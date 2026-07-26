import {
  AuditOutlined,
  ArrowRightOutlined,
  BankOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  EditOutlined,
  EnvironmentOutlined,
  ExclamationCircleOutlined,
  ExportOutlined,
  FileTextOutlined,
  GlobalOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  MoreOutlined,
  PhoneOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import { Alert, App, Button, Dropdown, Select, Tabs, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BrandEditorDrawer,
  BrandFactsTable,
  BrandMetricCard,
} from '../../components/brand';
import '../../components/brand/brand-brain.css';
import haidilaoLogo from '../../components/brand/assets/haidilao-logo.png';
import zhangYongAvatar from '../../components/brand/assets/zhang-yong-avatar.png';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { DEMO_PROJECT_ID, ROUTES } from '../../domain/constants';
import { isDemoProject } from '../../domain/selectors';
import type { BrandProfile, ClaimStatus } from '../../domain/types';
import { useProjectStore } from '../../stores/projectStore';

function cloneBrand(brand: BrandProfile): BrandProfile {
  return structuredClone(brand);
}

const referencePackageRows = [
  {
    id: 'recognized-package-01',
    name: '甄选双人餐',
    type: '套餐',
    price: '¥258',
    highlight: '招牌锅底 + 精品菜',
    scene: '情侣约会',
    claimIds: ['C4'],
  },
  {
    id: 'recognized-package-02',
    name: '四宫格锅底',
    type: '单点',
    price: '¥68',
    highlight: '四种口味一次满足',
    scene: '多人聚餐',
    claimIds: ['C3'],
  },
  {
    id: 'recognized-package-03',
    name: '毛肚',
    type: '单点',
    price: '¥58',
    highlight: '鲜切毛肚，口感脆嫩',
    scene: '必点推荐',
    claimIds: ['C5'],
  },
  {
    id: 'recognized-package-04',
    name: '捞派虾滑',
    type: '单点',
    price: '¥48',
    highlight: '手工现打，Q 弹爽滑',
    scene: '儿童推荐',
    claimIds: ['C5'],
  },
  {
    id: 'recognized-package-05',
    name: '生日专属礼遇',
    type: '权益',
    price: '免费',
    highlight: '生日当日送长寿面 + 果盘',
    scene: '生日庆祝',
    claimIds: ['C7'],
  },
];

const referenceProhibitedWords = [
  '最便宜',
  '绝对',
  '第一',
  '全网最低价',
  '包赚不赔',
  '治疗',
  '功效保证',
  '100%有效',
];

const factCategoryRecords = [
  { label: '价格', count: 12 },
  { label: '地址', count: 3 },
  { label: '营业时间', count: 2 },
  { label: '活动', count: 8 },
  { label: '预约方式', count: 4 },
  { label: '交通指引', count: 3 },
  { label: '特色服务', count: 6 },
];

const citationRecords = [
  {
    id: 'citation-demo-01',
    title: '抖音美食推荐脚本-05-28',
    count: 12,
    time: '10 分钟前',
    owner: '张晓明',
    tone: 'green',
  },
  {
    id: 'citation-demo-02',
    title: '探店视频脚本-火锅主题',
    count: 8,
    time: '1 小时前',
    owner: '李思琪',
    tone: 'purple',
  },
  {
    id: 'citation-demo-03',
    title: '小红书图文笔记-打卡攻略',
    count: 6,
    time: '3 小时前',
    owner: '王小川',
    tone: 'orange',
  },
];

const riskRecords = [
  {
    id: 'risk-demo-01',
    title: '营业时间存在冲突信息（2 条）',
    meta: '',
  },
  {
    id: 'risk-demo-02',
    title: '活动有效期即将过期（1 条）',
    meta: '3 天后到期',
  },
];

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
  const [activeTab, setActiveTab] = useState('overview');

  const validProject = isDemoProject(projectId) || projectId === DEMO_PROJECT_ID;

  useEffect(() => {
    if (!dirty && lastAction === 'reset') {
      setDraft(cloneBrand(workspace.brand));
    }
  }, [dirty, lastAction, workspace.brand]);

  const brandProjectOptions = useMemo(
    () => [
      {
        value: workspace.project.id,
        label: draft.merchant,
      },
    ],
    [draft.merchant, workspace.project.id],
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

  const exportBrand = () => {
    const file = new Blob(
      [
        JSON.stringify(
          {
            project: workspace.project.name,
            merchant: draft.merchant,
            brand: draft,
            exportedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '海底捞三里屯店-品牌资料.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    message.success('品牌资料已导出');
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
        </div>
        <Button type="link" icon={<EditOutlined />} onClick={() => setEditorOpen(true)}>
          编辑
        </Button>
      </div>
      <div className="brand-identity">
        <img className="brand-logo" src={haidilaoLogo} alt="海底捞品牌标识" />
        <div className="brand-identity-copy">
          <Typography.Text strong>{draft.merchant}</Typography.Text>
          <div className="brand-identity-meta">
            <Tag>连锁门店</Tag>
            <Typography.Text type="secondary">ID: 10086</Typography.Text>
          </div>
        </div>
      </div>
      <div className="brand-merchant-details">
        <div className="brand-merchant-detail-row">
          <BankOutlined />
          <span className="brand-detail-label">品牌所属</span>
          <span>海底捞国际控股有限公司</span>
        </div>
        <div className="brand-merchant-detail-row">
          <HomeOutlined />
          <span className="brand-detail-label">门店类型</span>
          <span>直营门店</span>
        </div>
        <div className="brand-merchant-detail-row">
          <PhoneOutlined />
          <span className="brand-detail-label">联系电话</span>
          <span>010-6417 5757</span>
        </div>
        <div className="brand-merchant-detail-row">
          <EnvironmentOutlined />
          <span className="brand-detail-label">门店地址</span>
          <span>
            北京市朝阳区三里屯路 19 号三里屯太古里南区 B1-12
            <Button type="link" size="small" onClick={() => message.info('演示模式：已定位三里屯太古里门店')}>
              查看地图
            </Button>
          </span>
        </div>
        <div className="brand-merchant-detail-row">
          <ClockCircleOutlined />
          <span className="brand-detail-label">营业时间</span>
          <span>周一至周日 10:00 - 次日 07:00</span>
        </div>
        <div className="brand-merchant-detail-row">
          <DollarOutlined />
          <span className="brand-detail-label">人均消费</span>
          <span>¥110-150</span>
        </div>
        <div className="brand-merchant-detail-row">
          <GlobalOutlined />
          <span className="brand-detail-label">适用平台</span>
          <span>抖音、小红书、视频号、快手</span>
        </div>
      </div>
      <div className="brand-merchant-tags">
        <span className="brand-detail-label">标签</span>
        <div className="brand-tone-row">
          {['火锅', '川味', '网红打卡', '服务好'].map((tag) => (
            <Tag color="blue" key={tag}>
              {tag}
            </Tag>
          ))}
        </div>
      </div>
    </section>
  );

  const renderPackagesPanel = (className = '') => (
    <section className={`brand-panel ${className}`}>
      <div className="brand-panel-heading">
        <div>
          <Typography.Title level={5}>套餐 / 商品信息</Typography.Title>
        </div>
        <Button type="link" icon={<EditOutlined />} onClick={() => setEditorOpen(true)}>
          管理套餐
        </Button>
      </div>
      <div className="brand-package-table">
        <div className="brand-package-table-head">
          <span>套餐 / 商品名称</span>
          <span>类型</span>
          <span>价格</span>
          <span>主打卖点</span>
          <span>适用场景</span>
        </div>
        {referencePackageRows.map((item) => (
          <div
            className="brand-package-row"
            key={item.id}
            data-claim-ids={item.claimIds.join(',')}
          >
            <Typography.Text strong>{item.name}</Typography.Text>
            <Typography.Text type="secondary">{item.type}</Typography.Text>
            <span className="brand-package-price">{item.price}</span>
            <Typography.Text>{item.highlight}</Typography.Text>
            <Typography.Text type="secondary">{item.scene}</Typography.Text>
          </div>
        ))}
      </div>
      <Button
        type="link"
        className="brand-package-footer"
        onClick={() => setActiveTab('packages')}
      >
        查看全部 28 个套餐 / 商品 <RightOutlined />
      </Button>
    </section>
  );

  const renderProhibitedPanel = () => (
    <section className="brand-panel">
      <div className="brand-panel-heading">
        <div>
          <Typography.Title level={5}>禁用词</Typography.Title>
          <Typography.Text type="secondary">共 23 个禁用词</Typography.Text>
        </div>
        <Button type="link" icon={<EditOutlined />} onClick={() => setEditorOpen(true)}>
          编辑
        </Button>
      </div>
      <div className="brand-rule-warning">
        <ExclamationCircleOutlined />
        <Typography.Text type="secondary">以下词汇禁止用于对外内容（含暗示）</Typography.Text>
      </div>
      <div className="brand-prohibited-cloud">
        {referenceProhibitedWords.map((word) => (
          <Tag color="red" icon={<ExclamationCircleOutlined />} key={word}>
            {word}
          </Tag>
        ))}
      </div>
      <Typography.Text type="secondary" className="brand-prohibited-count">
        共 23 个禁用词
      </Typography.Text>
    </section>
  );

  const renderPersonPanel = () => (
    <section className="brand-panel">
      <div className="brand-panel-heading">
        <div>
          <Typography.Title level={5}>老板 IP 信息</Typography.Title>
        </div>
        <Button type="link" icon={<EditOutlined />} onClick={() => setEditorOpen(true)}>
          编辑
        </Button>
      </div>
      <div className="brand-person">
        <img className="brand-person-avatar" src={zhangYongAvatar} alt="张勇头像" />
        <div className="brand-person-copy">
          <Typography.Text strong>张勇（海底捞创始人）</Typography.Text>
          <div>
            <Tag color="blue">创始人</Tag>
            <Tag color="blue">企业家</Tag>
          </div>
        </div>
      </div>
      <div className="brand-person-details">
        <div>
          <span className="brand-detail-label">擅长主题</span>
          <Typography.Text>企业文化、服务理念、餐饮创业</Typography.Text>
        </div>
        <div>
          <span className="brand-detail-label">人设标签</span>
          <Typography.Text>
            {draft.personProfile.tone === '清晰、可信、服务导向'
              ? '真诚务实、用户至上、有温度'
              : draft.personProfile.tone}
          </Typography.Text>
        </div>
        <div>
          <span className="brand-detail-label">有效期</span>
          <Typography.Text>2025-01-01 ~ 长期有效</Typography.Text>
        </div>
      </div>
    </section>
  );

  const renderFactCategoriesPanel = () => (
    <section className="brand-panel brand-fact-categories-panel">
      <div className="brand-panel-heading">
        <div>
          <Typography.Title level={5}>
            内容生成可引用事实 <InfoCircleOutlined />
          </Typography.Title>
        </div>
        <Button type="link" onClick={() => setActiveTab('facts')}>
          全部 128 <RightOutlined />
        </Button>
      </div>
      <div className="brand-fact-category-chips">
        {factCategoryRecords.map((item) => (
          <button type="button" key={item.label} onClick={() => setActiveTab('facts')}>
            <span>{item.label}</span>
            <strong>{item.count}</strong>
          </button>
        ))}
        <button type="button" onClick={() => setActiveTab('facts')}>
          <span>更多</span>
          <RightOutlined />
        </button>
      </div>
      <div className="brand-fact-tip">
        <SafetyCertificateOutlined />
        <span>提示：已在事实库中确认的内容，将作为生成内容的优先事实来源。</span>
      </div>
    </section>
  );

  const renderCitationsPanel = () => (
    <section className="brand-panel">
      <div className="brand-panel-heading">
        <div>
          <Typography.Title level={5}>最近引用记录</Typography.Title>
        </div>
        <Button type="link" onClick={() => setActiveTab('facts')}>
          全部记录 <RightOutlined />
        </Button>
      </div>
      <div className="brand-reference-list">
        {citationRecords.map((record) => (
          <div className="brand-reference-item" key={record.id}>
            <span className={`brand-reference-icon brand-reference-icon-${record.tone}`}>
              <AuditOutlined />
            </span>
            <span className="brand-reference-copy">
              <Typography.Text strong>{record.title}</Typography.Text>
              <Typography.Text type="secondary">
                引用事实 {record.count} 条
              </Typography.Text>
            </span>
            <span className="brand-reference-meta">
              <Typography.Text type="secondary">{record.time}</Typography.Text>
              <Typography.Text>{record.owner}</Typography.Text>
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
        </div>
        <Button type="link" onClick={() => setActiveTab('rules')}>
          全部提醒 <RightOutlined />
        </Button>
      </div>
      <div className="brand-risk-list">
        {riskRecords.map((risk) => (
          <button
            type="button"
            className="brand-risk-item"
            key={risk.id}
            onClick={() => setActiveTab('facts')}
          >
            <span className="brand-risk-icon">
              <ExclamationCircleOutlined />
            </span>
            <span className="brand-risk-copy">
              <Typography.Text strong>{risk.title}</Typography.Text>
            </span>
            <span className="brand-risk-meta">
              {risk.meta ? <Typography.Text type="secondary">{risk.meta}</Typography.Text> : null}
              <RightOutlined />
            </span>
          </button>
        ))}
      </div>
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
            {['热情', '真诚', '年轻化', '服务至上'].map((tone) => (
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
      tone={['热情', '真诚', '年轻化']}
      voiceExample="“海底捞服务至上，让每一次用餐都暖心！”"
      disabled={loading}
      onStatusChange={changeFactStatus}
    />
  );

  const toolbarMenuItems = [
    {
      key: 'save',
      icon: <SaveOutlined />,
      disabled: !dirty,
      label: <span data-testid="brand-save">{dirty ? '保存资料' : '资料已保存'}</span>,
    },
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
          <Typography.Title
            level={3}
            className="brand-page-heading"
            aria-label="品牌 / 商家大脑"
          >
            品牌/商家大脑
          </Typography.Title>
          <span className="brand-toolbar-divider" />
          <Typography.Text type="secondary">全部品牌</Typography.Text>
          <RightOutlined className="brand-toolbar-chevron" />
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
          <Button
            icon={<ExportOutlined />}
            onClick={exportBrand}
            data-testid="brand-export"
          >
            导出品牌资料
          </Button>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => setEditorOpen(true)}
            data-testid="brand-edit"
          >
            编辑资料
          </Button>
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
              aria-label={dirty ? '更多操作，有未保存修改' : saved ? '更多操作，资料已保存' : '更多操作'}
            />
          </Dropdown>
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
          label="品牌状态"
          value="正常"
          valueStyle="status"
          hint="资料完整度　92%"
        />
        <BrandMetricCard
          icon={<ClockCircleOutlined />}
          label="最近更新"
          value="2025-05-28 20:16"
          hint="由 张晓明 更新"
          tone="purple"
        />
        <BrandMetricCard
          icon={<FileTextOutlined />}
          label="事实条目数"
          value={128}
          hint="较上周 ↑ 6"
          tone="green"
        />
        <BrandMetricCard
          icon={<TagsOutlined />}
          label="可用素材数"
          value="1,268"
          hint="较上周 ↑ 128"
          tone="orange"
        />
      </div>

      <Tabs
        className="brand-brain-tabs"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'overview',
            label: '商家资料',
            children: (
              <div className="brand-dashboard-grid">
                <div className="brand-dashboard-column">
                  {renderMerchantPanel()}
                  {renderFactsPanel()}
                  <div className="brand-panel">
                    <div>
                      <Typography.Text type="secondary">当前 Brief CTA</Typography.Text>
                    </div>
                    <div>
                      <Typography.Text>{workspace.brief.cta}</Typography.Text>
                    </div>
                  </div>
                </div>
                <div className="brand-dashboard-column">
                  {renderPackagesPanel()}
                  <div className="brand-dashboard-split">
                    {renderProhibitedPanel()}
                    {renderPersonPanel()}
                  </div>
                </div>
                <div className="brand-dashboard-column">
                  {renderFactCategoriesPanel()}
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
            label: 'IP人物记忆',
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
