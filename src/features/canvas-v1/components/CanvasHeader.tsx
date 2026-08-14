import { IconAlertTriangle, IconCloudCheck, IconCloudOff, IconRefresh } from '@tabler/icons-react';
import type { CanvasSaveState } from '../pages/CanvasV1Page';

interface CanvasHeaderProps {
  projectName: string;
  documentVersion: number | null;
  saveState: CanvasSaveState;
}

const saveLabels: Record<CanvasSaveState, string> = {
  saving: '正在保存',
  saved: '已保存',
  conflict: '画布版本已更新',
  offline: '连接已断开',
};

const acquisitionStages = [
  '门店建档',
  '商品套餐',
  '门店资产',
  '获客任务',
  'AI 探店脚本',
  '探店分镜',
  '剪辑成片',
  '发布投放',
  '线索转化',
] as const;

export function CanvasHeader({ projectName, documentVersion, saveState }: CanvasHeaderProps) {
  const Icon = saveState === 'conflict' ? IconAlertTriangle : saveState === 'offline' ? IconCloudOff : saveState === 'saving' ? IconRefresh : IconCloudCheck;

  return (
    <header className="cv1-header">
      <div className="cv1-header__topline">
        <div className="cv1-header__identity">
          <span className="cv1-header__mark" aria-hidden="true">VA</span>
          <div>
            <strong>{projectName}</strong>
            <span>门店短视频获客生产台</span>
          </div>
        </div>
        <div className={`cv1-save cv1-save--${saveState}`} role="status">
          <Icon size={15} aria-hidden="true" />
          <span>{saveLabels[saveState]}</span>
          {documentVersion ? <small>v{documentVersion}</small> : null}
        </div>
      </div>
      <ol className="cv1-header__lifecycle" aria-label="门店短视频获客业务链">
        {acquisitionStages.map((stage) => (
          <li key={stage} className={stage === '剪辑成片' ? 'is-current' : undefined}>{stage}</li>
        ))}
      </ol>
    </header>
  );
}
