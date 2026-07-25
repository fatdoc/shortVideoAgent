import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Result } from 'antd';

interface Props {
  children: ReactNode;
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

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <Result
            status="error"
            title="应用发生异常"
            subTitle={this.state.message ?? '未知错误'}
            extra={
              <Button type="primary" onClick={() => window.location.assign('/dashboard')}>
                返回工作台
              </Button>
            }
          />
        </div>
      );
    }
    return this.props.children;
  }
}
