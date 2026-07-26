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
  const color = scoreColor(score);
  return (
    <div className="script-panel-card" data-testid="script-score-panel">
      <div className="script-panel-title">
        <Typography.Text strong>可说性评分</Typography.Text>
      </div>
      <div className="script-score-ring">
        <Progress
          type="dashboard"
          percent={score}
          size={108}
          strokeColor={color}
          format={(percent) => (
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color }}>{percent}</div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>分</div>
            </div>
          )}
        />
        <div>
          <Typography.Text strong style={{ display: 'block' }}>
            {versionName}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            综合结构、引用、风险、时长与 Disclaimer
          </Typography.Text>
        </div>
      </div>
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
              <span style={{ textAlign: 'right', fontWeight: 600 }}>{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
