import { Alert, Button, Space, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_PROJECT_ID, PROJECT_STATUS_LABEL, ROUTES } from '../../domain/constants';
import { summarizeWorkspace } from '../../domain/selectors';
import { useProjectStore } from '../../stores/projectStore';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';

interface PagePlaceholderProps {
  title: string;
  owner: string;
  description: string;
  route: string;
}

export function PagePlaceholder({ title, owner, description, route }: PagePlaceholderProps) {
  const navigate = useNavigate();
  const workspace = useProjectStore((s) => s.workspace);
  const loading = useProjectStore((s) => s.loading);
  const error = useProjectStore((s) => s.error);
  const hydrated = useProjectStore((s) => s.hydrated);
  const hydrate = useProjectStore((s) => s.hydrate);
  const setActiveScript = useProjectStore((s) => s.setActiveScript);
  const summary = useMemo(() => summarizeWorkspace(workspace), [workspace]);

  if (!hydrated && loading) {
    return <LoadingState tip={`正在准备 ${title}...`} />;
  }

  if (error && !workspace.project.id) {
    return (
      <ErrorState
        title={`${title} 不可用`}
        subTitle={error}
        onRetry={() => void hydrate()}
        retryLoading={loading}
      />
    );
  }

  const metrics = [
    { label: '项目 ID', value: summary.projectId },
    { label: '项目状态', value: PROJECT_STATUS_LABEL[summary.status] ?? summary.status },
    { label: '进度', value: `${summary.progress}%` },
    { label: '负责人', value: summary.owner },
    { label: '品牌事实', value: `${summary.factCount} 条 (C1—C8)` },
    { label: '脚本版本', value: `${summary.scriptCount} / 当前 ${summary.activeScriptId}` },
    {
      label: '分镜',
      value: `${summary.shotCount} 镜 · 匹配 ${summary.matchedShots} · 缺 ${summary.missingShots}`,
    },
    { label: '时间线', value: `${summary.timelineDuration}s · 素材 ${summary.assetCount}` },
  ];

  const nextScript =
    workspace.scripts.find((script) => script.id !== workspace.activeScriptId)?.id ??
    workspace.activeScriptId;

  return (
    <div className="app-page-card app-page-section">
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {description}
        </Typography.Paragraph>
      </div>

      <Space wrap>
        <Tag color="blue">Gate 1 基座占位</Tag>
        <Tag>{owner}</Tag>
        <Tag color="default">{route}</Tag>
        <Tag color="processing">{summary.projectName}</Tag>
      </Space>

      <Alert
        type="info"
        showIcon
        message="统一 Demo 已接通"
        description={`当前工作区来自 mockApi + LocalStorage，项目 ID 固定为 ${DEMO_PROJECT_ID}。业务线程将在此基础上替换完整页面交互。`}
      />

      {error ? (
        <Alert
          type="warning"
          showIcon
          message="最近一次写操作失败"
          description={error}
          action={
            <Button size="small" onClick={() => void hydrate()} loading={loading}>
              重新加载
            </Button>
          }
        />
      ) : null}

      <div className="placeholder-grid">
        {metrics.map((item) => (
          <div key={item.label} className="placeholder-metric">
            <div className="placeholder-metric-label">{item.label}</div>
            <div className="placeholder-metric-value">{item.value}</div>
          </div>
        ))}
      </div>

      <Space wrap>
        <Button onClick={() => navigate(ROUTES.dashboard)}>工作台</Button>
        <Button onClick={() => navigate(ROUTES.projectNew)}>Brief</Button>
        <Button onClick={() => navigate(ROUTES.brand(DEMO_PROJECT_ID))}>品牌大脑</Button>
        <Button onClick={() => navigate(ROUTES.script(DEMO_PROJECT_ID))}>脚本</Button>
        <Button onClick={() => navigate(ROUTES.storyboard(DEMO_PROJECT_ID))}>分镜</Button>
        <Button onClick={() => navigate(ROUTES.roughCut(DEMO_PROJECT_ID))}>初剪</Button>
        <Button
          type="primary"
          loading={loading}
          onClick={() => void setActiveScript(nextScript)}
        >
          切换脚本版本（验证 Store）
        </Button>
      </Space>
    </div>
  );
}
