import { CheckCircleFilled, ExclamationCircleFilled } from '@ant-design/icons';
import { Button, Typography } from 'antd';

interface BriefReadinessPanelProps {
  missing: string[];
  onFocusMissing: () => void;
}

export function BriefReadinessPanel({
  missing,
  onFocusMissing,
}: BriefReadinessPanelProps) {
  const ready = missing.length === 0;

  return (
    <div className={`brief-side-panel brief-readiness ${ready ? 'is-ready' : ''}`}>
      <div className="brief-side-title">
        <span>{ready ? <CheckCircleFilled /> : <ExclamationCircleFilled />}</span>
        <Typography.Text strong>缺失项检查</Typography.Text>
        <span className="brief-side-count">{missing.length}</span>
      </div>
      {ready ? (
        <Typography.Paragraph type="secondary">
          当前无缺失项。项目、渠道、受众、CTA 与素材均已具备，可继续生成脚本。
        </Typography.Paragraph>
      ) : (
        <ul className="brief-missing-list">
          {missing.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      <Button type="link" onClick={onFocusMissing}>
        {ready ? '复核关键信息' : '返回表单补齐'}
      </Button>
    </div>
  );
}
