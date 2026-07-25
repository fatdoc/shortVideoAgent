import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="app-page-card">
      <Result
        status="404"
        title="页面不存在"
        subTitle="请检查路由，或从工作台重新进入统一 Demo 项目。"
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            返回工作台
          </Button>
        }
      />
    </div>
  );
}
