import { ArrowRightOutlined, SafetyCertificateOutlined, SaveOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BriefReadinessPanel } from '../../components/project';
import '../../components/project/project-workflow.css';
import { DEMO_PROJECT_ID, ROUTES } from '../../domain/constants';
import type { AspectRatio, BusinessType, ProjectBrief } from '../../domain/types';
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
  const [saved, setSaved] = useState(false);
  const formTopRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="project-workflow-page" data-testid="brief-page" ref={formTopRef}>
      <div className="project-page-toolbar">
        <div className="project-page-toolbar-copy">
          <Typography.Title level={3}>新建项目 / Brief</Typography.Title>
          <Typography.Text type="secondary">
            定义获客任务的平台、人群、限制和 CTA；资料缺失时先阻断后续生产。
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
              <Typography.Title level={5} style={{ margin: 0 }}>业务类型</Typography.Title>
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
              <Typography.Title level={5} style={{ margin: 0 }}>商家与项目</Typography.Title>
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
              <Typography.Title level={5} style={{ margin: 0 }}>目标与渠道</Typography.Title>
              <Typography.Text type="secondary">约束画面规格、时长、受众与转化动作</Typography.Text>
            </div>
            <div className="brief-form-grid">
              <label className="brief-field">
                <span className="brief-field-label is-required">目标平台</span>
                <Select
                  mode="multiple"
                  value={draft.platforms}
                  onChange={(value) => patch('platforms', value)}
                  options={['抖音', '快手', '视频号', '小红书', 'B站'].map((value) => ({
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
                    options={['9:16', '16:9', '1:1'].map((value) => ({ value, label: value }))}
                    style={{ width: '50%' }}
                  />
                  <InputNumber
                    min={15}
                    max={60}
                    value={draft.duration}
                    onChange={(value) => patch('duration', value ?? 30)}
                    style={{ width: 'calc(50% - 40px)' }}
                  />
                  <Button disabled style={{ width: 40, paddingInline: 0 }}>秒</Button>
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
              <Typography.Title level={5} style={{ margin: 0 }}>素材与内容约束</Typography.Title>
              <Typography.Text type="secondary">只引用当前工作区已有素材；缺失素材在资产入口补齐。</Typography.Text>
            </div>
            <div className="brief-upload-zone">
              <div>
                <Typography.Text strong>已有 {draft.assetIds.length} 个素材引用</Typography.Text>
                <br />
                <Typography.Text type="secondary">建议包含门头、服务、菜品、环境与夜景</Typography.Text>
              </div>
              <Tag color={draft.assetIds.length >= 5 ? 'green' : 'orange'}>
                {draft.assetIds.length >= 5 ? '素材可用' : '素材不足'}
              </Tag>
            </div>
            <div className="brief-asset-list">
              {draft.assetIds.map((assetId, index) => (
                <Tag
                  key={assetId}
                >
                  素材 {String(index + 1).padStart(2, '0')}
                </Tag>
              ))}
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
              <SafetyCertificateOutlined />
              <Typography.Text strong>获客任务</Typography.Text>
              <Tag style={{ marginLeft: 'auto' }}>{dirty ? '待保存' : '已同步'}</Tag>
            </div>
            <div className="brief-summary-list">
              <span className="brief-summary-label">业务类型</span><span>本地探店</span>
              <span className="brief-summary-label">门店</span><span>{draft.merchantName || '待填写'}</span>
              <span className="brief-summary-label">平台</span><span>{draft.platforms.join(' / ') || '待选择'}</span>
              <span className="brief-summary-label">画面规格</span><span>{draft.aspectRatio} · {draft.duration}s</span>
              <span className="brief-summary-label">人群</span><span>{draft.targetAudience.slice(0, 2).join('、') || '待填写'}</span>
              <span className="brief-summary-label">CTA</span><span>{draft.cta || '待填写'}</span>
              <span className="brief-summary-label">素材</span><span>{draft.assetIds.length} 个引用</span>
              <span className="brief-summary-label">限制</span><span>{draft.restrictions.length ? `${draft.restrictions.length} 条` : '待填写'}</span>
            </div>
          </section>

          <BriefReadinessPanel
            missing={missing}
            onFocusMissing={() => formTopRef.current?.scrollIntoView({ behavior: 'smooth' })}
          />

          <section className="brief-side-panel">
            <div className="brief-side-title">
              <Typography.Text strong>限制与阻断原因</Typography.Text>
            </div>
            <ul className="brief-ai-list">
              {(draft.restrictions.length ? draft.restrictions : ['限制待填写']).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <Button
            size="large"
            block
            icon={<ArrowRightOutlined />}
            disabled={missing.length > 0}
            onClick={() => void proceed('script')}
          >
            保存并进入脚本
          </Button>
        </aside>
      </div>
    </div>
  );
}
