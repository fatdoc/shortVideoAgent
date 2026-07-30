import { Tag, Tooltip } from 'antd';
import type { CapabilityTruthMode } from '../../domain/controlPlane';
import { useControlPlaneStore } from '../../stores/controlPlaneStore';

const modeColor: Record<CapabilityTruthMode, string> = {
  'REAL-UI': 'blue',
  'REAL-CAP': 'green',
  'MOCK-CONTRACT': 'purple',
  HYBRID: 'cyan',
  LOCKED: 'default',
  FALLBACK: 'orange',
};

interface TruthBadgeProps {
  capabilityId: string;
  compact?: boolean;
}

export function TruthBadge({ capabilityId, compact = false }: TruthBadgeProps) {
  const entry = useControlPlaneStore((state) =>
    state.snapshot.truthManifest.entries.find(
      (item) => item.capabilityId === capabilityId,
    ),
  );

  if (!entry) return null;

  const detail = [
    `UI: ${entry.ui}`,
    `执行: ${entry.execution}`,
    `传输: ${entry.transport}`,
    `项目接入: ${entry.projectIntegrated ? '是' : '否'}`,
    ...entry.knownLimitations,
  ].join('\n');

  return (
    <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{detail}</span>}>
      <Tag color={modeColor[entry.mode]} className="d1-truth-badge">
        {compact ? entry.mode : `${entry.mode} · ${entry.displayName}`}
      </Tag>
    </Tooltip>
  );
}

