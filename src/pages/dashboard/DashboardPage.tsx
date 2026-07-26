import {
  ArrowRightOutlined,
  CheckSquareOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  SearchOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Empty,
  Input,
  Progress,
  Select,
  Tag,
  Typography,
} from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectMetricCard, WorkflowProgress } from '../../components/project';
import '../../components/project/project-workflow.css';
import { DEMO_PROJECT_ID, PROJECT_STATUS_LABEL, ROUTES } from '../../domain/constants';
import { summarizeWorkspace } from '../../domain/selectors';
import { useProjectStore } from '../../stores/projectStore';

export function DashboardPage() {
  const navigate = useNavigate();
  const workspace = useProjectStore((state) => state.workspace);
  const error = useProjectStore((state) => state.error);
  const loading = useProjectStore((state) => state.loading);
  const hydrate = useProjectStore((state) => state.hydrate);
  const clearError = useProjectStore((state) => state.clearError);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const summary = useMemo(() => summarizeWorkspace(workspace), [workspace]);
  const visibleProject =
    workspace.project.id &&
    workspace.project.name.toLowerCase().includes(query.trim().toLowerCase()) &&
    (statusFilter === 'all' || workspace.project.status === statusFilter);

  const dueDays = Math.max(
    0,
    Math.ceil(
      (new Date(workspace.project.dueDate).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24),
    ),
  );

  return (
    <div className="project-workflow-page" data-testid="dashboard-page">
      <div className="project-page-toolbar">
        <div className="project-page-toolbar-copy">
          <Typography.Title level={3}>工作台</Typography.Title>
          <Typography.Text type="secondary">
            查看统一 Demo 的生产进度、待办风险与下一步动作。
          </Typography.Text>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={() => navigate(ROUTES.projectNew)}
          data-testid="dashboard-new-project"
        >
          新建项目
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

      <div className="project-metrics-grid">
        <ProjectMetricCard
          icon={<FolderOpenOutlined />}
          label="活跃项目"
          value={workspace.project.id ? 1 : 0}
          hint={`统一 Demo · ${PROJECT_STATUS_LABEL[workspace.project.status] ?? workspace.project.status}`}
        />
        <ProjectMetricCard
          icon={<FileTextOutlined />}
          label="品牌事实"
          value={summary.factCount}
          hint="C1—C8 可供脚本引用"
          tone="cyan"
        />
        <ProjectMetricCard
          icon={<VideoCameraOutlined />}
          label="分镜任务"
          value={summary.shotCount}
          hint={`${summary.matchedShots} 镜已匹配 · ${summary.reshootShots} 镜待补拍`}
          tone="green"
        />
        <ProjectMetricCard
          icon={<CheckSquareOutlined />}
          label="待处理风险"
          value={summary.missingShots + summary.reshootShots}
          hint="缺镜与补拍将影响导出"
          tone="orange"
        />
      </div>

      <div className="project-dashboard-grid">
        <section className="project-surface">
          <div className="project-section-heading">
            <div>
              <Typography.Title level={5}>项目列表</Typography.Title>
              <Typography.Text type="secondary">当前工作区只使用统一 Demo 项目</Typography.Text>
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
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 122 }}
                options={[
                  { value: 'all', label: '全部状态' },
                  { value: workspace.project.status, label: PROJECT_STATUS_LABEL[workspace.project.status] ?? '进行中' },
                ]}
              />
            </div>
          </div>

          {visibleProject ? (
            <div className="project-list-row" data-testid="dashboard-project-row">
              <div className="project-list-main">
                <div className="project-list-thumb">Hi</div>
                <div className="project-list-copy">
                  <Typography.Text strong className="project-list-title">
                    {workspace.project.name}
                  </Typography.Text>
                  <div className="project-list-meta">
                    <Typography.Text type="secondary">
                      本地探店 · 抖音 · {workspace.brief.aspectRatio} · {workspace.brief.duration}s
                    </Typography.Text>
                    <Tag color="blue" style={{ width: 'fit-content', margin: 0 }}>
                      demo-local-001
                    </Tag>
                  </div>
                </div>
              </div>
              <div className="project-cell-stack">
                <Typography.Text type="secondary">当前进度</Typography.Text>
                <div className="project-list-progress">
                  <Progress percent={workspace.project.progress} showInfo={false} />
                  <Typography.Text strong>{workspace.project.progress}%</Typography.Text>
                </div>
                <Tag color="processing" style={{ width: 'fit-content', margin: 0 }}>
                  {PROJECT_STATUS_LABEL[workspace.project.status] ?? workspace.project.status}
                </Tag>
              </div>
              <div className="project-cell-stack project-cell-due">
                <Typography.Text type="secondary">负责人 / 截止</Typography.Text>
                <Typography.Text>{workspace.project.owner}</Typography.Text>
                <Typography.Text type={dueDays <= 3 ? 'danger' : 'secondary'}>
                  {workspace.project.dueDate} · {dueDays} 天
                </Typography.Text>
              </div>
              <div className="project-row-actions">
                <Button onClick={() => navigate(ROUTES.projectNew)}>编辑 Brief</Button>
                <Button
                  type="primary"
                  icon={<ArrowRightOutlined />}
                  onClick={() => navigate(ROUTES.script(DEMO_PROJECT_ID))}
                  data-testid="dashboard-open-project"
                >
                  继续制作
                </Button>
              </div>
            </div>
          ) : (
            <Empty description="没有匹配的项目" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button onClick={() => {
                setQuery('');
                setStatusFilter('all');
              }}>
                清除筛选
              </Button>
            </Empty>
          )}
        </section>

        <aside className="project-surface">
          <div className="project-section-heading">
            <div>
              <Typography.Title level={5}>当前待办</Typography.Title>
              <Typography.Text type="secondary">优先处理会阻断导出的事项</Typography.Text>
            </div>
          </div>
          <div className="project-task-list">
            <div className="project-task-item">
              <span className="project-task-icon"><VideoCameraOutlined /></span>
              <span className="project-task-copy">
                <Typography.Text strong>虾滑制作待补拍</Typography.Text>
                <Typography.Text type="secondary">分镜 05 · matchStatus=reshoot</Typography.Text>
              </span>
              <Tag color="orange">1</Tag>
            </div>
            <div className="project-task-item">
              <span className="project-task-icon"><FileTextOutlined /></span>
              <span className="project-task-copy">
                <Typography.Text strong>会员权益缺镜</Typography.Text>
                <Typography.Text type="secondary">分镜 07 · 将阻断导出</Typography.Text>
              </span>
              <Tag color="red">1</Tag>
            </div>
            <div className="project-task-item">
              <span className="project-task-icon"><CheckSquareOutlined /></span>
              <span className="project-task-copy">
                <Typography.Text strong>复核脚本版本</Typography.Text>
                <Typography.Text type="secondary">{summary.activeScriptName}</Typography.Text>
              </span>
              <Button type="link" onClick={() => navigate(ROUTES.script(DEMO_PROJECT_ID))}>
                去处理
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <WorkflowProgress progress={workspace.project.progress} />
    </div>
  );
}
