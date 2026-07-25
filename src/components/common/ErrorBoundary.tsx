import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Result, Typography } from 'antd';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught', error, info);
  }

  private handleReset = () => {
    this.setState({ hasError: false, message: undefined });
    window.location.assign('/dashboard');
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <Result
            status="error"
            title={this.props.fallbackTitle ?? '应用发生异常'}
            subTitle={this.state.message ?? '未知错误'}
            extra={
              <Button type="primary" onClick={this.handleReset}>
                返回工作台
              </Button>
            }
          >
            <Typography.Paragraph type="secondary" style={{ textAlign: 'center' }}>
              若问题持续出现，可点击顶部「重置 Demo」恢复统一数据。
            </Typography.Paragraph>
          </Result>
        </div>
      );
    }
    return this.props.children;
  }
}
