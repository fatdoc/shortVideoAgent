import {
  Alert,
  App,
  Button,
  Dropdown,
  Progress,
  Select,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  ArrowRightOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DragOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  LoadingOutlined,
  MoreOutlined,
  PictureOutlined,
  PlusOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate, useParams } from 'react-router-dom';
import { Cell, Pie, PieChart } from 'recharts';
import {
  DEMO_PROJECT_ID,
  MATCH_STATUS_LABEL,
  ROUTES,
  RISK_LEVEL_LABEL,
} from '../../domain/constants';
import { getActiveScript, isDemoProject } from '../../domain/selectors';
import type { AssetMatchStatus, ScriptBlock, ShotStatus, StoryboardShot } from '../../domain/types';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { StatusTag } from '../../components/common/StatusTag';
import {
  BLOCK_TYPES_ORDER,
  mapShotsToBlocks,
  matchStatusToShotStatus,
  reorderByDrag,
} from '../../components/storyboard/storyboardUtils';
import '../../components/storyboard/storyboard.css';
import { useProjectStore } from '../../stores/projectStore';
import shot01Visual from '../../components/storyboard/assets/shot-01.png';
import shot02Visual from '../../components/storyboard/assets/shot-02.png';
import shot03Visual from '../../components/storyboard/assets/shot-03.png';
import shot04Visual from '../../components/storyboard/assets/shot-04.png';
import shot05Visual from '../../components/storyboard/assets/shot-05.png';
import shot06Visual from '../../components/storyboard/assets/shot-06.png';
import shot07Visual from '../../components/storyboard/assets/shot-07.png';
import shot08Visual from '../../components/storyboard/assets/shot-08.png';

interface ShotForRender {
  shot: StoryboardShot;
  scriptBlock: ScriptBlock | null;
}

interface DonutItem {
  color: string;
  value: number;
}

const ASSET_PLACEHOLDER = '/placeholders/storefront.svg';

const SHOT_VISUALS: Record<string, string> = {
  'shot-01': shot02Visual,
  'shot-02': shot03Visual,
  'shot-03': shot01Visual,
  'shot-04': shot05Visual,
  'shot-05': shot07Visual,
  'shot-06': shot04Visual,
  'shot-07': shot06Visual,
  'shot-08': shot08Visual,
};

const BUILD_INSTRUCTION: Record<string, string> = {
  hook: 'Hook',
  body: 'Body',
  proof: 'Proof',
  cta: 'CTA',
  disclaimer: 'Disclaimer',
};

const ASSIGNEE_OPTIONS = [
  { value: '拍摄组 A', label: '拍摄组 A' },
  { value: '拍摄组 B', label: '拍摄组 B' },
  { value: '拍摄组 C', label: '拍摄组 C' },
  { value: '内容组', label: '内容组' },
  { value: '', label: '待分配' },
];

const MATCH_STATUS_OPTIONS = [
  { value: 'matched', label: MATCH_STATUS_LABEL.matched },
  { value: 'reshoot', label: MATCH_STATUS_LABEL.reshoot },
  { value: 'missing', label: MATCH_STATUS_LABEL.missing },
  { value: 'ai_placeholder', label: MATCH_STATUS_LABEL.ai_placeholder },
];

const SHOT_STATUS_LABEL: Record<ShotStatus, string> = {
  planned: '计划中',
  ready: '可拍',
  shooting: '拍摄中',
  done: '已完成',
  missing: '缺镜',
};

const SHOT_STATUS_OPTIONS: Array<{ value: ShotStatus; label: string }> = [
  { value: 'planned', label: SHOT_STATUS_LABEL.planned },
  { value: 'ready', label: SHOT_STATUS_LABEL.ready },
  { value: 'shooting', label: SHOT_STATUS_LABEL.shooting },
  { value: 'done', label: SHOT_STATUS_LABEL.done },
  { value: 'missing', label: SHOT_STATUS_LABEL.missing },
];

function formatOrder(order: number) {
  return `#${String(order).padStart(2, '0')}`;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day} ${hours}:${minutes}`;
}

function DonutStat({
  items,
  label,
  total,
  size = 86,
}: {
  items: DonutItem[];
  label: string;
  total: number;
  size?: number;
}) {
  const data = items.filter((item) => item.value > 0);

  return (
    <div
      className="storyboard-donut"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label} ${total}`}
    >
      <PieChart width={size} height={size}>
        <Pie
          data={data.length ? data : [{ value: 1, color: '#E7EBF1' }]}
          dataKey="value"
          innerRadius={Math.round(size * 0.34)}
          outerRadius={Math.round(size * 0.47)}
          paddingAngle={1}
          stroke="none"
        >
          {(data.length ? data : [{ value: 1, color: '#E7EBF1' }]).map((item, index) => (
            <Cell key={`${item.color}-${index}`} fill={item.color} />
          ))}
        </Pie>
      </PieChart>
      <span className="storyboard-progress-label">
        <small>{label}</small>
        <strong>{total}</strong>
      </span>
    </div>
  );
}

function isBlocking(status: AssetMatchStatus) {
  return status === 'reshoot' || status === 'missing';
}

function scriptBlockLabel(block: ScriptBlock | null) {
  if (!block) {
    return '未映射到脚本段';
  }

  return `${BUILD_INSTRUCTION[block.type]} · ${block.duration}s`;
}

function getScriptText(block: ScriptBlock | null) {
  if (!block) {
    return '该镜头当前未映射到统一脚本块。';
  }

  return block.content || '该脚本块未填写内容';
}

function ShotRow({
  shot,
  scriptBlock,
  thumbnail,
  expanded,
  disabled,
  onToggleExpand,
  onUpdateAssignee,
  onUpdateMatchStatus,
  onUpdateShotStatus,
}: {
  shot: StoryboardShot;
  scriptBlock: ScriptBlock | null;
  thumbnail: string;
  expanded: boolean;
  disabled: boolean;
  onToggleExpand: (shotId: string) => void;
  onUpdateAssignee: (shotId: string, assignee: string | null) => Promise<void>;
  onUpdateMatchStatus: (shotId: string, status: AssetMatchStatus) => Promise<void>;
  onUpdateShotStatus: (shotId: string, status: ShotStatus) => Promise<void>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shot.id, disabled });

  return (
    <div
      ref={setNodeRef}
      className={`storyboard-shot-row ${expanded ? 'is-expanded' : ''} ${isDragging ? 'is-dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid={`storyboard-shot-${formatOrder(shot.order)}`}
      aria-label={`镜头 ${formatOrder(shot.order)}`}
    >
      <div className="storyboard-shot-row-head">
        <Tooltip title={disabled ? '当前不可操作' : '拖拽排序'}>
          <button
            type="button"
            className="storyboard-drag-handle"
            disabled={disabled}
            {...listeners}
            {...attributes}
            ref={setActivatorNodeRef}
            aria-label={`拖拽镜头 ${formatOrder(shot.order)}`}
          >
            <DragOutlined />
          </button>
        </Tooltip>

        <span className="storyboard-order-badge">{String(shot.order).padStart(2, '0')}</span>

        <div className="storyboard-shot-thumbnail-wrap">
          <img src={thumbnail} alt={shot.description} className="storyboard-shot-thumbnail" />
          <span>{formatDuration(shot.duration)}</span>
        </div>

        <div className="storyboard-shot-cell storyboard-shot-description">
          <Typography.Text type="secondary">画面说明</Typography.Text>
          <Typography.Text strong>{shot.description}</Typography.Text>
        </div>

        <div className="storyboard-shot-cell storyboard-shot-position">
          <Typography.Text type="secondary">景别/机位</Typography.Text>
          <Typography.Text>{shot.shotType} / {shot.cameraPosition}</Typography.Text>
        </div>

        <div className="storyboard-shot-cell storyboard-shot-dialogue">
          <Typography.Text type="secondary">台词/旁白</Typography.Text>
          <Typography.Text>{getScriptText(scriptBlock)}</Typography.Text>
        </div>

        <div className="storyboard-shot-cell storyboard-shot-screen">
          <Typography.Text type="secondary">屏幕文字</Typography.Text>
          <Typography.Text>{shot.screenText || '—'}</Typography.Text>
        </div>

        <div className="storyboard-shot-cell storyboard-shot-source">
          <Typography.Text type="secondary">素材来源</Typography.Text>
          <Typography.Text>{shot.assetId ? '原创拍摄' : '待补素材'}</Typography.Text>
        </div>

        <div className="storyboard-shot-cell storyboard-shot-risk">
          <Typography.Text type="secondary">风险标签</Typography.Text>
          <Tag color={isBlocking(shot.matchStatus) ? 'orange' : 'green'}>
            {isBlocking(shot.matchStatus)
              ? MATCH_STATUS_LABEL[shot.matchStatus]
              : RISK_LEVEL_LABEL[shot.riskLevel] ?? '低风险'}
          </Tag>
        </div>

        <div className="storyboard-shot-head-actions">
          <Button
            size="small"
            type="text"
            icon={<MoreOutlined />}
            aria-label="展开编辑"
            onClick={() => {
              onToggleExpand(shot.id);
            }}
            disabled={disabled}
          />
          {expanded ? (
            <Typography.Text type="secondary" className="storyboard-expanded-indicator">
              已展开
            </Typography.Text>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="storyboard-shot-details" aria-expanded>
          <div className="storyboard-shot-detail-item is-wide">
            <Typography.Text type="secondary">拍摄建议</Typography.Text>
            <Typography.Text>{shot.narration}</Typography.Text>
          </div>
          <div className="storyboard-shot-detail-item">
            <Typography.Text type="secondary">拍摄时段</Typography.Text>
            <Typography.Text>{shot.order >= 8 ? '夜间 20:00-22:00' : '晚间 18:00-20:00'}</Typography.Text>
          </div>
          <div className="storyboard-shot-detail-item">
            <Typography.Text type="secondary">所需设备</Typography.Text>
            <Typography.Text>{shot.shotType.includes('close') ? '微距镜头 / 稳定器' : '稳定器 / 广角镜头'}</Typography.Text>
          </div>
          <div className="storyboard-shot-detail-item">
            <Typography.Text type="secondary">指派人员</Typography.Text>
            <Select
              size="small"
              options={ASSIGNEE_OPTIONS}
              value={shot.assignee ?? ''}
              onChange={(value) => {
                void onUpdateAssignee(shot.id, value);
              }}
              data-testid={`storyboard-assignee-${shot.id}`}
              disabled={disabled}
            />
          </div>
          <div className="storyboard-shot-detail-item">
            <Typography.Text type="secondary">拍摄状态</Typography.Text>
            <Select
              size="small"
              options={SHOT_STATUS_OPTIONS}
              value={shot.status}
              onChange={(value) => {
                void onUpdateShotStatus(shot.id, value);
              }}
              data-testid={`storyboard-status-${shot.id}`}
              disabled={disabled}
            />
          </div>
          <div className="storyboard-shot-detail-item">
            <Typography.Text type="secondary">素材匹配</Typography.Text>
            <Select
              size="small"
              options={MATCH_STATUS_OPTIONS}
              value={shot.matchStatus}
              onChange={(value) => {
                void onUpdateMatchStatus(shot.id, value);
              }}
              data-testid={`storyboard-match-${shot.id}`}
              disabled={disabled}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function StoryboardPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { projectId } = useParams();

  const workspace = useProjectStore((state) => state.workspace);
  const loading = useProjectStore((state) => state.loading);
  const error = useProjectStore((state) => state.error);
  const hydrated = useProjectStore((state) => state.hydrated);
  const hydrate = useProjectStore((state) => state.hydrate);
  const updateStoryboard = useProjectStore((state) => state.updateStoryboard);
  const clearError = useProjectStore((state) => state.clearError);

  const activeScript = useMemo(() => getActiveScript(workspace), [workspace]);
  const [shots, setShots] = useState(workspace.storyboard);
  const [expandedShot, setExpandedShot] = useState<string | null>('shot-02');
  const [batchAssignee, setBatchAssignee] = useState('拍摄组 A');
  const [activeTab, setActiveTab] = useState('shots');
  const [persisting, setPersisting] = useState(false);

  useEffect(() => {
    setShots(workspace.storyboard);
  }, [workspace.storyboard]);

  const isBusy = loading || persisting;
  const isValidProject = isDemoProject(projectId);

  const activeScriptBlocks = useMemo(() => {
    if (!activeScript) return [];

    const order = new Map<string, number>();
    BLOCK_TYPES_ORDER.forEach((type, index) => {
      order.set(type, index);
    });

    return [...activeScript.blocks].sort((a, b) => {
      const rankA = order.get(a.type) ?? Number.MAX_SAFE_INTEGER;
      const rankB = order.get(b.type) ?? Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) return rankA - rankB;
      return a.id.localeCompare(b.id);
    });
  }, [activeScript]);

  const assetById = useMemo(() => {
    const map = new Map<string, string>();
    for (const asset of workspace.assets) {
      map.set(asset.id, asset.thumbnail);
    }
    return map;
  }, [workspace.assets]);

  const shotItems = useMemo<ShotForRender[]>(() => {
    return mapShotsToBlocks(shots, activeScriptBlocks);
  }, [shots, activeScriptBlocks]);

  const blocking = useMemo(
    () => shotItems.filter((item) => isBlocking(item.shot.matchStatus)),
    [shotItems],
  );
  const matched = useMemo(
    () => shotItems.filter((item) => item.shot.matchStatus === 'matched').length,
    [shotItems],
  );
  const missing = useMemo(
    () => shotItems.filter((item) => item.shot.matchStatus === 'missing').length,
    [shotItems],
  );
  const reshoot = useMemo(
    () => shotItems.filter((item) => item.shot.matchStatus === 'reshoot').length,
    [shotItems],
  );
  const totalDuration = useMemo(
    () => shotItems.reduce((sum, item) => sum + item.shot.duration, 0),
    [shotItems],
  );
  const completedTasks = useMemo(
    () => shotItems.filter((item) => item.shot.status === 'done').length,
    [shotItems],
  );
  const shootingTasks = useMemo(
    () => shotItems.filter((item) => item.shot.status === 'shooting').length,
    [shotItems],
  );
  const pendingTasks = shotItems.filter((item) =>
    item.shot.status === 'planned' || item.shot.status === 'ready'
  ).length;
  const completionPercent = shotItems.length
    ? Math.round((completedTasks / shotItems.length) * 100)
    : 0;

  const readyForCut = matched === shotItems.length && shotItems.length > 0;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
  );

  const persist = useCallback(
    async (nextShots: StoryboardShot[], successMessage: string) => {
      setPersisting(true);
      setShots(nextShots);
      try {
        await updateStoryboard(nextShots);
        message.success(successMessage);
      } catch (updateError) {
        const fallback = useProjectStore.getState().workspace.storyboard;
        setShots(fallback);
        const msg = updateError instanceof Error ? updateError.message : '保存分镜更新失败';
        message.error(msg);
      } finally {
        setPersisting(false);
      }
    },
    [message, updateStoryboard],
  );

  const patchShot = useCallback(
    async (shotId: string, next: Partial<StoryboardShot>) => {
      const nextShots = shots.map((shot) => (shot.id === shotId ? { ...shot, ...next } : shot));
      await persist(nextShots, '镜头信息已更新。');
    },
    [persist, shots],
  );

  const updateAssignee = useCallback(
    (shotId: string, assignee: string | null) => {
      return patchShot(shotId, { assignee: assignee || undefined });
    },
    [patchShot],
  );

  const updateMatchStatus = useCallback(
    (shotId: string, matchStatus: AssetMatchStatus) => {
      return patchShot(shotId, {
        matchStatus,
        status: matchStatusToShotStatus(matchStatus),
      });
    },
    [patchShot],
  );

  const updateShotStatus = useCallback(
    (shotId: string, status: ShotStatus) => {
      return patchShot(shotId, { status });
    },
    [patchShot],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || isBusy) {
        return;
      }

      const nextShots = reorderByDrag(shots, String(active.id), String(over.id));
      if (nextShots === shots) {
        return;
      }

      void persist(nextShots, '分镜顺序已更新。');
    },
    [isBusy, persist, shots],
  );

  const handleBatchAssign = useCallback(async (assignee = batchAssignee) => {
    setBatchAssignee(assignee);
    const nextShots = shots.map((shot) => ({
      ...shot,
      assignee,
    }));
    await persist(nextShots, `已为全部镜头指派：${assignee}`);
  }, [batchAssignee, persist, shots]);

  const handleBatchStartCapture = useCallback(async () => {
    const nextShots = shots.map((shot) =>
      isBlocking(shot.matchStatus)
        ? {
            ...shot,
            status: 'shooting' as ShotStatus,
            assignee: shot.assignee || batchAssignee,
          }
        : shot,
    );
    await persist(nextShots, '缺镜/待补拍镜头已标记为拍摄中。');
  }, [batchAssignee, persist, shots]);

  if (!isValidProject) {
    return (
      <ErrorState
        title="项目不存在"
        subTitle={`仅支持统一 Demo 项目 ${DEMO_PROJECT_ID}，当前为 ${projectId}`}
        onRetry={() => navigate(ROUTES.storyboard(DEMO_PROJECT_ID))}
        retryLabel="打开分镜（统一项目）"
      />
    );
  }

  if (!hydrated && loading) {
    return <LoadingState tip="正在加载分镜工作区..." />;
  }

  if (error && !workspace.project.id) {
    return <ErrorState title="分镜页不可用" subTitle={error} onRetry={() => void hydrate()} retryLoading={loading} />;
  }

  if (!shots.length) {
    return (
      <EmptyState
        description="暂无分镜数据。请先刷新 Demo 数据或返回脚本页重建。"
        actionLabel="重新加载"
        onAction={() => void hydrate()}
        loading={loading}
      />
    );
  }

  const renderShotRows = () => (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <SortableContext items={shotItems.map(({ shot }) => shot.id)} strategy={verticalListSortingStrategy}>
        <div className="storyboard-shot-list">
          {shotItems.map((item) => {
            const assetThumb = SHOT_VISUALS[item.shot.id]
              ?? (item.shot.assetId ? assetById.get(item.shot.assetId) ?? ASSET_PLACEHOLDER : ASSET_PLACEHOLDER);
            return (
              <ShotRow
                key={item.shot.id}
                shot={item.shot}
                scriptBlock={item.scriptBlock}
                thumbnail={assetThumb}
                expanded={expandedShot === item.shot.id}
                disabled={isBusy}
                onToggleExpand={(shotId) => {
                  setExpandedShot((current) => (current === shotId ? null : shotId));
                }}
                onUpdateAssignee={updateAssignee}
                onUpdateMatchStatus={updateMatchStatus}
                onUpdateShotStatus={updateShotStatus}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );

  const renderShootList = () => (
    <div className="storyboard-shooting-list">
      {shotItems.map((item) => (
        <div key={item.shot.id} className="storyboard-shooting-item">
          <div className="storyboard-shooting-title">
            <Typography.Text strong>{formatOrder(item.shot.order)}</Typography.Text>
            <Typography.Text>{item.shot.description}</Typography.Text>
          </div>
          <div className="storyboard-shooting-tags">
            <StatusTag kind="match" value={item.shot.matchStatus} />
            <Tag color={item.shot.assignee ? 'blue' : 'default'}>{item.shot.assignee || '待分配'}</Tag>
            <Tag color={isBlocking(item.shot.matchStatus) ? 'red' : 'green'}>
              {MATCH_STATUS_LABEL[item.shot.matchStatus]}
            </Tag>
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {scriptBlockLabel(item.scriptBlock)}
          </Typography.Text>
        </div>
      ))}
    </div>
  );

  return (
    <section className="storyboard-page" data-testid="storyboard-page">
      <div className="storyboard-toolbar">
        <div className="storyboard-breadcrumb">
          <span>项目</span>
          <i>/</i>
          <span>{workspace.brief.merchantName}</span>
          <i>/</i>
          <strong>分镜</strong>
        </div>

        <div className="storyboard-project-header">
          <div className="storyboard-title-wrap">
            <div className="storyboard-project-title">
              <Typography.Title level={3} style={{ margin: 0 }}>
                {workspace.project.name}
              </Typography.Title>
              <EditOutlined />
            </div>
            <div className="storyboard-project-meta">
              <Tag color="success">执行中</Tag>
              <span>时长预估 {formatDuration(totalDuration)}</span>
              <i />
              <span>画面数 {shotItems.length}</span>
              <i />
              <span>版本 {activeScript?.name.replace(/^版本\s*/, '') ?? '未加载'}</span>
              <i />
              <span>更新于 {formatUpdatedAt(workspace.project.updatedAt)}</span>
            </div>
          </div>

          <div className="storyboard-top-actions">
            <Button
              icon={<DragOutlined />}
              onClick={() => message.info('拖拽每行左侧手柄即可调整镜头顺序。')}
              disabled={isBusy}
            >
              拖拽排序
            </Button>

            <Dropdown
              menu={{
                items: ASSIGNEE_OPTIONS.filter((item) => item.value !== '').map((item) => ({
                  key: item.value,
                  label: item.label,
                })),
                onClick: ({ key }) => {
                  void handleBatchAssign(key);
                },
              }}
              trigger={['click']}
            >
              <Button icon={<UserOutlined />} disabled={isBusy}>
                批量指派
              </Button>
            </Dropdown>

            <Button
              icon={<FileTextOutlined />}
              onClick={() => setActiveTab('list')}
              disabled={isBusy}
            >
              生成拍摄清单
            </Button>

            <Tooltip title={readyForCut ? '进入初剪' : '缺镜/待补拍未完成，禁止进入初剪'}>
              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                onClick={() => navigate(ROUTES.roughCut(DEMO_PROJECT_ID))}
                loading={loading}
                disabled={!readyForCut || isBusy}
                data-testid="storyboard-enter-rough-cut"
              >
                进入初剪
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>

      {error ? (
        <Alert
          type="warning"
          showIcon
          closable
          message="最近一次操作异常"
          description={error}
          action={<Button size="small" onClick={() => void hydrate()} loading={loading}>重试</Button>}
          onClose={() => {
            clearError();
          }}
        />
      ) : null}

      <div className="storyboard-layout">
        <main className="storyboard-main">
          <Tabs
            className="storyboard-tabs"
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'shots',
                label: '分镜视图',
                children: (
                  <div className="storyboard-section">
                    <div className="storyboard-section-head">
                      <div>
                        <Typography.Text type="secondary">
                          脚本已拆解为可执行的分镜头，支持调整镜头顺序、指派与生成拍摄清单。
                        </Typography.Text>
                      </div>
                      <div className="storyboard-shot-toolbar">
                        <Tag color="default">共 {shotItems.length} 镜</Tag>
                        <Tag icon={readyForCut ? <CheckCircleOutlined /> : <LoadingOutlined />}>
                          {readyForCut ? '可进入初剪' : '待拍摄齐全后可进入初剪'}
                        </Tag>
                      </div>
                    </div>

                    {renderShotRows()}
                    <div className="storyboard-list-footer">
                      <Button type="link" size="small" icon={<PlusOutlined />}>
                        添加镜头
                      </Button>
                      <span>
                        共 {shotItems.length} 个镜头
                        <i />
                        时长预估 {formatDuration(totalDuration)}
                      </span>
                    </div>
                  </div>
                ),
              },
              {
                key: 'list',
                label: '拍摄清单',
                children: (
                  <div className="storyboard-section">
                    <div className="storyboard-section-head">
                      <div>
                        <Typography.Title level={5} style={{ margin: 0 }}>
                          拍摄清单
                        </Typography.Title>
                        <Typography.Text type="secondary">
                          按镜头、脚本片段和状态快速分发拍摄
                        </Typography.Text>
                      </div>
                      <div className="storyboard-shooting-actions">
                        <Button
                          size="small"
                          icon={<ClockCircleOutlined />}
                          disabled={isBusy || blocking.length === 0}
                          onClick={() => void handleBatchStartCapture()}
                        >
                          待补拍转拍摄中
                        </Button>
                        <Button
                          size="small"
                          type="text"
                          icon={<UserOutlined />}
                          disabled={isBusy}
                          onClick={() => setExpandedShot(null)}
                        >
                          收起全部编辑
                        </Button>
                      </div>
                    </div>
                    {renderShootList()}
                  </div>
                ),
              },
            ]}
          />
        </main>

        <aside className="storyboard-right">
          <section className="storyboard-side-card app-page-card">
            <div className="storyboard-side-card-head">
              <Typography.Title level={5}><CameraOutlined /> 拍摄任务</Typography.Title>
              <Button type="link" size="small">全部查看</Button>
            </div>
            <div className="storyboard-task-overview">
              <DonutStat
                size={86}
                label="总任务"
                total={shotItems.length}
                items={[
                  { value: pendingTasks, color: '#4F8DF7' },
                  { value: shootingTasks, color: '#FAAD14' },
                  { value: completedTasks, color: '#35BE7A' },
                  { value: missing, color: '#FF5D66' },
                ]}
              />
              <div className="storyboard-task-legend">
                <span><i className="is-blue" />待拍摄 <strong>{pendingTasks}</strong></span>
                <span><i className="is-orange" />拍摄中 <strong>{shootingTasks}</strong></span>
                <span><i className="is-green" />已完成 <strong>{completedTasks}</strong></span>
                <span><i className="is-red" />已逾期 <strong>{missing}</strong></span>
              </div>
            </div>
            <div className="storyboard-side-progress">
              <span>今日计划拍摄 <strong>{completedTasks}/{Math.max(shotItems.length - missing, 1)}</strong></span>
              <Progress percent={completionPercent} showInfo={false} size="small" />
            </div>
          </section>

          <section className="storyboard-side-card app-page-card">
            <div className="storyboard-side-card-head">
              <Typography.Title level={5}><ExclamationCircleOutlined /> 漏拍提醒</Typography.Title>
              <Button type="link" size="small">全部查看</Button>
            </div>
            <div className="storyboard-missing-list">
              <div><ExclamationCircleOutlined /><span>缺少服务别镜头</span><strong>{missing}</strong></div>
              <div><ExclamationCircleOutlined /><span>缺少特写镜头</span><strong>{reshoot}</strong></div>
              <div><ExclamationCircleOutlined /><span>缺少收尾镜头</span><strong>0</strong></div>
              <div><ExclamationCircleOutlined /><span>时长不足风险</span><strong>{totalDuration < 30 ? 1 : 0}</strong></div>
            </div>
          </section>

          <section className="storyboard-side-card app-page-card">
            <div className="storyboard-side-card-head">
              <Typography.Title level={5}><PictureOutlined /> 素材状态</Typography.Title>
              <Button type="link" size="small">全部查看</Button>
            </div>
            <div className="storyboard-task-overview">
              <DonutStat
                size={82}
                label="素材总数"
                total={workspace.assets.length}
                items={[
                  { value: matched, color: '#73A5FF' },
                  { value: reshoot, color: '#9CC0FF' },
                  { value: missing, color: '#FAAD14' },
                ]}
              />
              <div className="storyboard-task-legend">
                <span><i className="is-blue" />已拍摄 <strong>{matched}</strong></span>
                <span><i className="is-orange" />待补拍 <strong>{reshoot}</strong></span>
                <span><i className="is-red" />缺镜头 <strong>{missing}</strong></span>
              </div>
            </div>
            <div className="storyboard-side-progress">
              <span>素材占用 <strong>{workspace.assets.length * 3} GB / 1 TB</strong></span>
              <Progress percent={62} showInfo={false} size="small" strokeColor="#73a5ff" />
            </div>
            <Button type="link" size="small" onClick={() => navigate(ROUTES.roughCut(DEMO_PROJECT_ID))}>
              前往素材中心
            </Button>
          </section>
        </aside>
      </div>
    </section>
  );
}
