import { Card, Spin, Typography } from 'antd';

interface LoadingStateProps {
  tip?: string;
}

export function LoadingState({ tip = '加载中...' }: LoadingStateProps) {
  return (
    <Card className="app-page-card" styles={{ body: { minHeight: 240, display: 'grid', placeItems: 'center' } }}>
      <Spin size="large" tip={tip}>
        <div style={{ width: 120, height: 80 }} />
      </Spin>
      <Typography.Paragraph type="secondary" style={{ marginTop: 16, textAlign: 'center' }}>
        {tip}
      </Typography.Paragraph>
    </Card>
  );
}
