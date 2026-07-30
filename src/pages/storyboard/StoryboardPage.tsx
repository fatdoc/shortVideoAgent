import {
  ArrowRightOutlined,
  CameraOutlined,
  FileProtectOutlined,
  PictureOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Descriptions,
  Empty,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StatusTag } from '../../components/common/StatusTag';
import { TruthBadge } from '../../components/workbench/TruthBadge';
import { DEMO_PROJECT_ID } from '../../domain/constants';
import { useControlPlaneStore } from '../../stores/controlPlaneStore';
import { useProjectStore } from '../../stores/projectStore';

export function StoryboardPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const workspace = useProjectStore((state) => state.workspace);
  const snapshot = useControlPlaneStore((state) => state.snapshot);
  const loading = useControlPlaneStore((state) => state.loading);
  const error = useControlPlaneStore((state) => state.error);
  const createPackage = useControlPlaneStore(
    (state) => state.createCanonicalPackage,
  );
  const clearError = useControlPlaneStore((state) => state.clearError);
  const [selectedShotId, setSelectedShotId] = useState('shot-07');

  const generatedAsset = snapshot.assetReceipts.find(
    (receipt) => receipt.shotId === 'shot-07',
  );
  const failedReceipt = snapshot.generationTaskReceipts.find(
    (receipt) => receipt.shotId === 'shot-05' && receipt.status === 'failed',
  );

  const shots = useMemo(
    () =>
      workspace.storyboard.map((shot) =>
        shot.id === 'shot-07' && generatedAsset
          ? {
              ...shot,
              assetId: generatedAsset.assetId,
              matchStatus: 'matched' as const,
              status: 'done' as const,
            }
          : shot,
      ),
    [generatedAsset, workspace.storyboard],
  );
  const selectedShot =
    shots.find((shot) => shot.id === selectedShotId) ?? shots[0];
  const matched = shots.filter((shot) => shot.matchStatus === 'matched').length;
  const duration = shots.reduce((total, shot) => total + shot.duration, 0);

  if (projectId !== DEMO_PROJECT_ID) {
    return (
      <Empty
        description={`仅支持 canonical 项目 ${DEMO_PROJECT_ID}，当前为 ${projectId}`}
      >
        <Button
          type="primary"
          onClick={() => navigate(`/projects/${DEMO_PROJECT_ID}/storyboard`)}
        >
          打开统一分镜
        </Button>
      </Empty>
    );
  }

  return (
    <div className="d1-page-stack">
      <header className="d1-page-header">
        <div>
          <Space size={8} wrap>
            <Tag color="blue">{DEMO_PROJECT_ID}</Tag>
            <TruthBadge capabilityId="demo.local-life-golden-path" compact />
          </Space>
          <Typography.Title level={2}>分镜生产单</Typography.Title>
          <Typography.Paragraph type="secondary">
            已批准 script-a 拆为 8 镜；真实门店素材优先，缺镜必须通过补拍或有来源的合规生成补齐。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button
            icon={<FileProtectOutlined />}
            loading={loading}
            disabled={Boolean(snapshot.package)}
            onClick={createPackage}
          >
            {snapshot.package ? 'canonical package 已创建' : '创建 canonical package'}
          </Button>
          <Button
            type="primary"
            icon={<ArrowRightOutlined />}
            disabled={!snapshot.package}
            onClick={() => navigate(`/production/inbox/${DEMO_PROJECT_ID}`)}
          >
            进入媒体生产
          </Button>
        </Space>
      </header>

      {error ? (
        <Alert
          type="error"
          showIcon
          closable
          onClose={clearError}
          message={`${error.code} · 无法创建生产包`}
          description={error.message}
        />
      ) : null}

      <section className="d1-storyboard-summary">
        <div>
          <span>镜头</span>
          <strong>{shots.length}</strong>
        </div>
        <div>
          <span>总时长</span>
          <strong>{duration}s</strong>
        </div>
        <div>
          <span>已匹配</span>
          <strong>{matched}</strong>
        </div>
        <div>
          <span>待补拍</span>
          <strong>{shots.filter((shot) => shot.matchStatus === 'reshoot').length}</strong>
        </div>
        <div>
          <span>缺镜</span>
          <strong>{shots.filter((shot) => shot.matchStatus === 'missing').length}</strong>
        </div>
      </section>

      <section className="d1-storyboard-layout">
        <div className="d1-surface d1-shot-list">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>8 镜生产计划</Typography.Title>
              <Typography.Text type="secondary">
                点击镜头查看来源、风险和生成状态。
              </Typography.Text>
            </div>
            <Tag>{snapshot.truthManifest.disclaimer}</Tag>
          </div>
          {shots.map((shot) => (
            <button
              type="button"
              key={shot.id}
              className={
                selectedShot?.id === shot.id
                  ? 'd1-shot-row is-selected'
                  : 'd1-shot-row'
              }
              onClick={() => setSelectedShotId(shot.id)}
            >
              <span className="d1-shot-order">
                {String(shot.order).padStart(2, '0')}
              </span>
              <span className="d1-shot-icon">
                {shot.sourceType === 'upload' ? (
                  <VideoCameraOutlined />
                ) : shot.sourceType === 'shoot' ? (
                  <CameraOutlined />
                ) : (
                  <PictureOutlined />
                )}
              </span>
              <span className="d1-shot-copy">
                <strong>{shot.description}</strong>
                <small>
                  {shot.duration}s · {shot.screenText} · {shot.sourceType}
                </small>
              </span>
              <StatusTag kind="match" value={shot.matchStatus} />
            </button>
          ))}
        </div>

        <aside className="d1-surface d1-shot-inspector">
          {selectedShot ? (
            <>
              <div className="d1-section-heading">
                <div>
                  <Typography.Text type="secondary">
                    SHOT {String(selectedShot.order).padStart(2, '0')}
                  </Typography.Text>
                  <Typography.Title level={4}>
                    {selectedShot.description}
                  </Typography.Title>
                </div>
                <StatusTag kind="match" value={selectedShot.matchStatus} />
              </div>
              <Descriptions
                column={1}
                size="small"
                items={[
                  {
                    key: 'narration',
                    label: '口播',
                    children: selectedShot.narration,
                  },
                  {
                    key: 'screen',
                    label: '字幕',
                    children: selectedShot.screenText,
                  },
                  {
                    key: 'camera',
                    label: '机位',
                    children: selectedShot.cameraPosition,
                  },
                  {
                    key: 'source',
                    label: '来源策略',
                    children:
                      selectedShot.sourceType === 'upload'
                        ? '真实门店素材优先'
                        : selectedShot.sourceType === 'shoot'
                          ? '补拍，不用虚假画面替代'
                          : '合规生成，必须登记任务与资产回执',
                  },
                  {
                    key: 'asset',
                    label: 'Asset',
                    children: selectedShot.assetId ?? '尚无可交付资产',
                  },
                ]}
              />

              {selectedShot.id === 'shot-05' ? (
                <Alert
                  type={failedReceipt ? 'error' : 'warning'}
                  showIcon
                  message={
                    failedReceipt
                      ? '确定性失败回执已接收，仍保持待补拍'
                      : '分镜 05 · 虾滑制作待补拍'
                  }
                  description={
                    failedReceipt?.error?.message ??
                    '真实补拍素材尚未进入 C4 canonical AssetReceipt，本页不会伪造 matched。'
                  }
                />
              ) : null}
              {selectedShot.id === 'shot-07' ? (
                <Alert
                  type={generatedAsset ? 'success' : 'info'}
                  showIcon
                  message={
                    generatedAsset
                      ? '合规权益图卡已由 AssetReceipt 登记'
                      : '分镜 07 · 会员权益缺镜'
                  }
                  description={
                    generatedAsset
                      ? `${generatedAsset.assetId} · ${generatedAsset.reviewStatus}`
                      : '进入媒体生产工作台后，按 120 → 100 + 20 成功支线生成并登记。'
                  }
                />
              ) : null}

              {snapshot.package ? (
                <div className="d1-package-proof">
                  <span>Package v{snapshot.package.packageVersion}</span>
                  <Typography.Text copyable={{ text: snapshot.package.digest }}>
                    {snapshot.package.digest.slice(0, 24)}…
                  </Typography.Text>
                </div>
              ) : (
                <Alert
                  type="warning"
                  showIcon
                  message="尚未创建不可变生产包"
                  description="创建后会快照化 Brief、Claim、规则、批准脚本和当前 8 镜。"
                />
              )}
            </>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
