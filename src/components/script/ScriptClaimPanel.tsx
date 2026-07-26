import { Button, Tag, Typography } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import { useState } from 'react';
import type { Claim } from '../../domain/types';

interface ScriptClaimPanelProps {
  facts: Claim[];
  activeClaimIds: string[];
  focusedBlockLabel?: string;
  disabled?: boolean;
  onToggleClaim: (claimId: string) => void;
}

export function ScriptClaimPanel({
  facts,
  activeClaimIds,
  focusedBlockLabel,
  disabled = false,
  onToggleClaim,
}: ScriptClaimPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleFacts = expanded ? facts : facts.slice(0, 5);

  return (
    <div className="script-panel-card">
      <div className="script-panel-title">
        <Typography.Text strong>事实引用</Typography.Text>
        <Typography.Text type="secondary" className="script-panel-count">
          共 {facts.length} 条
        </Typography.Text>
      </div>
      <div
        className="script-claim-list"
        data-testid="script-claim-list"
        aria-label={focusedBlockLabel}
      >
          {visibleFacts.map((fact) => {
            const active = activeClaimIds.includes(fact.id);
            return (
              <button
                key={fact.id}
                type="button"
                className={`script-claim-item${active ? ' is-active' : ''}${
                  disabled ? ' is-disabled' : ''
                }`}
                disabled={disabled}
                onClick={() => onToggleClaim(fact.id)}
                data-testid={`script-claim-${fact.id}`}
              >
                <span className="script-claim-id">{fact.id}</span>
                <span className="script-claim-text">{fact.text}</span>
                <Tag color={active ? 'blue' : 'default'}>{fact.source}</Tag>
              </button>
            );
          })}
      </div>
      <Button
        type="link"
        size="small"
        className="script-claim-more"
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? '收起引用' : `查看全部引用（${facts.length}）`} <RightOutlined />
      </Button>
    </div>
  );
}
