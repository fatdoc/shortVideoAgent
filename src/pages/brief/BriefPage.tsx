import {
  ArrowRightOutlined,
  CloseCircleOutlined,
  CloudUploadOutlined,
  RobotOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Input,
  InputNumber,
  Select,
  Space,
  Steps,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BriefReadinessPanel } from '../../components/project';
import '../../components/project/project-workflow.css';
import { DEMO_PROJECT_ID, ROUTES } from '../../domain/constants';
import type { AspectRatio, Asset, BusinessType, ProjectBrief } from '../../domain/types';
import { useProjectStore } from '../../stores/projectStore';

const businessOptions: Array<{
  value: BusinessType;
  title: string;
  description: string;
}> = [
  { value: 'local_store', title: '本地探店', description: '线下门店、体验种草、团购转化' },
  { value: 'brand', title: '品牌内容', description: '品牌心智、活动传播与口碑' },
  { value: 'product', title: '电商素材', description: '商品卖点、场景展示与转化' },
];

const aspectRatioOptions: AspectRatio[] = ['9:16', '16:9', '1:1'];
const platformOptions = ['抖音', '快手', '视频号', '小红书', 'B站'];
const briefSteps = [
  { title: '基础信息', description: '商家、受众与目标' },
  { title: '资源配置', description: '平台与素材预备' },
  { title: '品牌与脚本', description: '核验与补齐' },
  { title: '完成', description: '继续往后' },
];

function cloneBrief(brief: ProjectBrief): ProjectBrief {
  return structuredClone(brief);
}

export function BriefPage() {
  const navigate = useNavigate();
  const workspace = useProjectStore((state) => state.workspace);
  const loading = useProjectStore((state) => state.loading);
  const error = useProjectStore((state) => state.error);
  const lastAction = useProjectStore((state) => state.lastAction);
  const setBrief = useProjectStore((state) => state.setBrief);
  const clearError = useProjectStore((state) => state.clearError);
  const [draft, setDraft] = useState(() => cloneBrief(workspace.brief));
  const [dirty, setDirty] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const formTopRef = useRef<HTMLDivElement>(null);

  const assetLookup = useMemo(
    () => new Map(workspace.assets.map((asset) => [asset.id, asset] as const)),
    [workspace.assets],
  );
  const selectedAssets = useMemo(
    () =>
      draft.assetIds
        .map((assetId) => assetLookup.get(assetId))
        .filter((asset): asset is Asset => Boolean(asset)),
    [assetLookup, draft.assetIds],
  );
  const remainingAssets = useMemo(
    () => workspace.assets.filter((asset) => !draft.assetIds.includes(asset.id)),
    [workspace.assets, draft.assetIds],
  );

  useEffect(() => {
    if (!dirty && lastAction === 'reset') {
      setDraft(cloneBrief(workspace.brief));
    }
  }, [dirty, lastAction, workspace.brief]);

  const patch = <K extends keyof ProjectBrief>(key: K, value: ProjectBrief[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaved(false);
  };

  const missing = useMemo(() => {
    const items: string[] = [];
    if (!draft.merchantName.trim()) items.push('填写门店 / 商家名称');
    if (!draft.city.trim() || !draft.address.trim()) items.push('补齐城市与门店地址');
    if (draft.platforms.length === 0) items.push('至少选择一个目标平台');
    if (draft.targetAudience.length === 0) items.push('补充目标受众');
    if (!draft.cta.trim()) items.push('填写目标 CTA');
    if (draft.assetIds.length < 5) items.push(`上传更多素材（当前 ${draft.assetIds.length} / 建议 5+）`);
    return items;
  }, [draft]);

  const saveDraft = async () => {
    await setBrief({ ...draft, projectId: DEMO_PROJECT_ID });
    if (useProjectStore.getState().error) {
      return false;
    }
    setDirty(false);
    setSaved(true);
    return true;
  };

  const proceed = async (target: 'brand' | 'script') => {
    if (dirty) {
      const savedSuccessfully = await saveDraft();
      if (!savedSuccessfully) return;
    }
    navigate(
      target === 'brand'
        ? ROUTES.brand(DEMO_PROJECT_ID)
        : ROUTES.script(DEMO_PROJECT_ID),
    );
  };

  const applyAiSuggestions = async () => {
    setAiLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 650));
    patch(
      'notes',
      '前 3 秒用三里屯深夜火锅场景抓住注意力，中段突出服务、锅底与招牌菜，结尾明确领取团购券并到店核销。',
    );
    patch('restrictions', [
      '价格与权益必须引用已确认事实',
      '避免绝对化承诺与竞品对比',
      '会员权益以门店实际规则为准',
    ]);
    setAiLoading(false);
  };

  const simulateUpload = () => {
    const nextAsset = remainingAssets[0];
    if (!nextAsset) {
      return;
    }
    patch('assetIds', [...draft.assetIds, nextAsset.id]);
  };

  return (
    <div className="project-workflow-page" data-testid="brief-page" ref={formTopRef}>
      <div className="project-page-toolbar">
        <div className="project-page-toolbar-copy">
          <Typography.Title level={3}>新建项目 / Brief</Typography.Title>
          <Typography.Text type="secondary">
            统一 Demo 已预填；修改后可保存到 Store / LocalStorage 并继续生产。
          </Typography.Text>
        </div>
        <div className="project-toolbar-actions">
          <Tag color={dirty ? 'orange' : saved ? 'success' : 'blue'}>
            {dirty ? '未保存' : saved ? '已保存' : '已同步'}
          </Tag>
          <Button
            icon={<SaveOutlined />}
            loading={loading && lastAction === 'setBrief'}
            disabled={!dirty || missing.length > 0}
            onClick={() => void saveDraft()}
            data-testid="brief-save"
          >
            保存草稿
          </Button>
          <Button
            type="primary"
            icon={<ArrowRightOutlined />}
            disabled={missing.length > 0}
            onClick={() => void proceed('brand')}
            data-testid="brief-to-brand"
          >
            下一步：品牌大脑
          </Button>
        </div>
      </div>

      <div className="brief-step-bar">
        <Steps className="brief-steps" size="small" current={1} items={briefSteps} />
      </div>

      {error ? (
        <Alert
          type="warning"
          showIcon
          closable
          onClose={clearError}
          message="Brief 保存异常"
          description={error}
        />
      ) : null}

      <div className="brief-layout">
        <div className="brief-form-column">
          <section className="brief-form-section">
            <div className="brief-form-section-title">
              <Typography.Title level={5} style={{ margin: 0 }}>
                业务类型
              </Typography.Title>
              <Typography.Text type="secondary">选择内容生产的主要业务场景</Typography.Text>
            </div>
            <div className="brief-business-options">
              {businessOptions.map((option) => (
                <div
                  key={option.value}
                  role="button"
                  tabIndex={0}
                  className={`brief-business-option ${draft.businessType === option.value ? 'is-active' : ''}`}
                  onClick={() => patch('businessType', option.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      patch('businessType', option.value);
                    }
                  }}
                >
                  <strong>{option.title}</strong>
                  <Typography.Text type="secondary">{option.description}</Typography.Text>
                </div>
              ))}
            </div>
          </section>

          <section className="brief-form-section">
            <div className="brief-form-section-title">
              <Typography.Title level={5} style={{ margin: 0 }}>
                商家与项目
              </Typography.Title>
              <Typography.Text type="secondary">这些字段会传递到品牌大脑与脚本</Typography.Text>
            </div>
            <div className="brief-form-grid">
              <label className="brief-field is-span-2">
                <span className="brief-field-label is-required">门店 / 商家名称</span>
                <Input
                  value={draft.merchantName}
                  onChange={(event) => patch('merchantName', event.target.value)}
                  data-testid="brief-merchant"
                />
              </label>
              <label className="brief-field">
                <span className="brief-field-label is-required">所在城市</span>
                <Input value={draft.city} onChange={(event) => patch('city', event.target.value)} />
              </label>
              <label className="brief-field">
                <span className="brief-field-label is-required">详细地址</span>
                <Input value={draft.address} onChange={(event) => patch('address', event.target.value)} />
              </label>
            </div>
          </section>

          <section className="brief-form-section">
            <div className="brief-form-section-title">
              <Typography.Title level={5} style={{ margin: 0 }}>
                目标与渠道
              </Typography.Title>
              <Typography.Text type="secondary">约束画面规格、时长、受众与转化动作</Typography.Text>
            </div>
            <div className="brief-form-grid">
              <label className="brief-field">
                <span className="brief-field-label is-required">目标平台</span>
                <Select
                  mode="multiple"
                  value={draft.platforms}
                  onChange={(value) => patch('platforms', value)}
                  options={platformOptions.map((value) => ({
                    value,
                    label: value,
                  }))}
                />
              </label>
              <label className="brief-field">
                <span className="brief-field-label">画面比例 / 时长</span>
                <Space.Compact block>
                  <Select
                    value={draft.aspectRatio}
                    onChange={(value: AspectRatio) => patch('aspectRatio', value)}
                    options={aspectRatioOptions.map((value) => ({ value, label: value }))}
                    style={{ width: '45%' }}
                  />
                  <InputNumber
                    min={15}
                    max={60}
                    value={draft.duration}
                    onChange={(value) => patch('duration', value ?? 30)}
                    style={{ width: 'calc(55% - 40px)' }}
                  />
                  <Button size="small" disabled style={{ width: 40, paddingInline: 0 }}>
                    秒
                  </Button>
                </Space.Compact>
              </label>
              <label className="brief-field is-span-2">
                <span className="brief-field-label is-required">目标受众</span>
                <Select
                  mode="tags"
                  value={draft.targetAudience}
                  onChange={(value) => patch('targetAudience', value)}
                  tokenSeparators={[',']}
                  options={draft.targetAudience.map((value) => ({ value, label: value }))}
                />
              </label>
              <label className="brief-field is-span-2">
                <span className="brief-field-label is-required">目标 CTA</span>
                <Input
                  value={draft.cta}
                  onChange={(event) => patch('cta', event.target.value)}
                  data-testid="brief-cta"
                />
              </label>
            </div>
          </section>

          <section className="brief-form-section">
            <div className="brief-form-section-title">
              <Typography.Title level={5} style={{ margin: 0 }}>
                素材与内容约束
              </Typography.Title>
              <Typography.Text type="secondary">素材上传为前端 Mock，不读取真实文件</Typography.Text>
            </div>
            <div className="brief-upload-zone">
              <div>
                <Typography.Text strong>已有 {draft.assetIds.length} 个素材引用</Typography.Text>
                <br />
                <Typography.Text type="secondary">
                  建议包含门头、服务、菜品、环境与夜景
                </Typography.Text>
              </div>
              <Button icon={<CloudUploadOutlined />} onClick={simulateUpload} data-testid="brief-upload">
                模拟上传
              </Button>
            </div>
            <div className="brief-asset-grid">
              {selectedAssets.length === 0 ? (
                <div className="brief-asset-empty">暂无素材；点击“模拟上传”补齐示例</div>
              ) : (
                selectedAssets.map((asset, index) => (
                  <div className="brief-asset-card" key={asset.id}>
                    <img className="brief-asset-thumb" src={asset.thumbnail} alt={asset.name} />
                    <div className="brief-asset-card-meta">
                      <Typography.Text strong>{String(index + 1).padStart(2, '0')} · {asset.name}</Typography.Text>
                      <CloseCircleOutlined
                        className="brief-asset-remove"
                        role="button"
                        aria-label={`remove-${asset.id}`}
                        onClick={() => patch('assetIds', draft.assetIds.filter((id) => id !== asset.id))}
                      />
                    </div>
                    <Typography.Text type="secondary" className="brief-asset-meta">
                      类型 {asset.type} · 标签 {asset.tags.join(' / ')}
                    </Typography.Text>
                  </div>
                ))
              )}
            </div>
            <div className="brief-form-grid" style={{ marginTop: 14 }}>
              <label className="brief-field is-span-2">
                <span className="brief-field-label">备注 / 内容重点</span>
                <Input.TextArea
                  rows={3}
                  value={draft.notes}
                  onChange={(event) => patch('notes', event.target.value)}
                />
              </label>
              <label className="brief-field is-span-2">
                <span className="brief-field-label">禁忌与限制</span>
                <Select
                  mode="tags"
                  value={draft.restrictions}
                  onChange={(value) => patch('restrictions', value)}
                  options={draft.restrictions.map((value) => ({ value, label: value }))}
                />
              </label>
            </div>
          </section>
        </div>

        <aside className="brief-side-column">
          <section className="brief-side-panel">
            <div className="brief-side-title">
              <Typography.Text strong>实时摘要</Typography.Text>
              <Tag color="blue" style={{ marginLeft: 'auto' }}>
                预览
              </Tag>
            </div>
            <div className="brief-summary-list">
              <span className="brief-summary-label">业务类型</span>
              <span>本地探店</span>
              <span className="brief-summary-label">商家</span>
              <span>{draft.merchantName || '待填写'}</span>
              <span className="brief-summary-label">目标平台</span>
              <span>{draft.platforms.join(' / ') || '待选择'}</span>
              <span className="brief-summary-label">画面规格</span>
              <span>
                {draft.aspectRatio} · {draft.duration}s
              </span>
              <span className="brief-summary-label">目标受众</span>
              <span>{draft.targetAudience.slice(0, 2).join('、') || '待填写'}</span>
              <span className="brief-summary-label">CTA</span>
              <span>{draft.cta || '待填写'}</span>
              <span className="brief-summary-label">素材</span>
              <span>{draft.assetIds.length} 个引用</span>
            </div>
          </section>

          <BriefReadinessPanel
            missing={missing}
            onFocusMissing={() => formTopRef.current?.scrollIntoView({ behavior: 'smooth' })}
          />

          <section className="brief-side-panel">
            <div className="brief-side-title brief-side-title-ai">
              <RobotOutlined />
              <Typography.Text strong>AI 建议（Mock）</Typography.Text>
            </div>
            <ul className="brief-ai-list">
              <li>前三秒使用夜景 / 服务场景建立注意力</li>
              <li>价格与权益绑定 C3、C4、C6—C8</li>
              <li>结尾保留领券与到店核销的明确动作</li>
            </ul>
            <Button
              block
              style={{ marginTop: 14 }}
              loading={aiLoading}
              onClick={() => void applyAiSuggestions()}
              data-testid="brief-ai-suggest"
            >
              应用建议到备注
            </Button>
          </section>

          <Button
            type="primary"
            size="large"
            block
            icon={<ArrowRightOutlined />}
            disabled={missing.length > 0}
            onClick={() => void proceed('script')}
            className="brief-primary-cta"
          >
            保存并进入脚本
          </Button>
        </aside>
      </div>
    </div>
  );
}
