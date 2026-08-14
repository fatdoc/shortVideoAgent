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

const modeLabel: Record<CapabilityTruthMode, string> = {
  'REAL-UI': '真实界面',
  'REAL-CAP': '真实能力',
  'MOCK-CONTRACT': '演示合同',
  HYBRID: '混合接入',
  LOCKED: '未开放',
  FALLBACK: '降级态',
};

const truthValueLabel: Record<string, string> = {
  MOCK: '演示执行',
  'MOCK-CONTRACT': '演示合同',
  'REAL-UI': '真实界面',
  'REAL-CAP': '真实能力',
  HYBRID: '混合接入',
  LOCKED: '未开放',
  FALLBACK: '降级态',
  NOT_APPLICABLE: '不适用',
};

function safeTruthText(value: string): string {
  return value
    .replace(/\bMOCK-CONTRACT\b/g, '演示合同')
    .replace(/\bMOCK\b/g, '演示执行')
    .replace(/\bMock\b/gi, '演示数据');
}

function displayTruthValue(value: string): string {
  return truthValueLabel[value] ?? safeTruthText(value);
}

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
    `界面: ${displayTruthValue(entry.ui)}`,
    `执行: ${displayTruthValue(entry.execution)}`,
    `传输: ${displayTruthValue(entry.transport)}`,
    `项目接入: ${entry.projectIntegrated ? '是' : '否'}`,
    ...entry.knownLimitations.map(safeTruthText),
  ].join('\n');

  return (
    <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{detail}</span>}>
      <Tag color={modeColor[entry.mode]} className="d1-truth-badge">
        {compact ? modeLabel[entry.mode] : `${modeLabel[entry.mode]} · ${entry.displayName}`}
      </Tag>
    </Tooltip>
  );
}
