import { IconAlertTriangle, IconLoader2 } from '@tabler/icons-react';
import { useMemo } from 'react';
import { CanvasHeader } from '../components/CanvasHeader';
import { ProductionCanvas } from '../components/ProductionCanvas';
import { ShotRail } from '../components/ShotRail';
import { useActiveCanvasShot } from '../hooks/useActiveCanvasShot';
import type {
  CanvasBootstrapV01,
  CanvasCommandV01,
  CanvasDocumentV01,
  CanvasEventV01,
  ShotReadinessV01,
} from '../model/contracts';
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

export interface CanvasV1PageProps {
  projectName?: string;
  loadState: CanvasLoadState;
  bootstrap: CanvasBootstrapV01 | null;
  document: CanvasDocumentV01 | null;
  shots: CanvasShotView[];
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
}: CanvasV1PageProps) {
  const { activeShot, activeShotId, setActiveShot } = useActiveCanvasShot(shots);
  const event = activeShot ? taskEvents[activeShot.shotId] : undefined;
  const blockingReasons = useMemo(
    () => activeShot?.readiness.reasonCodes.map((reason) => reasonCopy[reason] ?? '当前镜头未通过生产检查') ?? [],
    [activeShot],
  );

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
  const canGenerate = bootstrap.status === 'ready' && activeShot.readiness.ready && !taskRunning;

  const generateShot = () => {
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
        prompt: document.shots.find((shot) => shot.shotId === activeShot.shotId)?.prompt ?? activeShot.storyboardText,
        referenceAssetIds,
      },
      requestId: `req-canvas-${generatedUuid()}`,
      occurredAt: new Date().toISOString(),
    });
  };

  return (
    <div className="cv1-app">
      <CanvasHeader projectName={projectName} documentVersion={document.version} saveState={saveState} />
      {saveState === 'conflict' ? <div className="cv1-conflict" role="alert"><IconAlertTriangle size={16} />画布版本已更新，刷新后再继续编辑。</div> : null}
      <div className="cv1-workspace">
        <ShotRail shots={shots} activeShotId={activeShotId} taskEvents={taskEvents} onSelect={setActiveShot} />
        <ProductionCanvas shot={activeShot} event={event} />
        <aside className="cv1-inspector" aria-label="镜头检查器">
          <div className="cv1-section-heading"><div><span>生产检查</span><small>镜头 {String(activeShot.sequence).padStart(2, '0')}</small></div></div>
          <section className={`cv1-readiness ${canGenerate ? 'is-ready' : 'is-blocked'}`}>
            <span>{activeShot.readiness.ready ? 'READY' : 'BLOCKED'}</span>
            <strong>{activeShot.readiness.ready ? '镜头已就绪，可以生成' : '当前镜头暂不可生成'}</strong>
            {blockingReasons.length ? <ul>{blockingReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p>权利、审批、Provider 和项目绑定均已通过。</p>}
          </section>
          {event?.status === 'failed' && event.error ? <div className="cv1-task-error" role="alert"><strong>任务失败</strong><p>{event.error.message}</p></div> : null}
          {taskRunning ? <div className="cv1-task-running" role="status"><IconLoader2 className="cv1-spin" size={16} /><span>正在生成镜头</span></div> : null}
          <label className="cv1-field">
            <span>生成提示</span>
            <textarea defaultValue={document.shots.find((shot) => shot.shotId === activeShot.shotId)?.prompt ?? activeShot.storyboardText} rows={5} />
          </label>
          <button className="cv1-primary-action" type="button" disabled={!canGenerate} onClick={generateShot}>生成当前镜头</button>
          {!canGenerate && blockingReasons.length ? <p className="cv1-action-explain">请先处理：{blockingReasons[0]}</p> : null}
        </aside>
      </div>
    </div>
  );
}
