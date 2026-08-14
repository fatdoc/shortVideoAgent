import { IconAlertTriangle, IconLoader2 } from '@tabler/icons-react';
import { useMemo } from 'react';
import { AssetBindingDrawer } from '../components/AssetBindingDrawer';
import { AssetDock } from '../components/AssetDock';
import { CanvasHeader } from '../components/CanvasHeader';
import { HighCostApprovalDialog } from '../components/HighCostApprovalDialog';
import { NodeInspector } from '../components/NodeInspector';
import { PlaylistStrip } from '../components/PlaylistStrip';
import { ProductionCanvas } from '../components/ProductionCanvas';
import { ShotRail } from '../components/ShotRail';
import { useActiveCanvasShot } from '../hooks/useActiveCanvasShot';
import { type PrepareHighCostApproval, useCanvasCommandApprovalFlow } from '../hooks/useCanvasCommandApprovalFlow';
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
  commandContext: {
    requestedByActorId: string;
    /** @deprecated Dynamic high-cost actions always prepare an exact-action approval. */
    approvalId?: string | null;
  };
  prepareHighCostApproval?: PrepareHighCostApproval;
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
  prepareHighCostApproval,
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
  const approvalFlow = useCanvasCommandApprovalFlow({
    context: bootstrap ? {
      tenantId: bootstrap.tenantId,
      projectId: bootstrap.projectId,
      packageId: bootstrap.packageId,
      canvasSessionId: bootstrap.canvasSessionId,
      requestedByActorId: commandContext.requestedByActorId,
    } : null,
    prepareHighCostApproval,
    onCommand,
  });
  const blockingReasons = useMemo(() => {
    const reasons = activeShot?.readiness.reasonCodes.map((reason) => reasonCopy[reason] ?? '当前镜头未通过生产检查') ?? [];
    if (bootstrap?.status === 'blocked') {
      const videoCapability = bootstrap.capabilities.find((entry) => entry.capability === 'video_generation');
      reasons.push(videoCapability?.reasonCode ? reasonCopy[videoCapability.reasonCode] ?? '视频生成能力当前不可用' : '项目生产入口尚未就绪');
    }
    if (!prepareHighCostApproval) reasons.push('生成确认服务当前不可用');
    return [...new Set(reasons)];
  }, [activeShot, bootstrap, prepareHighCostApproval]);

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
  const canGenerate = bootstrap.status === 'ready' && activeShot.readiness.ready && Boolean(prepareHighCostApproval) && !taskRunning && !approvalFlow.approvalPending;

  const command = (commandType: CanvasCommandV01['commandType'], payload: CanvasCommandV01['payload']): CanvasCommandV01 => ({
    objectType: 'CanvasCommand',
    contractVersion: '0.1',
    tenantId: bootstrap.tenantId,
    projectId: bootstrap.projectId,
    packageId: bootstrap.packageId,
    canvasSessionId: bootstrap.canvasSessionId,
    commandId: generatedUuid(),
    commandType,
    requestedByActorId: commandContext.requestedByActorId,
    requestSource: 'user',
    approvalId: null,
    payload,
    requestId: `req-canvas-${generatedUuid()}`,
    occurredAt: new Date().toISOString(),
  });

  const generateShot = (prompt: string) => {
    if (!canGenerate) return;
    const referenceAssetIds = activeShot.readiness.requirements.flatMap((requirement) => requirement.assetId ? [requirement.assetId] : []);
    approvalFlow.requestCommand(
      command('GENERATE_SHOT', {
        shotId: activeShot.shotId,
        readinessId: activeShot.readiness.readinessId,
        prompt,
        referenceAssetIds,
      }),
      { title: '确认生成当前镜头', summary: `镜头 ${String(activeShot.sequence).padStart(2, '0')} · ${activeShot.title}` },
    );
  };

  const bindAsset = (asset: CanvasAssetView) => {
    if (!prepareHighCostApproval || approvalFlow.approvalPending || !asset.targetEntityId || asset.rightsStatus !== 'authorized' || asset.approvalStatus !== 'approved' || asset.providerStatus !== 'active') return;
    if (approvalFlow.requestCommand(
      command('BIND_ASSET_TO_ENTITY', { assetId: asset.assetId, entityId: asset.targetEntityId }),
      { title: '确认绑定项目资产', summary: `${asset.displayName} · 当前镜头` },
    )) closeAssetBinding();
  };

  const createVirtualCharacter = (asset: CanvasAssetView, prompt: string) => {
    if (!prepareHighCostApproval || approvalFlow.approvalPending || !asset.targetEntityId || asset.category !== 'virtual_character' || asset.rightsStatus !== 'authorized' || asset.approvalStatus !== 'approved' || asset.providerStatus === 'active' || !prompt) return;
    if (approvalFlow.requestCommand(
      command('CREATE_VIRTUAL_CHARACTER', { assetId: asset.assetId, entityId: asset.targetEntityId, prompt }),
      { title: '确认创建虚拟人物', summary: `${asset.displayName} · 当前人物设定` },
    )) closeAssetBinding();
  };

  const selectOutput = (outputAssetId: string) => {
    if (!prepareHighCostApproval || approvalFlow.approvalPending) return;
    approvalFlow.requestCommand(
      command('SELECT_SHOT_OUTPUT', { shotId: activeShot.shotId, outputAssetId, documentId: document.documentId, expectedVersion: document.version }),
      { title: '确认替换候选画面', summary: `镜头 ${String(activeShot.sequence).padStart(2, '0')} · ${activeShot.title}` },
    );
  };

  const exportPlaylist = () => {
    const exportAvailable = bootstrap.capabilities.some((entry) => entry.capability === 'playlist_export' && entry.available);
    if (!prepareHighCostApproval || approvalFlow.approvalPending || !exportAvailable || document.playlist.shotIds.length === 0) return;
    approvalFlow.requestCommand(
      command('EXPORT_PLAYLIST', { documentId: document.documentId, expectedVersion: document.version }),
      { title: '确认导出成片', summary: `${document.playlist.shotIds.length} 个镜头 · 当前成片顺序` },
    );
  };

  const reorderPlaylist = (shotIds: string[]) => {
    approvalFlow.requestCommand(command('SAVE_CANVAS_DOCUMENT', { documentId: document.documentId, expectedVersion: document.version, shots: document.shots, playlist: { shotIds } }));
  };

  const playlistExportAvailable = bootstrap.capabilities.some((entry) => entry.capability === 'playlist_export' && entry.available);
  const creationPrompt = document.shots.find((shot) => shot.shotId === activeShot.shotId)?.prompt ?? activeShot.storyboardText;

  return (
    <div className="cv1-app">
      <CanvasHeader projectName={projectName} documentVersion={document.version} saveState={saveState} />
      {saveState === 'conflict' ? <div className="cv1-conflict" role="alert"><IconAlertTriangle size={16} />画布版本已更新，刷新后再继续编辑。</div> : null}
      <div className="cv1-workspace">
        <ShotRail shots={shots} activeShotId={activeShotId} taskEvents={taskEvents} onSelect={setActiveShot} />
        <div className="cv1-center-stage">
          <ProductionCanvas shot={activeShot} event={event} selectionDisabled={!prepareHighCostApproval || approvalFlow.approvalPending} onSelectOutput={selectOutput} />
          <AssetDock assets={assetViews} open={assetDockOpen} onToggle={toggleAssetDock} onInspectBinding={openAssetBinding} />
          <PlaylistStrip shots={shots} orderedShotIds={document.playlist.shotIds} exportAvailable={playlistExportAvailable && Boolean(prepareHighCostApproval)} commandPending={approvalFlow.approvalPending} onReorder={reorderPlaylist} onExport={exportPlaylist} />
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
      <AssetBindingDrawer asset={bindingAsset} approvalAvailable={Boolean(prepareHighCostApproval) && !approvalFlow.approvalPending} creationPrompt={creationPrompt} onClose={closeAssetBinding} onBind={bindAsset} onCreateVirtual={createVirtualCharacter} />
      <HighCostApprovalDialog approval={approvalFlow.approval} onCancel={approvalFlow.cancelApproval} onConfirm={approvalFlow.confirmApproval} />
    </div>
  );
}
