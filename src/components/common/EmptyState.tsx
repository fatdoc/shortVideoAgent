import { Button, Empty } from 'antd';

interface EmptyStateProps {
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  description = '暂无数据',
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="app-page-card" style={{ display: 'grid', placeItems: 'center', minHeight: 280 }}>
      <Empty description={description}>
        {actionLabel && onAction ? (
          <Button type="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </Empty>
    </div>
  );
}
