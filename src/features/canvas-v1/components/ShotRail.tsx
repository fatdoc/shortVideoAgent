import { IconCircleCheck, IconCircleDashed, IconCircleX, IconLoader2 } from '@tabler/icons-react';
import type { CanvasEventV01 } from '../model/contracts';
import type { CanvasShotView } from '../pages/CanvasV1Page';
import { controlledMediaSrc } from './controlledMedia';

interface ShotRailProps {
  shots: CanvasShotView[];
  activeShotId: string | null;
  taskEvents: Record<string, CanvasEventV01 | undefined>;
  onSelect: (shotId: string) => void;
}

function ShotStateIcon({ shot, event }: { shot: CanvasShotView; event?: CanvasEventV01 }) {
  if (event?.status === 'failed') return <IconCircleX size={16} aria-label="生成失败" />;
  if (event && ['accepted', 'provider_submitted', 'task_created'].includes(event.status)) {
    return <IconLoader2 className="cv1-spin" size={16} aria-label="生成中" />;
  }
  if (shot.outputs.length > 0 || event?.outputRegistered) return <IconCircleCheck size={16} aria-label="已生成" />;
  return <IconCircleDashed size={16} aria-label={shot.readiness.ready ? '可生成' : '未就绪'} />;
}

export function ShotRail({ shots, activeShotId, taskEvents, onSelect }: ShotRailProps) {
  return (
    <nav className="cv1-shot-rail" aria-label="分镜列表">
      <div className="cv1-section-heading">
        <div><span>镜头序列</span><small>{shots.length} 个 · 点击切换</small></div>
      </div>
      <ol>
        {shots.map((shot) => {
          const thumbnailSrc = controlledMediaSrc(shot.thumbnailUrl);
          return <li key={shot.shotId}>
            <button
              type="button"
              className={shot.shotId === activeShotId ? 'is-active' : ''}
              aria-current={shot.shotId === activeShotId ? 'true' : undefined}
              onClick={() => onSelect(shot.shotId)}
            >
              <span className="cv1-shot-rail__number">{String(shot.sequence).padStart(2, '0')}</span>
              <span className="cv1-shot-rail__media">
                {thumbnailSrc ? <img src={thumbnailSrc} alt="" /> : <span aria-hidden="true" />}
              </span>
              <span className="cv1-shot-rail__copy">
                <strong>{shot.title}</strong>
                <small>{shot.durationSeconds} 秒 · {shot.readiness.ready ? '资产就绪' : '等待资产'}</small>
              </span>
              <span className="cv1-shot-rail__state"><ShotStateIcon shot={shot} event={taskEvents[shot.shotId]} /></span>
            </button>
          </li>;
        })}
      </ol>
    </nav>
  );
}
