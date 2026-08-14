import { motion, useReducedMotion } from 'framer-motion';
import { IconAlertCircle, IconCircleCheck, IconPhoto, IconUser, IconVideo } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { CanvasEventV01 } from '../model/contracts';
import type { CanvasShotView } from '../pages/CanvasV1Page';
import { controlledMediaSrc } from './controlledMedia';

interface ProductionCanvasProps {
  shot: CanvasShotView;
  event?: CanvasEventV01;
  selectionDisabled: boolean;
  onSelectOutput: (outputAssetId: string) => void;
}

function NodeShell({ step, label, title, icon, state, children }: { step: string; label: string; title: string; icon: ReactNode; state?: string; children: ReactNode }) {
  return (
    <section className="cv1-node">
      <div className="cv1-node__heading">
        <span className="cv1-node__step">{step}</span>
        <span className="cv1-node__label">{label}</span>
        {state ? <small>{state}</small> : null}
      </div>
      <div className="cv1-node__title"><span className="cv1-node__icon">{icon}</span><strong>{title}</strong></div>
      {children}
    </section>
  );
}

export function ProductionCanvas({ shot, event, selectionDisabled, onSelectOutput }: ProductionCanvasProps) {
  const reduceMotion = useReducedMotion();
  const taskRunning = event && ['accepted', 'provider_submitted', 'task_created'].includes(event.status);
  const imageOutput = shot.outputs.find((output) => output.kind === 'image');
  const videoOutput = shot.outputs.find((output) => output.kind === 'video');
  const imagePreviewSrc = controlledMediaSrc(imageOutput?.previewUrl);
  const videoPreviewSrc = controlledMediaSrc(videoOutput?.previewUrl);
  const outputRegistered = Boolean(event?.outputRegistered || videoOutput);
  const videoState = event?.status === 'failed'
    ? '生成失败'
    : taskRunning
      ? event?.status === 'task_created' ? '正在登记' : '生成中'
      : outputRegistered
        ? '输出已登记'
        : '等待生成';

  return (
    <motion.main
      key={shot.shotId}
      className="cv1-production"
      aria-label="当前镜头生产链"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <div className="cv1-production__title">
        <div>
          <span>镜头 {String(shot.sequence).padStart(2, '0')}</span>
          <h1>{shot.title}</h1>
        </div>
        <time>{shot.durationSeconds} 秒</time>
      </div>

      <ol className="cv1-chain" aria-label="当前镜头生产链">
        <li>
          <NodeShell step="01" label="Script" title="脚本与分镜" icon={<span aria-hidden="true">文</span>} state="已批准">
            <div className="cv1-node__script">
              <p>{shot.scriptText}</p>
              <blockquote>{shot.storyboardText}</blockquote>
            </div>
          </NodeShell>
        </li>
        <li>
          <NodeShell step="02" label="Asset" title="镜头资产" icon={<IconUser size={17} />} state={shot.readiness.ready ? '已匹配' : '有缺口'}>
            <div className="cv1-node__asset-line">
              {shot.requiredAssetLabels.map((assetLabel) => (
                <span key={assetLabel}>
                  {shot.readiness.ready ? <IconCircleCheck size={14} /> : <IconAlertCircle size={14} />}
                  {assetLabel}
                </span>
              ))}
            </div>
            <p className="cv1-node__support">{shot.readiness.ready ? '当前镜头的权利、审批与项目绑定已通过。' : '资产缺口会在右侧检查器中说明。'}</p>
          </NodeShell>
        </li>
        <li>
          <NodeShell step="03" label="Image" title="候选画面" icon={<IconPhoto size={17} />} state={imageOutput?.selected ? '已选择' : imageOutput ? '待选择' : '待生成'}>
          {imageOutput && imagePreviewSrc ? (
            <div className="cv1-node__preview">
              <img src={imagePreviewSrc} alt={`${shot.title}候选画面`} />
              {imageOutput.selected
                ? <span className="cv1-node__selected">当前已选</span>
                : <button type="button" disabled={selectionDisabled} onClick={() => onSelectOutput(imageOutput.assetId)}>选择此候选画面</button>}
            </div>
          ) : (
            <div className="cv1-node__placeholder"><IconPhoto size={24} /><span>生成后在这里选择候选画面</span></div>
          )}
          </NodeShell>
        </li>
        <li>
          <NodeShell step="04" label="Video" title="视频镜头" icon={<IconVideo size={17} />} state={videoState}>
            {videoPreviewSrc ? (
              <div className="cv1-node__video-preview">
                <video src={videoPreviewSrc} aria-label={`${shot.title}视频预览`} controls preload="metadata" />
                <span>可预览</span>
              </div>
            ) : taskRunning ? (
              <div className="cv1-node__progress" role="status"><span /><p>{event?.status === 'task_created' ? '生成完成，正在登记输出' : '正在生成当前镜头'}</p><small>页面会依据真实工作区事实自动更新</small></div>
            ) : (
              <div className="cv1-node__video-copy"><strong>{outputRegistered ? '输出已登记，等待受控预览' : '尚未生成视频'}</strong><small>{outputRegistered ? '预览就绪后会在此处出现' : '先确认资产门禁和镜头参数'}</small></div>
            )}
          </NodeShell>
        </li>
      </ol>
    </motion.main>
  );
}
