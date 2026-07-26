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
    <div className="brand-metric-card">
      <span className={`brand-metric-icon brand-metric-${tone}`}>{icon}</span>
      <span className="brand-metric-copy">
        <Typography.Text type="secondary">{label}</Typography.Text>
        <strong>{value}</strong>
        <Typography.Text type="secondary">{hint}</Typography.Text>
      </span>
    </div>
  );
}
