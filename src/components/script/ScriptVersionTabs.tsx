import { Progress, Space, Tag, Typography } from 'antd';
import type { ScriptVersion } from '../../domain/types';
import { VERSION_ACCENT } from './scriptHelpers';

interface ScriptVersionTabsProps {
  scripts: ScriptVersion[];
  activeScriptId: string;
  loading?: boolean;
  onChange: (scriptId: string) => void;
}

export function ScriptVersionTabs({
  scripts,
  activeScriptId,
  loading = false,
  onChange,
}: ScriptVersionTabsProps) {
  return (
    <div className="script-panel-card">
      <div className="script-panel-title">
        <Typography.Text strong>脚本版本 A / B / C</Typography.Text>
        <Tag color="default">{scripts.length} 版</Tag>
      </div>
      <div className="script-version-list" role="listbox" aria-label="脚本版本列表">
        {scripts.map((script) => {
          const active = script.id === activeScriptId;
          const accent = VERSION_ACCENT[script.id] ?? '#1677FF';
          return (
            <button
              key={script.id}
              type="button"
              className={`script-version-item${active ? ' is-active' : ''}`}
              aria-selected={active}
              disabled={loading}
              style={active ? { borderLeftColor: accent } : undefined}
              onClick={() => {
                if (!active) onChange(script.id);
              }}
              data-testid={`script-version-${script.id}`}
            >
              <div className="script-version-item-head">
                <span className="script-version-name" style={{ color: active ? accent : undefined }}>
                  {script.name}
                </span>
                <Tag color={active ? 'processing' : 'default'}>{script.score} 分</Tag>
              </div>
              <div className="script-version-meta">
                预估 {script.estimatedDuration}s · 引用 {script.citations.length} 条
              </div>
              <Progress
                percent={script.score}
                size="small"
                showInfo={false}
                strokeColor={accent}
                style={{ marginTop: 8, marginBottom: 0 }}
              />
              <Space size={4} className="script-version-citations" wrap>
                {script.citations.length > 0 ? (
                  script.citations.map((id) => (
                    <Tag key={id} color={active ? 'blue' : 'default'}>
                      {id}
                    </Tag>
                  ))
                ) : (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    暂无事实引用
                  </Typography.Text>
                )}
              </Space>
              {active ? <Tag color="blue">当前编辑</Tag> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
