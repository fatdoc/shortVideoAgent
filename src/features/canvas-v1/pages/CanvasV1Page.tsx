import { IconAlertTriangle, IconLoader2 } from '@tabler/icons-react';
import { useMemo } from 'react';
import { AssetBindingDrawer } from '../components/AssetBindingDrawer';
import { AssetDock } from '../components/AssetDock';
import { CanvasHeader } from '../components/CanvasHeader';
import { NodeInspector } from '../components/NodeInspector';
import { PlaylistStrip } from '../components/PlaylistStrip';
import { ProductionCanvas } from '../components/ProductionCanvas';
import { ShotRail } from '../components/ShotRail';
import { useActiveCanvasShot } from '../hooks/useActiveCanvasShot';
import type {
  CanvasBootstrapV01,
  CanvasCommandV01,
  CanvasDocumentV01,
  CanvasEventV01,
  AssetCategory,
  ApprovalStatus,
  EntityBindingStatus,
  ProviderStatus,
  RightsStatus,
  ShotReadinessV01,
} from '../model/contracts';
import { useCanvasV1ViewState } from '../model/viewState';
import '../canvas-v1.css';

export type CanvasLoadState = 'loading' | 'loaded' | 'failed';
export type CanvasSaveState = 'saving' | 'saved' | 'conflict' | 'offline';

export interface CanvasOutputView {
  assetId: string;
  kind: 'image' | 'video';
  previewUrl: string;
  selected: boolean;
}

export interface CanvasShotView {
  shotId: string;
  sequence: number;
  title: string;
  durationSeconds: number;
  scriptText: string;
  storyboardText: string;
  thumbnailUrl?: string;
  readiness: ShotReadinessV01;
  requiredAssetLabels: string[];
  outputs: CanvasOutputView[];
}

export interface CanvasAssetView {
  assetId: string;
  category: AssetCategory;
  displayName: string;
  rightsStatus: RightsStatus;
  approvalStatus: ApprovalStatus;
  providerStatus: ProviderStatus;
  entityBindingStatus: EntityBindingStatus;
  controlledPreviewUrl: string | null;
  targetEntityId?: string;
}

export interface CanvasV1PageProps {
  projectName?: string;
  loadState: CanvasLoadState;
  bootstrap: CanvasBootstrapV01 | null;
  document: CanvasDocumentV01 | null;
  shots: CanvasShotView[];
  assets?: CanvasAssetView[];
  taskEvents: Record<string, CanvasEventV01 | undefined>;
  saveState: CanvasSaveState;
  commandContext: { requestedByActorId: string; approvalId: string | null };
  onCommand: (command: CanvasCommandV01) => void | Promise<void>;
}

const reasonCopy: Partial<Record<ShotReadinessV01['reasonCodes'][number], string>> = {
  REQUIRED_ASSET_MISSING: '尚未绑定所需资产',
  RIGHTS_PENDING: '等待真人授权',
  RIGHTS_REJECTED: '人物授权未通过',
  RIGHTS_REVOKED: '人物授权已撤销',
  RIGHTS_EXPIRED: '人物授权已过期',
  ASSET_APPROVAL_PENDING: '素材已上传，尚未审批',
  PROVIDER_PROCESSING: '人物资产正在注册',
  PROVIDER_UNAVAILABLE: 'Seedance 能力当前不可用',
  ENTITY_BINDING_MISSING: '尚未绑定人物资产',
  ENTITY_BINDING_PENDING: '人物绑定等待审批',
  CAPABILITY_UNAVAILABLE: 'Seedance 能力当前不可用',
  SCRIPT_NOT_CURRENT: '脚本不是当前批准版本',
  STORYBOARD_NOT_CURRENT: '分镜不是当前批准版本',
};

function generatedUuid(): string {
  return globalThis.crypto.randomUUID();
}

export function CanvasV1Page({
  projectName = '门店探店视频',
  loadState,
  bootstrap,
  document,
  shots,
  taskEvents,
  saveState,
  commandContext,
  onCommand,
  assets,
}: CanvasV1PageProps) {
  const { activeShot, activeShotId, setActiveShot } = useActiveCanvasShot(shots);
  const assetDockOpen = useCanvasV1ViewState((state) => state.assetDockOpen);
  const toggleAssetDock = useCanvasV1ViewState((state) => state.toggleAssetDock);
  const bindingAssetId = useCanvasV1ViewState((state) => state.bindingAssetId);
  const openAssetBinding = useCanvasV1ViewState((state) => state.openAssetBinding);
  const closeAssetBinding = useCanvasV1ViewState((state) => state.closeAssetBinding);
  const event = activeShot ? taskEvents[activeShot.shotId] : undefined;
  const assetViews = assets ?? bootstrap?.assetSummaries ?? [];
  const bindingAsset = assetViews.find((asset) => asset.assetId === bindingAssetId) ?? null;
  const blockingReasons = useMemo(() => {
    const reasons = activeShot?.readiness.reasonCodes.map((reason) => reasonCopy[reason] ?? '当前镜头未通过生产检查') ?? [];
    if (bootstrap?.status === 'blocked') {
      const videoCapability = bootstrap.capabilities.find((entry) => entry.capability === 'video_generation');
      reasons.push(videoCapability?.reasonCode ? reasonCopy[videoCapability.reasonCode] ?? '视频生成能力当前不可用' : '项目生产入口尚未就绪');
    }
    if (!commandContext.approvalId) reasons.push('生成审批尚未确认');
    return [...new Set(reasons)];
  }, [activeShot, bootstrap, commandContext.approvalId]);

  if (loadState === 'loading') {
    return <div className="cv1-state-page" role="status"><IconLoader2 className="cv1-spin" /><strong>正在加载门店生产台</strong><span>同步已批准脚本、分镜和项目资产</span></div>;
  }

  if (loadState === 'failed' || !bootstrap || !document) {
    return <div className="cv1-state-page cv1-state-page--error" role="alert"><IconAlertTriangle /><strong>生产台加载失败</strong><span>没有使用演示数据回退，请重新获取真实项目。</span></div>;
  }

  if (!activeShot) {
    return <div className="cv1-state-page"><strong>还没有可制作的镜头</strong><span>批准脚本与分镜后，镜头会出现在这里。</span></div>;
  }

  const taskRunning = event && ['accepted', 'provider_submitted', 'task_created'].includes(event.status);
  const canGenerate = bootstrap.status === 'ready' && activeShot.readiness.ready && Boolean(commandContext.approvalId) && !taskRunning;

  const generateShot = (prompt: string) => {
    if (!canGenerate) return;
    const referenceAssetIds = activeShot.readiness.requirements.flatMap((requirement) => requirement.assetId ? [requirement.assetId] : []);
    void onCommand({
      objectType: 'CanvasCommand',
      contractVersion: '0.1',
      tenantId: bootstrap.tenantId,
      projectId: bootstrap.projectId,
      packageId: bootstrap.packageId,
      canvasSessionId: bootstrap.canvasSessionId,
      commandId: generatedUuid(),
      commandType: 'GENERATE_SHOT',
      requestedByActorId: commandContext.requestedByActorId,
      requestSource: 'user',
      approvalId: commandContext.approvalId,
      payload: {
        shotId: activeShot.shotId,
        readinessId: activeShot.readiness.readinessId,
        prompt,
        referenceAssetIds,
      },
      requestId: `req-canvas-${generatedUuid()}`,
      occurredAt: new Date().toISOString(),
    });
  };

  const bindAsset = (asset: CanvasAssetView) => {
    if (!commandContext.approvalId || !asset.targetEntityId) return;
    void onCommand({
      objectType: 'CanvasCommand', contractVersion: '0.1', tenantId: bootstrap.tenantId, projectId: bootstrap.projectId,
      packageId: bootstrap.packageId, canvasSessionId: bootstrap.canvasSessionId, commandId: generatedUuid(),
      commandType: 'BIND_ASSET_TO_ENTITY', requestedByActorId: commandContext.requestedByActorId, requestSource: 'user',
      approvalId: commandContext.approvalId, payload: { assetId: asset.assetId, entityId: asset.targetEntityId },
      requestId: `req-canvas-${generatedUuid()}`, occurredAt: new Date().toISOString(),
    });
    closeAssetBinding();
  };

  const reorderPlaylist = (shotIds: string[]) => {
    void onCommand({
      objectType: 'CanvasCommand', contractVersion: '0.1', tenantId: bootstrap.tenantId, projectId: bootstrap.projectId,
      packageId: bootstrap.packageId, canvasSessionId: bootstrap.canvasSessionId, commandId: generatedUuid(),
      commandType: 'SAVE_CANVAS_DOCUMENT', requestedByActorId: commandContext.requestedByActorId, requestSource: 'user',
      approvalId: null, payload: { documentId: document.documentId, expectedVersion: document.version, shots: document.shots, playlist: { shotIds } },
      requestId: `req-canvas-${generatedUuid()}`, occurredAt: new Date().toISOString(),
    });
  };

  return (
    <div className="cv1-app">
      <CanvasHeader projectName={projectName} documentVersion={document.version} saveState={saveState} />
      {saveState === 'conflict' ? <div className="cv1-conflict" role="alert"><IconAlertTriangle size={16} />画布版本已更新，刷新后再继续编辑。</div> : null}
      <div className="cv1-workspace">
        <ShotRail shots={shots} activeShotId={activeShotId} taskEvents={taskEvents} onSelect={setActiveShot} />
        <div className="cv1-center-stage">
          <ProductionCanvas shot={activeShot} event={event} />
          <AssetDock assets={assetViews} open={assetDockOpen} onToggle={toggleAssetDock} onInspectBinding={openAssetBinding} />
          <PlaylistStrip shots={shots} orderedShotIds={document.playlist.shotIds} onReorder={reorderPlaylist} />
        </div>
        <NodeInspector
          key={`${document.documentId}:${document.version}:${activeShot.shotId}`}
          shot={activeShot}
          assets={assetViews}
          event={event}
          initialPrompt={document.shots.find((shot) => shot.shotId === activeShot.shotId)?.prompt ?? activeShot.storyboardText}
          canGenerate={Boolean(canGenerate)}
          blockingReasons={blockingReasons}
          onGenerate={generateShot}
        />
      </div>
      <AssetBindingDrawer asset={bindingAsset} approvalGranted={Boolean(commandContext.approvalId)} onClose={closeAssetBinding} onBind={bindAsset} />
    </div>
  );
}
