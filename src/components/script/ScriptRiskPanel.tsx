import { Empty, Typography } from 'antd';
import { StatusTag } from '../common/StatusTag';
import type { ScriptRiskItem } from './scriptHelpers';

interface ScriptRiskPanelProps {
  items: ScriptRiskItem[];
  onFocusBlock?: (blockId: string) => void;
}

export function ScriptRiskPanel({ items, onFocusBlock }: ScriptRiskPanelProps) {
  const actionable = items.filter((item) => item.level !== 'none');
  const display = actionable.length > 0 ? actionable : items;

  return (
    <div className="script-panel-card" data-testid="script-risk-panel">
      <div className="script-panel-title">
        <Typography.Text strong>风险提示</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {actionable.length} 项
        </Typography.Text>
      </div>
      {display.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无风险" />
      ) : (
        <div className="script-risk-list">
          {display.map((item) => (
            <button
              key={item.id}
              type="button"
              className="script-risk-item"
              style={{
                cursor: item.blockId && onFocusBlock ? 'pointer' : 'default',
                width: '100%',
                textAlign: 'left',
              }}
              onClick={() => {
                if (item.blockId && onFocusBlock) onFocusBlock(item.blockId);
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <div className="script-risk-item-title">{item.title}</div>
                <StatusTag kind="risk" value={item.level} />
              </div>
              <div className="script-risk-item-detail">{item.detail}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
