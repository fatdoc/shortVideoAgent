import { Button, Switch, Tag, Typography } from 'antd';
import { CheckCircleFilled, PlusOutlined } from '@ant-design/icons';
import type { ScriptVersion } from '../../domain/types';
import { VERSION_ACCENT } from './scriptHelpers';

interface ScriptVersionTabsProps {
  scripts: ScriptVersion[];
  activeScriptId: string;
  loading?: boolean;
  onChange: (scriptId: string) => void;
}

const VERSION_TRAITS: Record<string, string[]> = {
  'script-a': ['情绪吸引强', '信息完整', '转化引导好'],
  'script-b': ['亮点突出', '节奏紧凑', 'CTA 稍弱'],
  'script-c': ['信息完整', '钩子较弱', '互动性一般'],
};

function countCharacters(script: ScriptVersion): number {
  return script.blocks.reduce((sum, block) => sum + block.content.length, 0);
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
        <Typography.Text strong>脚本版本</Typography.Text>
        <span className="script-quick-compare">快速对比 <Switch size="small" /></span>
      </div>
      <div className="script-version-list" role="listbox" aria-label="脚本版本列表">
        {scripts.map((script) => {
          const active = script.id === activeScriptId;
          const accent = VERSION_ACCENT[script.id] ?? '#1677FF';
          const letter = script.id.slice(-1).toUpperCase();
          const traits = VERSION_TRAITS[script.id] ?? [];
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
                <span className="script-version-identity">
                  <span className="script-version-letter">{letter}</span>
                  {active ? <Tag color="blue">当前版本</Tag> : null}
                </span>
                {active ? (
                  <CheckCircleFilled style={{ color: accent }} />
                ) : (
                  <span className="script-version-radio" />
                )}
              </div>
              <div className="script-version-score">
                <span>综合评分</span>
                <strong>{script.score}<small>分</small></strong>
                <Tag color={script.score >= 85 ? 'success' : script.score >= 80 ? 'warning' : 'default'}>
                  {script.score >= 85 ? '优秀' : script.score >= 80 ? '良好' : '一般'}
                </Tag>
              </div>
              <div className="script-version-traits">
                {traits.map((trait) => <Tag key={trait}>{trait}</Tag>)}
              </div>
              <div className="script-version-meta">
                字数：{countCharacters(script)}字 · 预计时长：00:{String(script.estimatedDuration).padStart(2, '0')}
              </div>
            </button>
          );
        })}
      </div>
      <Button block size="small" icon={<PlusOutlined />} className="script-new-version">
        新建版本
      </Button>
    </div>
  );
}
