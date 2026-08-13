import { IconLoader2 } from '@tabler/icons-react';
import { useState } from 'react';
import type { CanvasEventV01 } from '../model/contracts';
import type { CanvasAssetView, CanvasShotView } from '../pages/CanvasV1Page';
import { AssetReadinessPanel } from './AssetReadinessPanel';

interface NodeInspectorProps {
  shot: CanvasShotView;
  assets: CanvasAssetView[];
  event?: CanvasEventV01;
  initialPrompt: string;
  canGenerate: boolean;
  blockingReasons: string[];
  onGenerate: (prompt: string) => void;
}

export function NodeInspector({ shot, assets, event, initialPrompt, canGenerate, blockingReasons, onGenerate }: NodeInspectorProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const taskRunning = event && ['accepted', 'provider_submitted', 'task_created'].includes(event.status);
  const gateReady = shot.readiness.ready && blockingReasons.length === 0;

  return (
    <aside className="cv1-inspector" aria-label="镜头检查器">
      <div className="cv1-section-heading"><div><span>生产检查</span><small>镜头 {String(shot.sequence).padStart(2, '0')}</small></div></div>
      <section className={`cv1-readiness ${gateReady ? 'is-ready' : 'is-blocked'}`}>
        <span>{gateReady ? 'READY' : 'BLOCKED'}</span>
        <strong>{gateReady ? '镜头已就绪，可以生成' : '当前镜头暂不可生成'}</strong>
        {blockingReasons.length ? <ul>{blockingReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p>权利、审批、Provider 和项目绑定均已通过。</p>}
      </section>
      <AssetReadinessPanel assets={assets} />
      {event?.status === 'failed' && event.error ? <div className="cv1-task-error" role="alert"><strong>任务失败</strong><p>{event.error.message}</p></div> : null}
      {taskRunning ? <div className="cv1-task-running" role="status"><IconLoader2 className="cv1-spin" size={16} /><span>正在生成镜头</span></div> : null}
      <label className="cv1-field">
        <span>生成提示</span>
        <textarea value={prompt} onChange={(eventValue) => setPrompt(eventValue.target.value)} rows={5} />
      </label>
      <button className="cv1-primary-action" type="button" disabled={!canGenerate || prompt.trim().length === 0} onClick={() => onGenerate(prompt.trim())}>生成当前镜头</button>
      {!canGenerate && blockingReasons.length ? <p className="cv1-action-explain">请先处理：{blockingReasons[0]}</p> : null}
    </aside>
  );
}
