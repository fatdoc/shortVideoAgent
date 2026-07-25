import { Button, Empty } from 'antd';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  description?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
  minHeight?: number;
}

export function EmptyState({
  description = '暂无数据',
  actionLabel,
  onAction,
  loading = false,
  minHeight = 280,
}: EmptyStateProps) {
  return (
    <div
      className="app-page-card"
      style={{ display: 'grid', placeItems: 'center', minHeight }}
    >
      <Empty description={description}>
        {actionLabel && onAction ? (
          <Button type="primary" loading={loading} onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </Empty>
    </div>
  );
}
