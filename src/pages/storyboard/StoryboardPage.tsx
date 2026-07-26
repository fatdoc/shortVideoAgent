import {
  Alert,
  App,
  Button,
  Select,
  Space,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DragOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DEMO_PROJECT_ID,
  MATCH_STATUS_LABEL,
  PROJECT_STATUS_LABEL,
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

interface ShotForRender {
  shot: StoryboardShot;
  scriptBlock: ScriptBlock | null;
}

const ASSET_PLACEHOLDER = '/placeholders/storefront.svg';

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

const SHOT_STATUS_OPTIONS = [
  { value: 'planned', label: '计划中' },
  { value: 'ready', label: '可拍' },
  { value: 'shooting', label: '拍摄中' },
  { value: 'done', label: '已完成' },
  { value: 'missing', label: '缺镜' },
];

function formatOrder(order: number) {
  return `#${String(order).padStart(2, '0')}`;
}

function isBlocking(status: AssetMatchStatus) {
  return status === 'reshoot' || status === 'missing';
}

function shotStatusTone(status: ShotStatus) {
  if (status === 'done') return 'success';
  if (status === 'shooting') return 'processing';
  if (status === 'ready') return 'blue';
  if (status === 'missing') return 'error';
  return 'default';
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
  index,
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
  index: number;
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
      data-testid={`storyboard-shot-${formatOrder(index + 1)}`}
      aria-label={`镜头 ${formatOrder(index + 1)}`}
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
            aria-label={`拖拽镜头 ${formatOrder(index + 1)}`}
          >
            <DragOutlined />
          </button>
        </Tooltip>

        <img src={thumbnail} alt={shot.description} className="storyboard-shot-thumbnail" />

        <div className="storyboard-shot-copy">
          <div className="storyboard-shot-title-line">
            <Space>
              <Typography.Text strong>{formatOrder(index + 1)}</Typography.Text>
              <Tag color="blue">{shot.description}</Tag>
              <Tag color="processing">{shot.shotType}</Tag>
            </Space>
          </div>

          <div className="storyboard-shot-meta-line">
            <StatusTag kind="match" value={shot.matchStatus} />
            <Tag color={shotStatusTone(shot.status)}>{shot.status}</Tag>
            <Tag color="default">{scriptBlockLabel(scriptBlock)}</Tag>
            {shot.assignee ? <Tag icon={<UserOutlined />}>{shot.assignee}</Tag> : <Tag>待分配</Tag>}
          </div>

          <Typography.Text type="secondary" className="storyboard-shot-script-preview">
            {getScriptText(scriptBlock)}
          </Typography.Text>
        </div>

        <div className="storyboard-shot-head-actions">
          <Tag color={isBlocking(shot.matchStatus) ? 'error' : 'success'}>
            {isBlocking(shot.matchStatus) ? '待补拍或缺镜' : '素材可用'}
          </Tag>
          <Button
            size="small"
            type={expanded ? 'primary' : 'default'}
            onClick={() => {
              onToggleExpand(shot.id);
            }}
            disabled={disabled}
          >
            {expanded ? '收起编辑' : '展开编辑'}
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="storyboard-shot-details" aria-expanded>
          <div className="storyboard-shot-detail-grid">
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                拍摄时长
              </Typography.Text>
              <Typography.Text strong>{shot.duration}s</Typography.Text>
            </div>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                摄像机位
              </Typography.Text>
              <Typography.Text>{shot.cameraPosition}</Typography.Text>
            </div>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                风险
              </Typography.Text>
              <Typography.Text>{RISK_LEVEL_LABEL[shot.riskLevel] ?? shot.riskLevel}</Typography.Text>
            </div>
          </div>

          <div className="storyboard-shot-detail-grid" style={{ marginTop: 10 }}>
            <Select
              style={{ width: 140 }}
              size="small"
              options={ASSIGNEE_OPTIONS}
              value={shot.assignee ?? ''}
              onChange={(value) => {
                void onUpdateAssignee(shot.id, value);
              }}
              data-testid={`storyboard-assignee-${shot.id}`}
              disabled={disabled}
            />

            <Select
              style={{ width: 110 }}
              size="small"
              options={MATCH_STATUS_OPTIONS}
              value={shot.matchStatus}
              onChange={(value) => {
                void onUpdateMatchStatus(shot.id, value);
              }}
              data-testid={`storyboard-match-${shot.id}`}
              disabled={disabled}
            />

            <Select
              style={{ width: 100 }}
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

          <div className="storyboard-shot-narration">
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              镜头字幕：
            </Typography.Text>
            <Typography.Text>{shot.screenText}</Typography.Text>
            <Typography.Text type="secondary" style={{ marginLeft: 4 }}>
              · {shot.narration}
            </Typography.Text>
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
  const [expandedShot, setExpandedShot] = useState<string | null>(null);
  const [batchAssignee, setBatchAssignee] = useState('拍摄组 A');
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

  const pendingByAssignee = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of shotItems) {
      const assignee = item.shot.assignee || '待分配';
      map.set(assignee, (map.get(assignee) ?? 0) + 1);
    }
    return map;
  }, [shotItems]);

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

  const handleBatchAssign = useCallback(async () => {
    const nextShots = shots.map((shot) => ({
      ...shot,
      assignee: batchAssignee,
    }));
    await persist(nextShots, `已为全部镜头指派：${batchAssignee}`);
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
          {shotItems.map((item, index) => {
            const assetThumb = item.shot.assetId ? assetById.get(item.shot.assetId) ?? ASSET_PLACEHOLDER : ASSET_PLACEHOLDER;
            return (
              <ShotRow
                key={item.shot.id}
                shot={item.shot}
                index={index}
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
        <div className="storyboard-title-wrap">
          <Typography.Title level={3} style={{ marginBottom: 0 }}>
            分镜 / 拍摄清单
          </Typography.Title>
          <Space size="small" wrap>
            <Tag color="processing">{PROJECT_STATUS_LABEL[workspace.project.status] ?? workspace.project.status}</Tag>
            <Tag>{`脚本：${activeScript?.name ?? '未加载'}`}</Tag>
            <Tag>{`素材：${workspace.assets.length} / 已匹配 ${matched}`}</Tag>
          </Space>
        </div>

        <div className="storyboard-top-actions">
          <Button
            icon={<LoadingOutlined />}
            type="default"
            size="small"
            onClick={() => void hydrate()}
            loading={loading}
            disabled={isBusy}
          >
            重新同步
          </Button>

          <Select
            size="small"
            style={{ width: 130 }}
            value={batchAssignee}
            onChange={setBatchAssignee}
            options={ASSIGNEE_OPTIONS.filter((item) => item.value !== '')}
            disabled={isBusy}
            data-testid="storyboard-batch-assignee"
          />

          <Button size="small" disabled={isBusy} onClick={() => void handleBatchAssign()}>
            批量指派
          </Button>

          <Button
            size="small"
            icon={<ClockCircleOutlined />}
            disabled={isBusy || blocking.length === 0}
            onClick={() => void handleBatchStartCapture()}
          >
            待补拍转拍摄中
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

      {!isBusy && blocking.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          message="缺镜 / 待补拍提醒"
          description={`当前存在 ${missing} 镜缺镜、${reshoot} 镜待补拍，建议先完成拍摄补充后再进入初剪。`}
          icon={<ExclamationCircleOutlined />}
        />
      ) : null}

      <div className="storyboard-layout">
        <main className="storyboard-main app-page-card">
          <Tabs
            className="storyboard-tabs"
            defaultActiveKey="shots"
            items={[
              {
                key: 'shots',
                label: '分镜视图',
                children: (
                  <div className="storyboard-section">
                    <div className="storyboard-section-head">
                      <div>
                        <Typography.Title level={5} style={{ margin: 0 }}>
                            8 镜分镜（横向镜头）
                          </Typography.Title>
                        <Typography.Text type="secondary">优先展示真实素材缩略图与脚本段映射</Typography.Text>
                      </div>
                      <div className="storyboard-shot-toolbar">
                        <Tag color="default">共 {shotItems.length} 镜</Tag>
                        <Tag icon={readyForCut ? <CheckCircleOutlined /> : <LoadingOutlined />}>
                          {readyForCut ? '可进入初剪' : '待拍摄齐全后可进入初剪'}
                        </Tag>
                      </div>
                    </div>

                    {renderShotRows()}
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
                    {renderShootList()}
                  </div>
                ),
              },
            ]}
          />
        </main>

        <aside className="storyboard-right app-page-card">
          <div className="storyboard-side-head">
            <Typography.Title level={5} style={{ margin: 0 }}>
              拍摄任务 / 素材统计
            </Typography.Title>
            <Typography.Text type="secondary">右侧汇总拍摄指派与匹配状态风险</Typography.Text>
          </div>

          <div className="storyboard-stat-grid">
            <div className="storyboard-stat-card">
              <Typography.Text type="secondary">项目阶段</Typography.Text>
              <Typography.Text strong>{PROJECT_STATUS_LABEL[workspace.project.status] ?? workspace.project.status}</Typography.Text>
            </div>
            <div className="storyboard-stat-card">
              <Typography.Text type="secondary">当前项目</Typography.Text>
              <Typography.Text strong>{workspace.project.name}</Typography.Text>
            </div>
            <div className="storyboard-stat-card">
              <Typography.Text type="secondary">已匹配镜头</Typography.Text>
              <Typography.Text strong>
                {matched} / {shotItems.length}
              </Typography.Text>
            </div>
            <div className="storyboard-stat-card">
              <Typography.Text type="secondary">阻塞镜头</Typography.Text>
              <Typography.Text strong style={{ color: '#FA8C16' }}>
                {missing + reshoot}
              </Typography.Text>
            </div>
          </div>

          <div className="storyboard-side-section">
            <Typography.Text strong>拍摄指派（按人员）</Typography.Text>
            <div className="storyboard-side-list">
              {Array.from(pendingByAssignee.entries()).map(([assignee, count]) => (
                <div key={assignee} className="storyboard-side-list-item">
                  <Typography.Text>{assignee}</Typography.Text>
                  <Tag color="blue">{count} 镜</Tag>
                </div>
              ))}
            </div>
          </div>

          <div className="storyboard-side-section">
            <Typography.Text strong>漏拍与补拍（右侧红色提醒）</Typography.Text>
            <div className="storyboard-side-list">
              {blocking.length > 0 ? (
                blocking.map((item) => (
                  <div key={item.shot.id} className="storyboard-side-list-item is-warning">
                    <Typography.Text>
                      {formatOrder(item.shot.order)} · {item.shot.description}
                    </Typography.Text>
                    <Tag color="red">{MATCH_STATUS_LABEL[item.shot.matchStatus]}</Tag>
                  </div>
                ))
              ) : (
                <Typography.Text type="secondary">当前无阻塞镜头。</Typography.Text>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
