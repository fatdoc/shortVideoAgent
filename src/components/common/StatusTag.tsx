import { Tag } from 'antd';
import { MATCH_STATUS_LABEL, PROJECT_STATUS_LABEL, RISK_LEVEL_LABEL } from '../../domain/constants';
import { statusColors } from '../../design/tokens';

type StatusKind = 'project' | 'match' | 'risk' | 'qa';

interface StatusTagProps {
  kind: StatusKind;
  value: string;
}

const qaLabel: Record<string, string> = {
  pass: '通过',
  warn: '警告',
  fail: '失败',
  pending: '待处理',
};

function resolve(kind: StatusKind, value: string): { label: string; color?: string } {
  if (kind === 'project') {
    return { label: PROJECT_STATUS_LABEL[value] ?? value, color: statusColors[value as keyof typeof statusColors] };
  }
  if (kind === 'match') {
    return { label: MATCH_STATUS_LABEL[value] ?? value, color: statusColors[value as keyof typeof statusColors] };
  }
  if (kind === 'risk') {
    const map: Record<string, string> = {
      none: 'default',
      low: 'blue',
      medium: 'orange',
      high: 'red',
    };
    return { label: RISK_LEVEL_LABEL[value] ?? value, color: map[value] };
  }
  return {
    label: qaLabel[value] ?? value,
    color: statusColors[value as keyof typeof statusColors],
  };
}

export function StatusTag({ kind, value }: StatusTagProps) {
  const { label, color } = resolve(kind, value);
  if (color && color.startsWith('#')) {
    return (
      <Tag
        style={{
          color: '#fff',
          background: color,
          borderColor: color,
        }}
      >
        {label}
      </Tag>
    );
  }
  return <Tag color={color}>{label}</Tag>;
}
