import { Button, Result, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { DEMO_PROJECT_ID, ROUTES } from '../domain/constants';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="app-page-card">
      <Result
        status="404"
        title="页面不存在"
        subTitle="请检查路由，或从工作台重新进入统一 Demo 项目。"
        extra={
          <Space wrap>
            <Button type="primary" onClick={() => navigate(ROUTES.dashboard)}>
              返回工作台
            </Button>
            <Button onClick={() => navigate(ROUTES.script(DEMO_PROJECT_ID))}>进入 Demo 脚本</Button>
          </Space>
        }
      />
    </div>
  );
}
