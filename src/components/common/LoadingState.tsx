import { Card, Spin, Typography } from 'antd';

interface LoadingStateProps {
  tip?: string;
  minHeight?: number;
  bordered?: boolean;
}

export function LoadingState({
  tip = '加载中...',
  minHeight = 240,
  bordered = true,
}: LoadingStateProps) {
  const body = (
    <div
      style={{
        minHeight,
        display: 'grid',
        placeItems: 'center',
        width: '100%',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <Spin size="large" />
        <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>
          {tip}
        </Typography.Paragraph>
      </div>
    </div>
  );

  if (!bordered) return body;

  return (
    <Card className="app-page-card" styles={{ body: { padding: 24 } }}>
      {body}
    </Card>
  );
}
