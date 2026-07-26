import { Empty, Input, Space, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import type { Claim } from '../../domain/types';
import { claimTypeLabel } from './scriptHelpers';

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
  const [keyword, setKeyword] = useState('');

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return facts;
    return facts.filter(
      (fact) =>
        fact.id.toLowerCase().includes(q) ||
        fact.text.toLowerCase().includes(q) ||
        fact.type.toLowerCase().includes(q),
    );
  }, [facts, keyword]);

  return (
    <div className="script-panel-card">
      <div className="script-panel-title">
        <Typography.Text strong>事实库 C1—C8</Typography.Text>
        <Tag>{facts.length}</Tag>
      </div>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
        {focusedBlockLabel
          ? `点击事实，切换绑定到「${focusedBlockLabel}」`
          : '先选中中间脚本段落，再绑定事实'}
      </Typography.Paragraph>
      <Input.Search
        allowClear
        size="small"
        placeholder="搜索编号 / 文案"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        style={{ marginBottom: 10 }}
      />
      {filtered.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无匹配事实" />
      ) : (
        <div className="script-claim-list" data-testid="script-claim-list">
          {filtered.map((fact) => {
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
                <div className="script-claim-item-head">
                  <span className="script-claim-id">{fact.id}</span>
                  <Space size={4}>
                    <Tag>{claimTypeLabel(fact.type)}</Tag>
                    {active ? <Tag color="blue">已引用</Tag> : null}
                  </Space>
                </div>
                <div className="script-claim-text">{fact.text}</div>
                <div className="script-claim-text" style={{ marginTop: 4, color: '#8c8c8c' }}>
                  来源 {fact.source} · 置信 {Math.round(fact.confidence * 100)}%
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
