import { motion } from 'framer-motion';
import { IconArrowDown, IconCircleCheck, IconPhoto, IconUser, IconVideo } from '@tabler/icons-react';
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

function ChainLink() {
  return <IconArrowDown className="cv1-chain-link" size={16} aria-hidden="true" />;
}

function NodeShell({ eyebrow, icon, state, children }: { eyebrow: string; icon: ReactNode; state?: string; children: ReactNode }) {
  return (
    <section className="cv1-node">
      <div className="cv1-node__heading">
        <span className="cv1-node__icon">{icon}</span>
        <span>{eyebrow}</span>
        {state ? <small>{state}</small> : null}
      </div>
      {children}
    </section>
  );
}

export function ProductionCanvas({ shot, event, selectionDisabled, onSelectOutput }: ProductionCanvasProps) {
  const taskRunning = event && ['accepted', 'provider_submitted', 'task_created'].includes(event.status);
  const output = shot.outputs[0];
  const outputPreviewSrc = controlledMediaSrc(output?.previewUrl);

  return (
    <motion.main
      key={shot.shotId}
      className="cv1-production"
      aria-label="当前镜头生产链"
      initial={{ opacity: 0, y: 8 }}
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

      <div className="cv1-chain">
        <NodeShell eyebrow="脚本 / 分镜" icon={<span className="cv1-node__step">01</span>} state="已批准">
          <p>{shot.scriptText}</p>
          <blockquote>{shot.storyboardText}</blockquote>
        </NodeShell>
        <ChainLink />
        <NodeShell eyebrow="镜头资产" icon={<IconUser size={17} />} state={shot.readiness.ready ? '已匹配' : '有缺口'}>
          <div className="cv1-node__asset-line">
            {shot.requiredAssetLabels.map((label) => <span key={label}><IconCircleCheck size={14} />{label}</span>)}
          </div>
        </NodeShell>
        <ChainLink />
        <NodeShell eyebrow="候选画面" icon={<IconPhoto size={17} />} state={output?.selected ? '已选择' : output ? '待选择' : '待生成'}>
          {output && outputPreviewSrc ? (
            <div className="cv1-node__preview">
              <img src={outputPreviewSrc} alt={`${shot.title}候选画面`} />
              {output.selected
                ? <span className="cv1-node__selected">当前已选</span>
                : <button type="button" disabled={selectionDisabled} onClick={() => onSelectOutput(output.assetId)}>选择此候选画面</button>}
            </div>
          ) : (
            <div className="cv1-node__placeholder"><IconPhoto size={24} /><span>生成后在这里选择候选画面</span></div>
          )}
        </NodeShell>
        <ChainLink />
        <NodeShell eyebrow="视频镜头" icon={<IconVideo size={17} />} state={event?.status === 'failed' ? '生成失败' : taskRunning ? '生成中' : output ? '已登记' : '等待'}>
          {taskRunning ? (
            <div className="cv1-node__progress"><span /><p>任务正在处理</p><small>任务创建后将在这里更新真实状态</small></div>
          ) : (
            <div className="cv1-node__video-copy"><strong>{output ? '输出已登记到项目资产' : '尚未生成视频'}</strong><small>{output ? '可在 Playlist 中安排顺序' : '先确认资产门禁和镜头参数'}</small></div>
          )}
        </NodeShell>
      </div>
    </motion.main>
  );
}
