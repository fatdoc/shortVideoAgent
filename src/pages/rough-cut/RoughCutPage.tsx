import {
  ArrowLeftOutlined,
  AudioOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ScissorOutlined,
  SoundOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Alert, Button, Empty, Progress, Space, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ProductionControlSurface,
  type ProductionView,
} from '../../components/production/ProductionControlSurface';
import { TruthBadge } from '../../components/workbench/TruthBadge';
import { DEMO_PROJECT_ID } from '../../domain/constants';
import { useProjectStore } from '../../stores/projectStore';
import './rough-cut.css';

interface RoughCutPageProps {
  view?: ProductionView;
}
export function RoughCutPage({ view = 'all' }: RoughCutPageProps) {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const workspace = useProjectStore((state) => state.workspace);
  const assetById = useMemo(
    () => new Map(workspace.assets.map((asset) => [asset.id, asset])),
    [workspace.assets],
  );
  const timeline = workspace.timeline;
  const firstVisualClip = timeline.clips.find((clip) => clip.assetId);
  const firstVisualAsset = firstVisualClip?.assetId ? assetById.get(firstVisualClip.assetId) : null;
  const missingChecks = timeline.qaStatus.filter(
    (item) => item.status === 'fail' || item.status === 'pending',
  );
  const warnChecks = timeline.qaStatus.filter((item) => item.status === 'warn');
  const exportReady = timeline.qaStatus.every((item) => item.status === 'pass');

  if (projectId !== DEMO_PROJECT_ID) {
    return (
      <Empty description={`仅支持 canonical 项目 ${DEMO_PROJECT_ID}，当前为 ${projectId}`}>
        <Button type="primary" onClick={() => navigate(`/projects/${DEMO_PROJECT_ID}/rough-cut`)}>
          打开统一交付页
        </Button>
      </Empty>
    );
  }

  return (
    <div className="d1-page-stack rough-cut-v3-page">
      <header className="d1-page-header">
        <div>
          <Space size={8} wrap>
            <Tag color="blue">9:16 粗剪</Tag>
            <TruthBadge capabilityId="demo.local-life-golden-path" compact />
          </Space>
          <Typography.Title level={2}>探店粗剪</Typography.Title>
          <Typography.Paragraph type="secondary">
            围绕竖版预览、镜头轨、字幕/旁白/BGM 和导出检查推进；未通过检查不生成可发布成片。
          </Typography.Paragraph>
        </div>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/projects/${DEMO_PROJECT_ID}/storyboard`)}
        >
          返回分镜
        </Button>
      </header>

      {view === 'all' ? (
        <section className="rough-cut-workbench">
          <div className="rough-cut-shot-rail">
            <div className="rough-cut-panel-heading">
              <Typography.Text strong>分镜</Typography.Text>
              <Tag>{workspace.storyboard.length}</Tag>
            </div>
            {workspace.storyboard.map((shot) => {
              const asset = shot.assetId ? assetById.get(shot.assetId) : null;
              return (
                <button className="rough-cut-shot" type="button" key={shot.id}>
                  <span>{String(shot.order).padStart(2, '0')}</span>
                  {asset ? <img src={asset.thumbnail} alt="" /> : <i>待补</i>}
                  <strong>{shot.description}</strong>
                  <small>
                    {shot.duration}s · {shot.matchStatus}
                  </small>
                </button>
              );
            })}
          </div>

          <div className="rough-cut-preview-panel">
            <div className="rough-cut-device">
              {firstVisualAsset ? <img src={firstVisualAsset.thumbnail} alt="" /> : null}
              <div className="rough-cut-title-safe">
                <strong>{workspace.brand.merchant}</strong>
                <span>{workspace.brief.cta}</span>
              </div>
            </div>
            <div className="rough-cut-player-controls">
              <Typography.Text strong>
                00:{String(timeline.playhead).padStart(2, '0')} / 00:
                {String(timeline.duration).padStart(2, '0')}
              </Typography.Text>
              <Progress
                percent={Math.round((timeline.playhead / timeline.duration) * 100)}
                showInfo={false}
                strokeColor="#ff5a1f"
              />
              <Tag>{timeline.aspectRatio}</Tag>
            </div>
          </div>

          <aside className="rough-cut-inspector">
            <div className="rough-cut-panel-heading">
              <Typography.Text strong>导出检查</Typography.Text>
              <Tag color={exportReady ? 'success' : 'warning'}>
                {exportReady ? '可导出' : '待补齐'}
              </Tag>
            </div>
            <div className="rough-cut-checks">
              {timeline.qaStatus.map((item) => (
                <div className={`rough-cut-check is-${item.status}`} key={item.key}>
                  {item.status === 'pass' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                  <div>
                    <Typography.Text strong>{item.label}</Typography.Text>
                    <Typography.Text type="secondary">{item.message}</Typography.Text>
                  </div>
                </div>
              ))}
            </div>
            {missingChecks.length + warnChecks.length > 0 ? (
              <Alert
                type="warning"
                showIcon
                message="导出预览阻断"
                description="存在缺镜或待确认项；发布前必须补齐镜头、字幕、旁白和 BGM 检查。"
              />
            ) : null}
          </aside>

          <div className="rough-cut-timeline">
            {timeline.tracks.map((track) => (
              <div className="rough-cut-track" key={track.id}>
                <span className="rough-cut-track-label">
                  {track.type === 'video' ? (
                    <VideoCameraOutlined />
                  ) : track.type === 'subtitle' ? (
                    <ScissorOutlined />
                  ) : track.id === 'track-bgm' ? (
                    <SoundOutlined />
                  ) : (
                    <AudioOutlined />
                  )}
                  {track.name}
                </span>
                <div className="rough-cut-track-lane">
                  {timeline.clips
                    .filter((clip) => clip.trackId === track.id)
                    .map((clip) => (
                      <span
                        key={clip.id}
                        className="rough-cut-clip"
                        style={{
                          left: `${(clip.start / timeline.duration) * 100}%`,
                          width: `${((clip.end - clip.start) / timeline.duration) * 100}%`,
                        }}
                      >
                        {clip.label}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <ProductionControlSurface view={view} />
    </div>
  );
}
