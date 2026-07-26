import {
  ArrowRightOutlined,
  BookOutlined,
  CheckCircleFilled,
  CloseCircleOutlined,
  CloudUploadOutlined,
  MobileOutlined,
  PlayCircleOutlined,
  PlaySquareOutlined,
  RobotOutlined,
  SaveOutlined,
  VideoCameraOutlined,
  WechatOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Input,
  InputNumber,
  Select,
  Steps,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BriefReadinessPanel } from '../../components/project';
import assetDiningThumbnail from '../../components/project/assets/asset-dining.png';
import assetHotpotThumbnail from '../../components/project/assets/asset-hotpot.png';
import assetNightThumbnail from '../../components/project/assets/asset-night.png';
import assetServiceThumbnail from '../../components/project/assets/asset-service.png';
import founderCover from '../../components/project/assets/case-founder.png';
import localStoreCover from '../../components/project/assets/case-local-store.png';
import productCover from '../../components/project/assets/case-product.png';
import '../../components/project/project-workflow.css';
import { DEMO_PROJECT_ID, ROUTES } from '../../domain/constants';
import type { AspectRatio, Asset, BusinessType, ProjectBrief } from '../../domain/types';
import { useProjectStore } from '../../stores/projectStore';

const businessOptions: Array<{
  value: BusinessType;
  title: string;
  description: string;
  thumbnail: string;
}> = [
  {
    value: 'local_store',
    title: '本地探店',
    description: '线下门店、体验种草、团购转化',
    thumbnail: localStoreCover,
  },
  {
    value: 'brand',
    title: '品牌内容',
    description: '品牌心智、活动传播与口碑',
    thumbnail: founderCover,
  },
  {
    value: 'product',
    title: '电商素材',
    description: '商品卖点、场景展示与转化',
    thumbnail: productCover,
  },
];

const aspectRatioOptions: AspectRatio[] = ['9:16', '16:9', '1:1'];
const platformOptions = [
  { value: '抖音', icon: <PlayCircleOutlined /> },
  { value: '快手', icon: <VideoCameraOutlined /> },
  { value: '视频号', icon: <WechatOutlined /> },
  { value: '小红书', icon: <BookOutlined /> },
  { value: 'B站', icon: <PlaySquareOutlined /> },
];
const briefSteps = [
  { title: 'Brief 填写' },
  { title: '生成脚本' },
  { title: '分镜与排期' },
  { title: '素材与预算确认' },
  { title: '完成创建' },
];
const assetThumbnailById: Record<string, string> = {
  'asset-storefront': assetNightThumbnail,
  'asset-welcome': assetServiceThumbnail,
  'asset-hotpot': assetHotpotThumbnail,
  'asset-tripe': assetHotpotThumbnail,
  'asset-dining': assetDiningThumbnail,
  'asset-night': assetNightThumbnail,
  'asset-shrimp': assetHotpotThumbnail,
};

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
  const businessLabel =
    businessOptions.find((option) => option.value === draft.businessType)?.title ??
    '待选择';

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

  const proceed = async () => {
    if (dirty) {
      const savedSuccessfully = await saveDraft();
      if (!savedSuccessfully) return;
    }
    navigate(ROUTES.script(DEMO_PROJECT_ID));
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

  const togglePlatform = (platform: string) => {
    patch(
      'platforms',
      draft.platforms.includes(platform)
        ? draft.platforms.filter((item) => item !== platform)
        : [...draft.platforms, platform],
    );
  };

  return (
    <div className="project-workflow-page" data-testid="brief-page" ref={formTopRef}>
      <div className="project-page-toolbar brief-page-toolbar">
        <div className="project-page-toolbar-copy">
          <Typography.Title level={3}>新建项目 / Brief</Typography.Title>
          <Typography.Text type="secondary">
            完成 Brief 后直接进入脚本生成。
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
            onClick={() => void proceed()}
            data-testid="brief-to-script"
          >
            下一步：生成脚本
          </Button>
        </div>
      </div>

      <div className="brief-step-bar">
        <Steps className="brief-steps" size="small" current={0} items={briefSteps} />
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
                <button
                  type="button"
                  key={option.value}
                  className={`brief-business-option ${draft.businessType === option.value ? 'is-active' : ''}`}
                  onClick={() => patch('businessType', option.value)}
                  aria-pressed={draft.businessType === option.value}
                >
                  <img
                    src={option.thumbnail}
                    alt={`${option.title}参考素材`}
                  />
                  <span>
                    <strong>{option.title}</strong>
                    <Typography.Text type="secondary">{option.description}</Typography.Text>
                  </span>
                  {draft.businessType === option.value ? (
                    <CheckCircleFilled className="brief-business-check" />
                  ) : null}
                </button>
              ))}
            </div>
          </section>

          <div className="brief-form-split">
            <div className="brief-form-stack">
              <section className="brief-form-section">
                <div className="brief-form-section-title">
                  <Typography.Title level={5} style={{ margin: 0 }}>
                    商家与项目
                  </Typography.Title>
                  <Typography.Text type="secondary">同步到品牌大脑与脚本</Typography.Text>
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

              <section className="brief-form-section brief-material-section">
                <div className="brief-form-section-title">
                  <Typography.Title level={5} style={{ margin: 0 }}>
                    素材上传
                  </Typography.Title>
                  <Typography.Text type="secondary">前端 Mock · 使用案例素材</Typography.Text>
                </div>
                <div className="brief-upload-zone">
                  <div>
                    <Typography.Text strong>已有 {draft.assetIds.length} 个素材引用</Typography.Text>
                    <Typography.Text type="secondary">门头、服务、菜品、环境与夜景</Typography.Text>
                  </div>
                  <Button
                    size="small"
                    icon={<CloudUploadOutlined />}
                    onClick={simulateUpload}
                    data-testid="brief-upload"
                  >
                    模拟上传
                  </Button>
                </div>
                <div className="brief-asset-grid">
                  {selectedAssets.length === 0 ? (
                    <div className="brief-asset-empty">暂无素材；点击“模拟上传”补齐示例</div>
                  ) : (
                    selectedAssets.map((asset, index) => (
                      <div className="brief-asset-card" key={asset.id}>
                        <div className="brief-asset-media">
                          <img
                            className="brief-asset-thumb"
                            src={assetThumbnailById[asset.id] ?? asset.thumbnail}
                            alt={asset.name}
                          />
                          <button
                            type="button"
                            className="brief-asset-remove"
                            aria-label={`remove-${asset.id}`}
                            onClick={() => patch('assetIds', draft.assetIds.filter((id) => id !== asset.id))}
                          >
                            <CloseCircleOutlined />
                          </button>
                        </div>
                        <Typography.Text className="brief-asset-name" ellipsis>
                          {String(index + 1).padStart(2, '0')} · {asset.name}
                        </Typography.Text>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <div className="brief-form-stack">
              <section className="brief-form-section">
                <div className="brief-form-section-title">
                  <Typography.Title level={5} style={{ margin: 0 }}>
                    目标与渠道
                  </Typography.Title>
                  <Typography.Text type="secondary">平台、规格、受众与转化</Typography.Text>
                </div>
                <div className="brief-field">
                  <span className="brief-field-label is-required">目标平台</span>
                  <div className="brief-platform-options">
                    {platformOptions.map((option) => {
                      const selected = draft.platforms.includes(option.value);
                      return (
                        <button
                          type="button"
                          key={option.value}
                          aria-label={option.value}
                          aria-pressed={selected}
                          className={selected ? 'is-active' : ''}
                          onClick={() => togglePlatform(option.value)}
                        >
                          <span aria-hidden="true">{option.icon}</span>
                          {option.value}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="brief-spec-row">
                  <div className="brief-field">
                    <span className="brief-field-label">视频比例</span>
                    <div className="brief-ratio-options">
                      {aspectRatioOptions.map((value) => (
                        <button
                          type="button"
                          key={value}
                          className={draft.aspectRatio === value ? 'is-active' : ''}
                          aria-pressed={draft.aspectRatio === value}
                          onClick={() => patch('aspectRatio', value)}
                        >
                          <MobileOutlined aria-hidden="true" />
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="brief-field brief-duration-field">
                    <span className="brief-field-label">视频时长</span>
                    <div className="brief-duration-control">
                      <InputNumber
                        min={15}
                        max={60}
                        value={draft.duration}
                        onChange={(value) => patch('duration', value ?? 30)}
                      />
                      <span>秒</span>
                    </div>
                  </label>
                </div>
                <label className="brief-field">
                  <span className="brief-field-label is-required">目标受众</span>
                  <Select
                    mode="tags"
                    value={draft.targetAudience}
                    onChange={(value) => patch('targetAudience', value)}
                    tokenSeparators={[',']}
                    options={draft.targetAudience.map((value) => ({ value, label: value }))}
                  />
                </label>
                <label className="brief-field">
                  <span className="brief-field-label is-required">目标 CTA</span>
                  <Input
                    value={draft.cta}
                    onChange={(event) => patch('cta', event.target.value)}
                    data-testid="brief-cta"
                  />
                </label>
              </section>

              <section className="brief-form-section">
                <div className="brief-form-section-title">
                  <Typography.Title level={5} style={{ margin: 0 }}>
                    备注与限制
                  </Typography.Title>
                  <Typography.Text type="secondary">供 AI 建议与脚本生成使用</Typography.Text>
                </div>
                <div className="brief-form-grid">
                  <label className="brief-field is-span-2">
                    <span className="brief-field-label">内容重点</span>
                    <Input.TextArea
                      rows={2}
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
          </div>
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
              <span>{businessLabel}</span>
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
            onClick={() => void proceed()}
            className="brief-primary-cta"
          >
            下一步：生成脚本
          </Button>
        </aside>
      </div>
    </div>
  );
}
