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

export function CanvasHeader({ projectName, documentVersion, saveState }: CanvasHeaderProps) {
  const Icon = saveState === 'conflict' ? IconAlertTriangle : saveState === 'offline' ? IconCloudOff : saveState === 'saving' ? IconRefresh : IconCloudCheck;

  return (
    <header className="cv1-header">
      <div className="cv1-header__identity">
        <span className="cv1-header__mark" aria-hidden="true">VA</span>
        <div>
          <strong>{projectName}</strong>
          <span>探店视频 · Canvas V1</span>
        </div>
      </div>
      <div className={`cv1-save cv1-save--${saveState}`} role="status">
        <Icon size={15} aria-hidden="true" />
        <span>{saveLabels[saveState]}</span>
        {documentVersion ? <small>v{documentVersion}</small> : null}
      </div>
    </header>
  );
}
