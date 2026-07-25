import { Button, Result } from 'antd';

interface ErrorStateProps {
  title?: string;
  subTitle?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = '加载失败',
  subTitle = '请稍后重试，或检查本地 Mock 数据是否完整。',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="app-page-card">
      <Result
        status="warning"
        title={title}
        subTitle={subTitle}
        extra={
          onRetry ? (
            <Button type="primary" onClick={onRetry}>
              重试
            </Button>
          ) : null
        }
      />
    </div>
  );
}
