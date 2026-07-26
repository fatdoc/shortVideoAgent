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
  const dueDays = Math.max(
    0,
    Math.ceil(
      (new Date(workspace.project.dueDate).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24),
    ),
  );
  const dashboardRows = useMemo(() => {
    if (!workspace.project.id) {
      return [];
    }

    return [
      {
        id: workspace.project.id,
        name: workspace.project.name,
        scope: `${workspace.brief.city} · ${workspace.brief.platforms.join(' / ')}`,
        format: workspace.brief.aspectRatio,
        duration: `${workspace.brief.duration}s`,
        statusLabel: PROJECT_STATUS_LABEL[workspace.project.status] ?? workspace.project.status,
        progress: workspace.project.progress,
        owner: workspace.project.owner,
        dueDate: workspace.project.dueDate,
        dueDays,
        risks: summary.missingShots + summary.reshootShots,
        todo: '会员权益镜待补拍 / 跨镜段缺失',
        statusKey: workspace.project.status,
      },
    ];
  }, [dueDays, summary.missingShots, summary.reshootShots, workspace]);

  const visibleRows = useMemo(
    () =>
      dashboardRows.filter(
        (project) =>
          project.name.toLowerCase().includes(query.trim().toLowerCase()) &&
          (statusFilter === 'all' || project.statusKey === statusFilter),
      ),
    [dashboardRows, query, statusFilter],
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
              <Typography.Title level={5}>项目表格</Typography.Title>
              <Typography.Text type="secondary">当前工作区仅使用统一 Demo 主数据</Typography.Text>
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

          {visibleRows.length > 0 ? (
            <>
              <div className="project-list-head">
                <span>项目</span>
                <span>进度</span>
                <span>负责人 / 截止</span>
                <span>待办与动作</span>
              </div>
              <div className="project-list-body">
                {visibleRows.map((project) => (
                  <div
                    className="project-list-row"
                    key={project.id}
                    data-testid="dashboard-project-row"
                  >
                    <div className="project-list-main">
                      <div className="project-list-thumb">Hi</div>
                      <div className="project-list-copy">
                        <Typography.Text strong className="project-list-title">
                          {project.name}
                        </Typography.Text>
                        <div className="project-list-meta">
                          <Typography.Text type="secondary">
                            {project.scope} · {project.format} · {project.duration}
                          </Typography.Text>
                          <Tag color="blue" style={{ width: 'fit-content', margin: 0 }}>
                            {project.id}
                          </Tag>
                        </div>
                      </div>
                    </div>
                    <div className="project-cell-stack">
                      <Typography.Text type="secondary">当前进度</Typography.Text>
                      <div className="project-list-progress">
                        <Progress percent={project.progress} showInfo={false} />
                        <Typography.Text strong>{project.progress}%</Typography.Text>
                      </div>
                      <Tag color="processing" style={{ width: 'fit-content', margin: 0 }}>
                        {project.statusLabel}
                      </Tag>
                    </div>
                    <div className="project-cell-stack project-cell-due">
                      <Typography.Text type="secondary">负责人</Typography.Text>
                      <Typography.Text>{project.owner}</Typography.Text>
                      <Typography.Text type={project.dueDays <= 3 ? 'danger' : 'secondary'}>
                        {project.dueDate} · 约 {project.dueDays} 天
                      </Typography.Text>
                    </div>
                    <div className="project-row-actions">
                      <Tag color={project.risks > 0 ? 'orange' : 'success'}>待办 {project.risks}</Tag>
                      <Button size="small" onClick={() => navigate(ROUTES.projectNew)}>
                        编辑 Brief
                      </Button>
                      <Button
                        size="small"
                        type="primary"
                        icon={<ArrowRightOutlined />}
                        onClick={() => navigate(ROUTES.script(DEMO_PROJECT_ID))}
                        data-testid="dashboard-open-project"
                      >
                        继续制作
                      </Button>
                    </div>
                    <div className="project-cell-micro">
                      <Typography.Text type="secondary">聚焦项：</Typography.Text>
                      <Typography.Text type="secondary">{project.todo}</Typography.Text>
                    </div>
                  </div>
                ))}
              </div>
            </>
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
