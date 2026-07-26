import type { ReactNode } from 'react';
import { Typography } from 'antd';

interface ProjectMetricCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  hint: string;
  tone?: 'blue' | 'cyan' | 'green' | 'orange';
}

export function ProjectMetricCard({
  icon,
  label,
  value,
  hint,
  tone = 'blue',
}: ProjectMetricCardProps) {
  return (
    <div className="project-metric-card">
      <div className={`project-metric-icon project-metric-icon-${tone}`}>{icon}</div>
      <div>
        <Typography.Text type="secondary">{label}</Typography.Text>
        <div className="project-metric-value">{value}</div>
        <Typography.Text type="secondary" className="project-metric-hint">
          {hint}
        </Typography.Text>
      </div>
    </div>
  );
}
