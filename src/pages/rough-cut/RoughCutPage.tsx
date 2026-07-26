import {
  ArrowRightOutlined,
  ExportOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReconciliationOutlined,
  ProfileOutlined,
  SoundOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Alert, App, Button, Select, Slider, Space, Tag, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { StatusTag } from '../../components/common/StatusTag';
import {
  AssetCard,
  TimelineTrackList,
  resolveAssetPreviewVisual,
  resolveAssetVisual,
} from '../../components/media';
import { DEMO_PROJECT_ID, ROUTES } from '../../domain/constants';
import { isDemoProject } from '../../domain/selectors';
import type { Asset, AspectRatio, QaItem, TimelineClip, TimelineTrack } from '../../domain/types';
import { useProjectStore } from '../../stores/projectStore';
import './rough-cut.css';

type AssetStatusFilter = 'all' | Asset['status'];
type AssetTypeFilter = 'all' | Asset['type'];
type MatchTrackIntent = 'video' | 'voice' | 'bgm' | 'subtitle' | 'overlay';
type RightPanelTab = 'edit' | 'qa' | 'export';

const ASSET_TYPE_OPTIONS: Array<{ label: string; value: AssetTypeFilter }> = [
  { label: '全部类型', value: 'all' },
  { label: '视频', value: 'video' },
  { label: '图片', value: 'image' },
  { label: '音频', value: 'audio' },
  { label: '文字', value: 'text' },
];

const MATCH_STATUS_OPTIONS: Array<{ label: string; value: AssetStatusFilter }> = [
  { label: '全部素材', value: 'all' },
  { label: '已匹配', value: 'matched' },
  { label: '待补拍', value: 'reshoot' },
  { label: '缺镜', value: 'missing' },
  { label: 'AI 补镜', value: 'ai_placeholder' },
];

const ASPECT_RATIO_OPTIONS: Array<{ label: string; value: AspectRatio }> = [
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
  { label: '1:1', value: '1:1' },
];

const ASSET_DEFAULT_DURATION: Record<Asset['type'], number> = {
  video: 4,
  image: 3,
  audio: 6,
  text: 2,
};

function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const second = String(total % 60).padStart(2, '0');
  const minute = Math.floor(total / 60);
  return `${minute}:${second}`;
}

function resolveTrackId(tracks: TimelineTrack[], intent: MatchTrackIntent): string | undefined {
  if (intent === 'video') {
    return tracks.find((item) => item.type === 'video')?.id ?? tracks.find((item) => item.name.includes('画面'))?.id;
  }
  if (intent === 'voice') {
    return tracks.find((item) => item.name.includes('口播'))?.id ?? tracks.find((item) => item.type === 'audio')?.id;
  }
  if (intent === 'bgm') {
    return (
      tracks.find((item) => item.name.includes('BGM'))?.id ??
      tracks.filter((item) => item.type === 'audio')[1]?.id ??
      tracks.find((item) => item.type === 'audio')?.id
    );
  }
  if (intent === 'subtitle') {
    return tracks.find((item) => item.name.includes('字幕'))?.id;
  }
  return tracks.find((item) => item.name.includes('花字'))?.id;
}

function resolveTrackName(intent: MatchTrackIntent): string {
  if (intent === 'video') return '画面';
  if (intent === 'voice') return '口播';
  if (intent === 'bgm') return 'BGM';
  if (intent === 'subtitle') return '字幕';
  return '花字';
}

function resolveTrackIcon(intent: MatchTrackIntent) {
  if (intent === 'video') return <VideoCameraOutlined />;
  if (intent === 'voice') return <SoundOutlined />;
  if (intent === 'bgm') return <SoundOutlined />;
  if (intent === 'subtitle') return <ProfileOutlined />;
  return <ReconciliationOutlined />;
}

function defaultLabel(intent: MatchTrackIntent, assetName: string) {
  if (intent === 'subtitle') return `字幕：${assetName}`;
  if (intent === 'overlay') return `花字：${assetName}`;
  return assetName;
}

function findShotByPlayhead(
  shots: Array<{ id: string; duration: number }>,
  playhead: number,
): number {
  let cursor = 0;
  for (let i = 0; i < shots.length; i += 1) {
    const next = cursor + shots[i].duration;
    if (playhead < next || i === shots.length - 1) {
      return i;
    }
    cursor = next;
  }
  return 0;
}

export function RoughCutPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { projectId } = useParams();

  const workspace = useProjectStore((state) => state.workspace);
  const loading = useProjectStore((state) => state.loading);
  const error = useProjectStore((state) => state.error);
  const hydrate = useProjectStore((state) => state.hydrate);
  const updateTimeline = useProjectStore((state) => state.updateTimeline);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssetStatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<AssetTypeFilter>('all');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('edit');
  const [playhead, setPlayhead] = useState(workspace.timeline.playhead);
  const [isPlaying, setIsPlaying] = useState(false);
  const [coverAssetId, setCoverAssetId] = useState<string | undefined>(
    workspace.storyboard[0]?.assetId ?? workspace.assets[0]?.id,
  );

  const validProject = isDemoProject(projectId);
  const timeline = workspace.timeline;
  const shotsWithIndex = useMemo(
    () => workspace.storyboard.map((shot) => ({ ...shot })),
    [workspace.storyboard],
  );
  const shotAtPlayheadIndex = findShotByPlayhead(
    shotsWithIndex,
    playhead,
  );
  const activeShot = shotsWithIndex[shotAtPlayheadIndex];
  const shotAssetId = activeShot?.assetId;
  const shotAsset = workspace.assets.find((item) => item.id === shotAssetId);

  const assetsById = useMemo(
    () => new Map(workspace.assets.map((asset) => [asset.id, asset])),
    [workspace.assets],
  );
  const selectedAsset = useMemo(
    () => (selectedAssetId ? assetsById.get(selectedAssetId) ?? null : null),
    [assetsById, selectedAssetId],
  );
  const coverAsset = coverAssetId ? assetsById.get(coverAssetId) ?? null : shotAsset ?? null;
  const timelineShots = useMemo(
    () => shotsWithIndex.reduce((acc, shot) => acc + shot.duration, 0),
    [shotsWithIndex],
  );

  useEffect(() => {
    setPlayhead(timeline.playhead);
  }, [timeline.playhead]);

  useEffect(() => {
    if (!selectedAssetId && workspace.assets.length > 0) {
      setSelectedAssetId(workspace.assets[0].id);
    }
  }, [selectedAssetId, workspace.assets]);

  useEffect(() => {
    if (!selectedShotId && workspace.storyboard.length > 0) {
      setSelectedShotId(workspace.storyboard[0].id);
    }
  }, [selectedShotId, workspace.storyboard]);

  useEffect(() => {
    if (isPlaying && timeline.duration <= 0) {
      setIsPlaying(false);
      return;
    }
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setPlayhead((current) => {
        const step = 0.2;
        const next = Number((current + step).toFixed(1));
        if (next >= timeline.duration) {
          setIsPlaying(false);
          return timeline.duration;
        }
        return next;
      });
    }, 120);
    return () => clearInterval(timer);
  }, [isPlaying, timeline.duration]);

  const filteredAssets = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return workspace.assets.filter((asset) => {
      if (statusFilter !== 'all' && asset.status !== statusFilter) {
        return false;
      }
      if (typeFilter !== 'all' && asset.type !== typeFilter) {
        return false;
      }
      if (!keyword) return true;
      return (
        asset.name.toLowerCase().includes(keyword) ||
        asset.tags.some((tag) => tag.toLowerCase().includes(keyword))
      );
    });
  }, [searchTerm, statusFilter, typeFilter, workspace.assets]);

  const qaItems: QaItem[] = useMemo(() => timeline.qaStatus ?? [], [timeline.qaStatus]);
  const videoTrackId = resolveTrackId(timeline.tracks, 'video');
  const voiceTrackId = resolveTrackId(timeline.tracks, 'voice');
  const bgmTrackId = resolveTrackId(timeline.tracks, 'bgm');
  const subtitleTrackId = resolveTrackId(timeline.tracks, 'subtitle');
  const overlayTrackId = resolveTrackId(timeline.tracks, 'overlay');

  const trackIntents = useMemo(
    () => ({
      video: videoTrackId,
      voice: voiceTrackId,
      bgm: bgmTrackId,
      subtitle: subtitleTrackId,
      overlay: overlayTrackId,
    }),
    [videoTrackId, voiceTrackId, bgmTrackId, subtitleTrackId, overlayTrackId],
  );

  const matchedShots = workspace.storyboard.filter((shot) => shot.matchStatus === 'matched').length;
  const missingReasons = useMemo(
    () =>
      qaItems
        .filter(
          (qa) =>
            (qa.key === 'missing_shots' || qa.key === 'sensitive_words') && qa.status === 'fail',
        )
        .map((qa) => qa.message),
    [qaItems],
  );
  const exportReadyQa = qaItems.find((item) => item.key === 'export_ready');
  const exportDisabled =
    loading ||
    missingReasons.length > 0 ||
    (exportReadyQa ? exportReadyQa.status !== 'pass' : false);
  const exportReasons = [
    ...missingReasons,
    ...(exportReadyQa && exportReadyQa.status !== 'pass' ? [exportReadyQa.message] : []),
  ].filter(Boolean);

  const selectedClip = useMemo(
    () => timeline.clips.find((clip) => clip.id === selectedClipId) ?? null,
    [timeline.clips, selectedClipId],
  );
  const bgmClip = timeline.clips.find((clip) => clip.trackId === bgmTrackId) ?? null;

  const activeTimelineClip = useMemo(
    () =>
      timeline.clips.find(
        (clip) =>
          clip.trackId === trackIntents.video &&
          !!clip.assetId &&
          clip.start <= playhead &&
          playhead < clip.end &&
          assetsById.has(clip.assetId),
      ) ?? null,
    [timeline.clips, trackIntents.video, playhead, assetsById],
  );
  const previewAsset = activeTimelineClip?.assetId
    ? assetsById.get(activeTimelineClip.assetId)
    : shotAsset;

  const selectedShot = workspace.storyboard.find((shot) => shot.id === selectedShotId);

  const persistTimeline = useCallback(
    async (patch: Partial<typeof timeline>) => {
      const next = { ...timeline, ...patch };
      await updateTimeline(next);
    },
    [timeline, updateTimeline],
  );

  const appendToTrack = useCallback(
    async (intent: MatchTrackIntent, baseAsset?: Asset, baseLabel?: string) => {
      const trackId = trackIntents[intent];
      if (!trackId) {
        message.warning(`当前时间线上未找到${resolveTrackName(intent)}轨道`);
        return;
      }
      const sourceAsset = baseAsset ?? selectedAsset;
      if (!sourceAsset && !baseLabel) {
        message.warning('请先选择素材');
        return;
      }

      const trackClips = timeline.clips
        .filter((clip) => clip.trackId === trackId)
        .sort((a, b) => a.start - b.start);
      const start = trackClips.length > 0 ? trackClips.at(-1)?.end ?? 0 : 0;
      const nextDuration = sourceAsset
        ? sourceAsset.duration || ASSET_DEFAULT_DURATION[sourceAsset.type]
        : 2.5;
      const clip: TimelineClip = {
        id: `rc-${Date.now()}-${intent}`,
        trackId,
        assetId: sourceAsset?.id,
        label: baseLabel ?? defaultLabel(intent, sourceAsset?.name ?? '文本片段'),
        start,
        end: start + nextDuration,
      };
      await persistTimeline({
        clips: [...timeline.clips, clip],
        duration: Math.max(timeline.duration, clip.end),
        playhead,
      });
      setSelectedClipId(clip.id);
      message.success(`已添加到${resolveTrackName(intent)}轨道`);
    },
    [timeline, message, persistTimeline, selectedAsset, trackIntents, playhead],
  );

  const appendShotToTextTrack = useCallback(
    async (shotId: string, intent: MatchTrackIntent) => {
      const shot = workspace.storyboard.find((item) => item.id === shotId);
      if (!shot) {
        message.warning('镜头不存在');
        return;
      }
      const text = (shot.screenText || shot.narration || shot.description).trim();
      await appendToTrack(intent, undefined, `${resolveTrackName(intent)}：${text}`);
    },
    [appendToTrack, message, workspace.storyboard],
  );

  const removeSelectedClip = useCallback(async () => {
    if (!selectedClip) return;
    await persistTimeline({
      clips: timeline.clips.filter((clip) => clip.id !== selectedClip.id),
      playhead,
    });
    setSelectedClipId(null);
    message.success('已移除当前选中片段');
  }, [message, persistTimeline, playhead, selectedClip, timeline.clips]);

  const handleSeekChange = (value: number) => {
    setPlayhead(value);
  };

  const handleSeekCommit = useCallback(
    async (value: number) => {
      await persistTimeline({ playhead: value });
    },
    [persistTimeline],
  );

  const togglePlay = () => {
    if (timeline.duration <= 0) {
      message.warning('时间线时长为空');
      return;
    }
    if (isPlaying) {
      setIsPlaying(false);
      void persistTimeline({ playhead });
    } else {
      setIsPlaying(true);
    }
  };

  const handleJumpToStart = () => {
    setIsPlaying(false);
    setPlayhead(0);
    void persistTimeline({ playhead: 0 });
  };

  const handleJumpToEnd = () => {
    const end = timeline.duration;
    setIsPlaying(false);
    setPlayhead(end);
    void persistTimeline({ playhead: end });
  };

  const handleAddToTrack = (intent: MatchTrackIntent) => {
    if (loading) return;
    void appendToTrack(intent);
  };

  const handleAssetSelect = (asset: Asset) => {
    setSelectedAssetId(asset.id);
    setSelectedClipId(null);
  };

  if (!validProject) {
    return (
      <ErrorState
        title="项目不存在"
        subTitle={`仅支持统一 Demo 项目 ${DEMO_PROJECT_ID}，当前为 ${projectId ?? 'unknown'}`}
        onRetry={() => navigate(ROUTES.roughCut(DEMO_PROJECT_ID))}
        retryLabel="打开统一 Demo 页面"
      />
    );
  }

  if (loading && !workspace.project.id) {
    return <LoadingState tip="正在加载素材与时间线..." />;
  }

  if (error) {
    return <ErrorState title="素材中心不可用" subTitle={error} onRetry={() => void hydrate()} retryLoading={loading} />;
  }

  if (!workspace.assets.length || !workspace.storyboard.length || !timeline.tracks.length) {
    return (
      <EmptyState
        description="暂无素材/分镜/轨道数据"
        actionLabel="重新加载统一 Demo"
        onAction={() => void hydrate()}
        loading={loading}
        minHeight={360}
      />
    );
  }

  return (
    <div className="rough-cut-page" data-testid="rough-cut-page">
      <div className="project-page-toolbar">
        <div className="project-page-toolbar-copy">
          <div className="rough-cut-project-heading">
            <Typography.Title level={3} style={{ margin: 0 }}>
              海南陵水鸡 · 北京三里屯店
            </Typography.Title>
            <Tag color="blue">本地项目</Tag>
          </div>
          <Typography.Text type="secondary">
            项目 ID：{workspace.project.id} · 竖版短视频 · {formatSeconds(timeline.duration)}
          </Typography.Text>
        </div>
        <div className="project-toolbar-actions">
          <Button size="middle">AI 智能粗剪</Button>
          <Button size="middle" onClick={() => setStatusFilter('all')}>重新匹配素材</Button>
          <Button size="middle" onClick={() => setRightPanelTab('edit')}>字幕设置</Button>
          <Button
            type="primary"
            icon={<ExportOutlined />}
            disabled={exportDisabled}
            onClick={() => {
              if (!exportDisabled) message.success('导出预览仅演示开启（Mock）');
            }}
          >
            导出预览
          </Button>
          <Typography.Text type="secondary">保存中</Typography.Text>
        </div>
      </div>

      <div className="rough-cut-layout">
        <section className="rough-cut-asset-panel app-page-card">
          <div className="rough-cut-asset-tabs" role="tablist" aria-label="素材范围">
            <button
              type="button"
              className={statusFilter === 'all' ? 'is-active' : ''}
              onClick={() => setStatusFilter('all')}
            >
              素材库
            </button>
            <button
              type="button"
              className={statusFilter === 'matched' ? 'is-active' : ''}
              onClick={() => setStatusFilter('matched')}
            >
              已匹配（{matchedShots}）
            </button>
          </div>

          <div className="rough-cut-filters">
            <input
              type="text"
              className="rough-cut-search"
              placeholder="搜索素材名 / 标签"
              aria-label="素材搜索"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              data-testid="rough-cut-asset-search"
            />
          </div>

          <div className="rough-cut-type-tabs" role="tablist" aria-label="素材类型">
            {ASSET_TYPE_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.value}
                className={typeFilter === option.value ? 'is-active' : ''}
                onClick={() => setTypeFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="rough-cut-secondary-filters">
            <Select
              className="rough-cut-filter-select"
              value={statusFilter}
              options={MATCH_STATUS_OPTIONS}
              onChange={(value) => setStatusFilter(value as AssetStatusFilter)}
              data-testid="rough-cut-filter-status"
            />
            <Select
              className="rough-cut-filter-select"
              value={typeFilter}
              options={ASSET_TYPE_OPTIONS}
              onChange={(value) => setTypeFilter(value as AssetTypeFilter)}
              data-testid="rough-cut-filter-type"
            />
            <button
              type="button"
              className="rough-cut-duration-filter"
              onClick={() => message.info('当前演示展示全部时长')}
            >
              全部时长
            </button>
          </div>

          <div className="rough-cut-asset-grid">
            {filteredAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                selected={selectedAssetId === asset.id}
                onSelect={handleAssetSelect}
              />
            ))}
          </div>

          {selectedAsset ? (
            <div className="rough-cut-selected-box">
              <Typography.Text strong>已选素材</Typography.Text>
              <div className="rough-cut-selected-box-content">
                <img
                  src={resolveAssetVisual(selectedAsset)}
                  alt={`${selectedAsset.name} 预览图`}
                  className="rough-cut-selected-thumb"
                />
                <div className="rough-cut-selected-meta">
                  <Typography.Text strong>{selectedAsset.name}</Typography.Text>
                  <StatusTag kind="match" value={selectedAsset.status} />
                  <Typography.Text type="secondary">{selectedAsset.tags.join(' / ')}</Typography.Text>
                </div>
              </div>
              <div className="rough-cut-action-row">
                <Button
                  type="default"
                  size="small"
                  icon={resolveTrackIcon('video')}
                  onClick={() => handleAddToTrack('video')}
                  disabled={loading}
                  data-testid="rough-cut-add-video"
                >
                  加入画面
                </Button>
                <Button
                  type="default"
                  size="small"
                  icon={resolveTrackIcon('voice')}
                  onClick={() => handleAddToTrack('voice')}
                  disabled={loading}
                  data-testid="rough-cut-add-voice"
                >
                  加入口播
                </Button>
                <Button
                  type="default"
                  size="small"
                  icon={resolveTrackIcon('bgm')}
                  onClick={() => handleAddToTrack('bgm')}
                  disabled={loading}
                  data-testid="rough-cut-add-bgm"
                >
                  加入 BGM
                </Button>
                <Button
                  type="default"
                  size="small"
                  icon={resolveTrackIcon('subtitle')}
                  onClick={() => void appendShotToTextTrack(selectedShot?.id ?? shotsWithIndex[0].id, 'subtitle')}
                  disabled={loading}
                  data-testid="rough-cut-add-subtitle"
                >
                  生成字幕
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rough-cut-workbench app-page-card">
          <div className="rough-cut-preview-section">
            <div className="rough-cut-preview-title">
              <div>
                <Typography.Title level={5} style={{ margin: 0 }}>
                  初剪预览（{timeline.aspectRatio}）
                </Typography.Title>
                <Typography.Text type="secondary">
                  以 playhead 同步演示播放进度
                </Typography.Text>
              </div>
              <div className="rough-cut-preview-status">
                <Tag color="success">QA 通过</Tag>
                <Typography.Text type="secondary">视频质量：1080P</Typography.Text>
              </div>
            </div>

            <div className="rough-cut-preview-frame">
              {previewAsset ? (
                <img
                  src={resolveAssetPreviewVisual(previewAsset)}
                  alt={`${previewAsset.name} 预览`}
                  className="rough-cut-preview-image"
                />
              ) : null}
              <div className="rough-cut-preview-overlay">
                <Tag color="processing">{formatSeconds(playhead)}</Tag>
                <Typography.Text strong style={{ color: '#fff' }}>
                  {activeShot?.description || '按时间轴播放'}
                </Typography.Text>
                {activeShot ? (
                  <Tag style={{ marginTop: 6 }} color="blue">
                    镜头 {activeShot.order}: {activeShot.screenText || activeShot.narration}
                  </Tag>
                ) : null}
              </div>
            </div>

            <div className="rough-cut-control-bar">
              <Button
                icon={<StepBackwardOutlined />}
                onClick={handleJumpToStart}
                size="middle"
                disabled={loading}
              />
              <Button
                icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                type="primary"
                onClick={togglePlay}
                size="middle"
                data-testid="rough-cut-play-btn"
                disabled={loading || timeline.duration <= 0}
              >
                {isPlaying ? '暂停' : '播放'}
              </Button>
              <Button
                icon={<StepForwardOutlined />}
                onClick={handleJumpToEnd}
                size="middle"
                disabled={loading}
              />
              <Button
                icon={<ArrowRightOutlined />}
                onClick={() => setSelectedClipId(null)}
                size="middle"
                disabled={loading}
              >
                取消选片
              </Button>
            </div>

            <div className="rough-cut-playhead">
              <div>
                <Typography.Text type="secondary">
                  时间 {formatSeconds(playhead)} / {formatSeconds(timeline.duration)}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ marginLeft: 12 }}>
                  总片段时长 {formatSeconds(timelineShots)}
                </Typography.Text>
              </div>
              <div className="rough-cut-slider-wrap">
                <Slider
                  min={0}
                  max={Math.max(0.001, timeline.duration)}
                  step={0.1}
                  value={playhead}
                  onChange={handleSeekChange}
                  onChangeComplete={handleSeekCommit}
                  data-testid="rough-cut-playhead-slider"
                />
              </div>
            </div>
          </div>

          <div className="rough-cut-timeline-wrap">
            <div className="rough-cut-timeline-title">
              <Typography.Title level={5} style={{ margin: 0 }}>
                简化多轨时间线（含字幕/BGM/花字）
              </Typography.Title>
              <Typography.Text type="secondary">
                选中片段可在右侧移除并回看
              </Typography.Text>
            </div>
            <TimelineTrackList
              tracks={timeline.tracks}
              clips={timeline.clips}
              duration={Math.max(0.001, timeline.duration)}
              playhead={playhead}
              selectedClipId={selectedClipId}
              onSelectClip={(clipId) => setSelectedClipId(clipId)}
            />
          </div>

          {selectedClip ? (
            <Alert
              type="info"
              showIcon
              message={`当前选中片段：${selectedClip.label}`}
              description={
                <>
                  <Typography.Text style={{ fontSize: 12 }}>
                    位置 {formatSeconds(selectedClip.start)} - {formatSeconds(selectedClip.end)}
                  </Typography.Text>
                  <Button
                    size="small"
                    type="text"
                    onClick={() => void removeSelectedClip()}
                    style={{ marginLeft: 12 }}
                    data-testid="rough-cut-remove-clip"
                  >
                    移除片段
                  </Button>
                </>
              }
            />
          ) : null}
        </section>

        <aside className="rough-cut-side-panel app-page-card">
          <div className="rough-cut-side-tabs" role="tablist" aria-label="编辑面板">
            {[
              ['edit', '编辑'],
              ['qa', '质检'],
              ['export', '导出'],
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={rightPanelTab === value ? 'is-active' : ''}
                onClick={() => setRightPanelTab(value as RightPanelTab)}
              >
                {label}
              </button>
            ))}
          </div>
          {rightPanelTab === 'edit' ? (
            <>
              <section className="rough-cut-side-block rough-cut-subtitle-block">
                <div className="rough-cut-section-title">
                  <Typography.Title level={5} style={{ margin: 0 }}>
                    字幕样式
                  </Typography.Title>
                  <Button
                    size="small"
                    type="link"
                    onClick={() => void appendShotToTextTrack(selectedShot?.id ?? shotsWithIndex[0].id, 'subtitle')}
                  >
                    生成字幕
                  </Button>
                </div>
                <div className="rough-cut-subtitle-style">
                  <div className="rough-cut-font-sample">Aa</div>
                  <div>
                    <Typography.Text strong>思源黑体 · Bold</Typography.Text>
                    <Typography.Text type="secondary">字号 48 · 居中 · 白字描边</Typography.Text>
                  </div>
                </div>
              </section>

              <section className="rough-cut-side-block rough-cut-bgm-block">
                <div className="rough-cut-section-title">
                  <Typography.Title level={5} style={{ margin: 0 }}>
                    BGM
                  </Typography.Title>
                  <Button size="small" type="link" onClick={() => handleAddToTrack('bgm')}>
                    配置
                  </Button>
                </div>
                <div className="rough-cut-bgm-card">
                  <div className="rough-cut-bgm-icon"><SoundOutlined /></div>
                  <div className="rough-cut-bgm-copy">
                    <Typography.Text strong>{bgmClip?.label ?? 'BGM 轨道待配置'}</Typography.Text>
                    <Typography.Text type="secondary">
                      {bgmClip ? `${formatSeconds(bgmClip.start)} - ${formatSeconds(bgmClip.end)}` : '从统一时间线读取'}
                    </Typography.Text>
                  </div>
                  <Tag color={bgmClip ? 'success' : 'default'}>{bgmClip ? '已配置' : '待配置'}</Tag>
                </div>
                <Slider value={bgmClip ? 100 : 0} disabled={!bgmClip} />
              </section>
            </>
          ) : null}

          {rightPanelTab !== 'export' ? (
            <section className="rough-cut-side-block">
            <div className="rough-cut-section-title">
              <Typography.Title level={5} style={{ margin: 0 }}>
                封面 / 比例
              </Typography.Title>
            </div>
            <div className="rough-cut-cover-box">
              {coverAsset ? (
                <img
                  src={resolveAssetVisual(coverAsset)}
                  alt={`${coverAsset.name} 封面`}
                  className="rough-cut-cover-preview"
                />
              ) : null}
              <div className="rough-cut-cover-meta">
                <Typography.Text strong>
                  {coverAsset ? coverAsset.name : '未设置封面'}
                </Typography.Text>
                <Button
                  size="small"
                  onClick={() => {
                    if (!selectedAsset) {
                      message.warning('先选择素材再设置封面');
                      return;
                    }
                    setCoverAssetId(selectedAsset.id);
                    message.success(`已设置封面：${selectedAsset.name}`);
                  }}
                  disabled={!selectedAsset || loading}
                >
                  设为封面
                </Button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Typography.Text type="secondary">画面比例</Typography.Text>
              <Select
                value={timeline.aspectRatio}
                options={ASPECT_RATIO_OPTIONS}
                style={{ width: 120 }}
                onChange={(value) => void persistTimeline({ aspectRatio: value as AspectRatio })}
                loading={loading}
                data-testid="rough-cut-aspect"
              />
            </div>
            </section>
          ) : null}

          {rightPanelTab === 'qa' ? (
            <section className="rough-cut-side-block">
            <div className="rough-cut-section-title">
              <Typography.Title level={5} style={{ margin: 0 }}>
                分镜匹配与字幕源
              </Typography.Title>
            </div>
            <div className="rough-cut-shot-list">
              {workspace.storyboard.map((shot, index) => {
                const shotAsset = shot.assetId ? assetsById.get(shot.assetId) : null;
                const isActive = selectedShotId === shot.id;
                return (
                  <div
                    key={shot.id}
                    className={`rough-cut-shot-item ${isActive ? 'is-active' : ''}`}
                    data-testid={`rough-cut-shot-${shot.id}`}
                    onClick={() => setSelectedShotId(shot.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        setSelectedShotId(shot.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="rough-cut-shot-order">0{index + 1}</div>
                    <div className="rough-cut-shot-content">
                      <Typography.Text strong>{shot.description}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {shot.screenText}
                      </Typography.Text>
                    </div>
                    <div className="rough-cut-shot-meta">
                      <StatusTag kind="match" value={shot.matchStatus} />
                      <Space size={6}>
                        {shotAsset ? (
                          <Button
                            size="small"
                            type="text"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedAssetId(shotAsset.id);
                            }}
                          >
                            定位素材
                          </Button>
                        ) : null}
                        <Button
                          size="small"
                          type="text"
                          onClick={(event) => {
                            event.stopPropagation();
                            void appendShotToTextTrack(shot.id, 'overlay');
                          }}
                          disabled={loading}
                        >
                          花字
                        </Button>
                      </Space>
                    </div>
                  </div>
                );
              })}
            </div>
            </section>
          ) : null}

          <section className="rough-cut-side-block">
            <div className="rough-cut-section-title">
              <Typography.Title level={5} style={{ margin: 0 }}>
                QA（六项）
              </Typography.Title>
            </div>
            <div className="rough-cut-qa-list">
              {qaItems.map((item) => (
                <div key={item.key} className={`rough-cut-qa-item is-${item.status}`}>
                  <StatusTag kind="qa" value={item.status} />
                  <div>
                    <Typography.Text strong>{item.label}</Typography.Text>
                    <Typography.Text type="secondary" className="rough-cut-qa-message">
                      {item.message}
                    </Typography.Text>
                  </div>
                </div>
              ))}
            </div>

            {rightPanelTab === 'export' ? (
              <>
                <Alert
                  type="warning"
                  message="导出规则"
                  showIcon
                  style={{ marginTop: 10 }}
                  description={exportReasons.length > 0 ? exportReasons.join('；') : '目前可导出'}
                />

                <Button
                  block
                  type="primary"
                  icon={<ExportOutlined />}
                  disabled={exportDisabled}
                  data-testid="rough-cut-export"
                  style={{ marginTop: 10 }}
                  onClick={() => {
                    if (exportDisabled) return;
                    message.success('导出预览仅演示开启（Mock）');
                  }}
                >
                  导出预览
                </Button>
              </>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
