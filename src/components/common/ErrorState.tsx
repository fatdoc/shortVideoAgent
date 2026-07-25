import { Button, Result, Space } from 'antd';

interface ErrorStateProps {
  title?: string;
  subTitle?: string;
  onRetry?: () => void;
  retryLabel?: string;
  retryLoading?: boolean;
}

export function ErrorState({
  title = '加载失败',
  subTitle = '请稍后重试，或检查本地 Mock 数据是否完整。',
  onRetry,
  retryLabel = '重试',
  retryLoading = false,
}: ErrorStateProps) {
  return (
    <div className="app-page-card">
      <Result
        status="warning"
        title={title}
        subTitle={subTitle}
        extra={
          onRetry ? (
            <Space>
              <Button type="primary" loading={retryLoading} onClick={onRetry}>
                {retryLabel}
              </Button>
            </Space>
          ) : null
        }
      />
    </div>
  );
}
