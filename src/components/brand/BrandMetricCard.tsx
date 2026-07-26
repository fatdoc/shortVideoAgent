import type { ReactNode } from 'react';
import { Typography } from 'antd';

interface BrandMetricCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  hint: string;
  tone?: 'blue' | 'purple' | 'green' | 'orange';
  valueStyle?: 'default' | 'status';
}

export function BrandMetricCard({
  icon,
  label,
  value,
  hint,
  tone = 'blue',
  valueStyle = 'default',
}: BrandMetricCardProps) {
  const compactValue = typeof value === 'string' && value.length > 8;

  return (
    <div className={`brand-metric-card brand-metric-${tone}`}>
      <span className="brand-metric-icon">{icon}</span>
      <span className="brand-metric-copy">
        <Typography.Text type="secondary" className="brand-metric-label">
          {label}
        </Typography.Text>
        <Typography.Text
          strong
          className={`brand-metric-value brand-metric-value-${valueStyle} ${
            compactValue ? 'brand-metric-value-compact' : ''
          }`}
        >
          {value}
        </Typography.Text>
        <Typography.Text type="secondary" className="brand-metric-hint">
          {hint}
        </Typography.Text>
      </span>
    </div>
  );
}
