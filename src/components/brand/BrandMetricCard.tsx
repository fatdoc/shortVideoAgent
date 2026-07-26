import type { ReactNode } from 'react';
import { Typography } from 'antd';

interface BrandMetricCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  hint: string;
  tone?: 'blue' | 'purple' | 'green' | 'orange';
}

export function BrandMetricCard({
  icon,
  label,
  value,
  hint,
  tone = 'blue',
}: BrandMetricCardProps) {
  return (
    <div className={`brand-metric-card brand-metric-${tone}`}>
      <span className="brand-metric-icon">{icon}</span>
      <span className="brand-metric-copy">
        <Typography.Text type="secondary" className="brand-metric-label">
          {label}
        </Typography.Text>
        <Typography.Text strong className="brand-metric-value">
          {value}
        </Typography.Text>
        <Typography.Text type="secondary" className="brand-metric-hint">
          {hint}
        </Typography.Text>
      </span>
    </div>
  );
}
