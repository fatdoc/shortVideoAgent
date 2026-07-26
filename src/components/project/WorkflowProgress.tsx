import { CheckCircleFilled } from '@ant-design/icons';
import { Progress, Typography } from 'antd';

const steps = [
  { label: 'Brief', threshold: 20 },
  { label: '脚本', threshold: 48 },
  { label: '分镜', threshold: 60 },
  { label: '素材', threshold: 70 },
  { label: '初剪', threshold: 85 },
  { label: '审核', threshold: 92 },
  { label: '导出', threshold: 100 },
];

export function WorkflowProgress({ progress }: { progress: number }) {
  return (
    <div className="workflow-progress" data-testid="workflow-progress">
      <div className="project-section-heading">
        <div>
          <Typography.Title level={5}>生产流程</Typography.Title>
          <Typography.Text type="secondary">Brief、脚本到审核导出的当前推进位置</Typography.Text>
        </div>
        <Typography.Text strong>{progress}%</Typography.Text>
      </div>
      <Progress percent={progress} showInfo={false} strokeColor="#1677ff" />
      <div className="workflow-step-list">
        {steps.map((step, index) => {
          const complete = progress >= step.threshold;
          const active =
            !complete &&
            (index === 0 || progress >= steps[index - 1].threshold);
          return (
            <div
              className={`workflow-step ${complete ? 'is-complete' : ''} ${active ? 'is-active' : ''}`}
              key={step.label}
            >
              <span className="workflow-step-dot">
                {complete ? <CheckCircleFilled /> : index + 1}
              </span>
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
