import {
  ArrowRightOutlined,
  BarChartOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  PieChartOutlined,
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
import coffeeCaseCover from '../../components/project/assets/case-coffee.png';
import founderCaseCover from '../../components/project/assets/case-founder.png';
import localStoreCover from '../../components/project/assets/case-local-store.png';
import productCaseCover from '../../components/project/assets/case-product.png';
import sportsCaseCover from '../../components/project/assets/case-sports.png';
import '../../components/project/project-workflow.css';
import { DEMO_PROJECT_ID, PROJECT_STATUS_LABEL, ROUTES } from '../../domain/constants';
import { summarizeWorkspace } from '../../domain/selectors';
import { useProjectStore } from '../../stores/projectStore';

const localCasePreviews = [
  {
    id: 'preview-founder-002',
    name: '创始人 IP · 张总访谈',
    scope: '上海 · 视频号',
    format: '16:9',
    duration: '45s',
    statusLabel: '分镜中',
    progress: 56,
    owner: '张晓明',
    dueDate: '2026-08-08',
    dueDays: 13,
    risks: 1,
    statusKey: 'local-preview',
    thumbnail: founderCaseCover,
    isPrimary: false,
    typeLabel: '老板 IP',
  },
  {
    id: 'preview-product-003',
    name: '新品洗发水 · 电商大促',
    scope: '杭州 · 抖音 / 小红书',
    format: '9:16',
    duration: '30s',
    statusLabel: '素材中',
    progress: 70,
    owner: '王小川',
    dueDate: '2026-08-10',
    dueDays: 15,
    risks: 0,
    statusKey: 'local-preview',
    thumbnail: productCaseCover,
    isPrimary: false,
    typeLabel: '电商素材',
  },
  {
    id: 'preview-coffee-004',
    name: '瑞幸咖啡 · 夏季新品推广',
    scope: '北京 · 抖音',
    format: '9:16',
    duration: '30s',
    statusLabel: '初剪中',
    progress: 82,
    owner: '陈思思',
    dueDate: '2026-08-11',
    dueDays: 16,
    risks: 1,
    statusKey: 'local-preview',
    thumbnail: coffeeCaseCover,
    isPrimary: false,
    typeLabel: '本地探店',
  },
  {
    id: 'preview-sports-005',
    name: '运动鞋新品 · 投放素材',
    scope: '广州 · 快手 / 抖音',
    format: '9:16',
    duration: '20s',
    statusLabel: 'Brief 中',
    progress: 24,
    owner: '刘洋',
    dueDate: '2026-08-14',
    dueDays: 19,
    risks: 2,
    statusKey: 'local-preview',
    thumbnail: sportsCaseCover,
    isPrimary: false,
    typeLabel: '电商素材',
  },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const workspace = useProjectStore((state) => state.workspace);
  const error = useProjectStore((state) => state.error);
  const loading = useProjectStore((state) => state.loading);
  const hydrate = useProjectStore((state) => state.hydrate);
  const clearError = useProjectStore((state) => state.clearError);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCaseId, setSelectedCaseId] = useState(DEMO_PROJECT_ID);

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
        thumbnail: localStoreCover,
        isPrimary: true,
        typeLabel: '本地探店',
      },
      ...localCasePreviews,
    ];
  }, [dueDays, summary.missingShots, summary.reshootShots, workspace]);
  const selectedCase = useMemo(
    () => dashboardRows.find((project) => project.id === selectedCaseId) ?? dashboardRows[0],
    [dashboardRows, selectedCaseId],
  );

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
          value={28}
          hint="较昨日 ↑ 8%"
        />
        <ProjectMetricCard
          icon={<FileTextOutlined />}
          label="待审核脚本"
          value={16}
          hint="较昨日 ↑ 5%"
          tone="cyan"
        />
        <ProjectMetricCard
          icon={<VideoCameraOutlined />}
          label="今日生成任务"
          value={42}
          hint="较昨日 ↑ 16%"
          tone="green"
        />
        <ProjectMetricCard
          icon={<BarChartOutlined />}
          label="本周导出视频"
          value={86}
          hint="较上周 ↑ 22%"
          tone="blue"
        />
        <ProjectMetricCard
          icon={<CheckSquareOutlined />}
          label="总体预估收益（本月）"
          value="¥ 18,540"
          hint="较上月 ↑ 7%"
          tone="orange"
        />
      </div>

      <div className="project-dashboard-grid">
        <section className="project-surface">
          <div className="project-section-heading">
            <div>
              <Typography.Title level={5}>项目列表</Typography.Title>
              <Typography.Text type="secondary">
                本地案例目录；完整流程绑定 demo-local-001
              </Typography.Text>
            </div>
            <div className="project-list-tools">
              <Tag color={selectedCase?.isPrimary ? 'blue' : 'cyan'}>
                已选：{selectedCase?.name}
              </Tag>
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
                  { value: 'local-preview', label: '本地预览' },
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
                    className={`project-list-row ${selectedCaseId === project.id ? 'is-selected' : ''}`}
                    key={project.id}
                    data-testid="dashboard-project-row"
                  >
                    <div className="project-list-main">
                      <img
                        className="project-list-thumb"
                        src={project.thumbnail}
                        alt={`${project.name}项目缩略图`}
                      />
                      <div className="project-list-copy">
                        <Typography.Text strong className="project-list-title">
                          {project.name}
                        </Typography.Text>
                        <div className="project-list-meta">
                          <Typography.Text type="secondary">
                            {project.scope} · {project.format} · {project.duration}
                          </Typography.Text>
                          <Tag color={project.isPrimary ? 'blue' : 'cyan'} style={{ width: 'fit-content', margin: 0 }}>
                            {project.isPrimary ? project.id : `${project.typeLabel} · 本地预览`}
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
                      {project.isPrimary ? (
                        <>
                          <Button size="small" onClick={() => navigate(ROUTES.projectNew)}>
                            Brief
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
                        </>
                      ) : (
                        <Button
                          size="small"
                          type={selectedCaseId === project.id ? 'primary' : 'default'}
                          onClick={() => setSelectedCaseId(project.id)}
                          data-testid={`dashboard-select-${project.id}`}
                        >
                          {selectedCaseId === project.id ? '已选择' : '选择案例'}
                        </Button>
                      )}
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
            <div className="project-task-item">
              <span className="project-task-icon"><FileTextOutlined /></span>
              <span className="project-task-copy">
                <Typography.Text strong>创始人访谈待审</Typography.Text>
                <Typography.Text type="secondary">本地预览案例 · 1 条意见</Typography.Text>
              </span>
              <Button
                type="link"
                onClick={() => setSelectedCaseId('preview-founder-002')}
              >
                查看
              </Button>
            </div>
          </div>
        </aside>

        <WorkflowProgress progress={workspace.project.progress} />
      </div>

      <div className="dashboard-insights-grid" data-testid="dashboard-insights">
        <section className="project-surface dashboard-overview-panel">
          <div className="project-section-heading">
            <div>
              <Typography.Title level={5}>本周数据概览</Typography.Title>
              <Typography.Text type="secondary">统一 Demo 的关键生产数据</Typography.Text>
            </div>
            <BarChartOutlined className="dashboard-panel-icon" />
          </div>
          <div className="dashboard-overview-stats">
            <div>
              <Typography.Text type="secondary">项目推进</Typography.Text>
              <strong>{workspace.project.progress}%</strong>
              <span>当前处于脚本阶段</span>
            </div>
            <div>
              <Typography.Text type="secondary">素材就绪率</Typography.Text>
              <strong>
                {Math.round((summary.matchedShots / Math.max(summary.shotCount, 1)) * 100)}%
              </strong>
              <span>{summary.matchedShots} / {summary.shotCount} 镜已匹配</span>
            </div>
            <div>
              <Typography.Text type="secondary">事实就绪</Typography.Text>
              <strong>{summary.factCount}</strong>
              <span>C1—C8 可供脚本引用</span>
            </div>
            <div>
              <Typography.Text type="secondary">待处理</Typography.Text>
              <strong>{summary.missingShots + summary.reshootShots}</strong>
              <span>缺镜与补拍事项</span>
            </div>
          </div>
          <div className="dashboard-overview-trends">
            <div>
              <Typography.Text type="secondary">项目推进</Typography.Text>
              <Progress percent={workspace.project.progress} showInfo={false} size="small" />
              <strong>{workspace.project.progress}%</strong>
            </div>
            <div>
              <Typography.Text type="secondary">素材就绪</Typography.Text>
              <Progress
                percent={Math.round((summary.matchedShots / Math.max(summary.shotCount, 1)) * 100)}
                showInfo={false}
                size="small"
                strokeColor="#13c2c2"
              />
              <strong>
                {Math.round((summary.matchedShots / Math.max(summary.shotCount, 1)) * 100)}%
              </strong>
            </div>
            <div>
              <Typography.Text type="secondary">品牌事实</Typography.Text>
              <Progress
                percent={Math.round((summary.factCount / 8) * 100)}
                showInfo={false}
                size="small"
                strokeColor="#52c41a"
              />
              <strong>{summary.factCount} / 8</strong>
            </div>
          </div>
        </section>

        <section className="project-surface dashboard-records-panel">
          <div className="project-section-heading">
            <div>
              <Typography.Title level={5}>最近生成记录</Typography.Title>
              <Typography.Text type="secondary">当前案例的可演示产出</Typography.Text>
            </div>
            <ClockCircleOutlined className="dashboard-panel-icon" />
          </div>
          <div className="dashboard-record-list">
            <div className="dashboard-record-row">
              <FileTextOutlined />
              <span>
                <strong>{summary.activeScriptName}</strong>
                <small>{workspace.brief.aspectRatio} · {workspace.brief.duration}s</small>
              </span>
              <Tag color="processing">脚本中</Tag>
            </div>
            <div className="dashboard-record-row">
              <VideoCameraOutlined />
              <span>
                <strong>分镜素材匹配检查</strong>
                <small>{summary.matchedShots} 镜就绪 · {summary.reshootShots} 镜待补拍</small>
              </span>
              <Tag color={summary.missingShots > 0 ? 'orange' : 'success'}>
                待复核
              </Tag>
            </div>
            <div className="dashboard-record-row">
              <FileTextOutlined />
              <span>
                <strong>创始人访谈 · 口播版</strong>
                <small>16:9 · 本地预览案例</small>
              </span>
              <Tag color="cyan">待审核</Tag>
            </div>
            <div className="dashboard-record-row">
              <VideoCameraOutlined />
              <span>
                <strong>新品洗发水 · 大促素材</strong>
                <small>9:16 · 本地预览案例</small>
              </span>
              <Tag color="success">已完成</Tag>
            </div>
          </div>
        </section>

        <section className="project-surface dashboard-distribution-panel">
          <div className="project-section-heading">
            <div>
              <Typography.Title level={5}>项目类型</Typography.Title>
              <Typography.Text type="secondary">5 个本地演示案例 · 1 个完整 Demo</Typography.Text>
            </div>
            <PieChartOutlined className="dashboard-panel-icon" />
          </div>
          <div className="dashboard-distribution-content">
            <Progress
              type="circle"
              percent={40}
              size={74}
              strokeWidth={10}
              format={() => '5 案例'}
            />
            <div className="dashboard-distribution-legend">
              <Typography.Text><Tag color="blue">2</Tag>本地探店 · 40%</Typography.Text>
              <Typography.Text><Tag color="cyan">1</Tag>老板 IP · 20%</Typography.Text>
              <Typography.Text><Tag color="green">2</Tag>电商素材 · 40%</Typography.Text>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
