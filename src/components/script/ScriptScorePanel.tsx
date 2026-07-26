import { Progress, Typography } from 'antd';
import type { SayabilityBreakdown } from './scriptHelpers';

interface ScriptScorePanelProps {
  score: number;
  breakdown: SayabilityBreakdown;
  versionName: string;
}

const METRICS: Array<{ key: keyof SayabilityBreakdown; label: string }> = [
  { key: 'structure', label: '结构完整' },
  { key: 'citation', label: '事实引用' },
  { key: 'risk', label: '合规风险' },
  { key: 'durationFit', label: '时长匹配' },
  { key: 'disclaimer', label: '声明完备' },
];

function scoreColor(value: number): string {
  if (value >= 85) return '#52C41A';
  if (value >= 70) return '#1677FF';
  if (value >= 55) return '#FA8C16';
  return '#FF4D4F';
}

export function ScriptScorePanel({ score, breakdown, versionName }: ScriptScorePanelProps) {
  return (
    <div className="script-panel-card" data-testid="script-score-panel">
      <div className="script-panel-title">
        <Typography.Text strong>可说性评分</Typography.Text>
      </div>
      <div className="script-score-body" aria-label={`${versionName} 可说性 ${score}`}>
        <Progress
          type="circle"
          percent={score}
          size={104}
          strokeColor={{ '0%': '#1677ff', '100%': '#20c77a' }}
          format={(percent) => (
            <div className="script-score-value">
              <small>综合评分</small>
              <strong>{percent}</strong>
              <em>{Number(percent) >= 85 ? '优秀' : Number(percent) >= 70 ? '良好' : '一般'}</em>
            </div>
          )}
        />
        <div className="script-score-metrics">
          {METRICS.map((item) => {
            const value = breakdown[item.key];
            return (
              <div key={item.key} className="script-score-metric-row">
                <span>{item.label}</span>
                <Progress
                  percent={value}
                  size="small"
                  showInfo={false}
                  strokeColor={scoreColor(value)}
                />
                <span>{value}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
