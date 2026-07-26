import {
  Alert,
  App,
  Button,
  Tag,
  Typography,
} from 'antd';
import {
  CheckCircleFilled,
  EllipsisOutlined,
  LeftOutlined,
  MessageOutlined,
  ReloadOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  UnorderedListOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import {
  ScriptBlockEditor,
  ScriptClaimPanel,
  ScriptRiskPanel,
  ScriptScorePanel,
  ScriptVersionTabs,
  addBlockComment,
  applyScoreToScript,
  BLOCK_TYPE_LABEL,
  buildRiskItems,
  cloneScript,
  computeSayability,
  formatShortTime,
  mockGenerateScript,
  sortBlocks,
  toggleClaimOnBlock,
  updateBlockContent,
  updateBlockDuration,
} from '../../components/script';
import '../../components/script/script-editor.css';
import { DEMO_PROJECT_ID, ROUTES } from '../../domain/constants';
import { getActiveScript, isDemoProject } from '../../domain/selectors';
import type { ScriptVersion } from '../../domain/types';
import { useProjectStore } from '../../stores/projectStore';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const BRAND_RULES = [
  '禁止与其他火锅品牌直接对比',
  '不得夸大或虚假承诺服务效果',
  '需体现服务特色与顾客体验',
];

export function ScriptEditorPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { projectId } = useParams();
  const workspace = useProjectStore((s) => s.workspace);
  const loading = useProjectStore((s) => s.loading);
  const error = useProjectStore((s) => s.error);
  const hydrated = useProjectStore((s) => s.hydrated);
  const lastAction = useProjectStore((s) => s.lastAction);
  const hydrate = useProjectStore((s) => s.hydrate);
  const setActiveScript = useProjectStore((s) => s.setActiveScript);
  const updateScript = useProjectStore((s) => s.updateScript);
  const clearError = useProjectStore((s) => s.clearError);

  const [draft, setDraft] = useState<ScriptVersion | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const activeFromStore = useMemo(() => getActiveScript(workspace), [workspace]);
  const prohibitedWords = workspace.brand.prohibitedWords;
  const facts = workspace.brand.facts;
  const brief = workspace.brief;
  const validProject = isDemoProject(projectId) || projectId === DEMO_PROJECT_ID;

  // 同步 store 当前脚本到本地草稿（切换版本 / hydrate / 外部重置）
  useEffect(() => {
    if (!activeFromStore) {
      setDraft(null);
      setFocusedBlockId(null);
      setDirty(false);
      return;
    }
    const forceResync = lastAction === 'hydrate' || lastAction === 'reset';
    if (!forceResync && dirty && draft && draft.id === activeFromStore.id) {
      return;
    }
    const next = cloneScript(activeFromStore);
    setDraft(next);
    setFocusedBlockId((prev) => {
      if (prev && next.blocks.some((b) => b.id === prev)) return prev;
      return next.blocks[0]?.id ?? null;
    });
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only resync when store script identity/content stamp changes
  }, [activeFromStore, workspace.activeScriptId, hydrated, lastAction]);

  const focusedBlock = useMemo(
    () => draft?.blocks.find((b) => b.id === focusedBlockId) ?? draft?.blocks[0],
    [draft, focusedBlockId],
  );

  const sayability = useMemo(() => {
    if (!draft) {
      return {
        overall: 0,
        structure: 0,
        citation: 0,
        risk: 0,
        durationFit: 0,
        disclaimer: 0,
      };
    }
    return computeSayability(draft, facts, prohibitedWords, brief.duration || 30);
  }, [draft, facts, prohibitedWords, brief.duration]);

  const riskItems = useMemo(() => {
    if (!draft) return [];
    return buildRiskItems(draft, prohibitedWords, facts);
  }, [draft, prohibitedWords, facts]);

  const sortedBlocks = useMemo(
    () => (draft ? sortBlocks(draft.blocks) : []),
    [draft],
  );

  const patchDraft = useCallback((updater: (current: ScriptVersion) => ScriptVersion) => {
    setDraft((current) => {
      if (!current) return current;
      return updater(current);
    });
    setDirty(true);
    setLocalError(null);
  }, []);

  const handleSwitchVersion = async (scriptId: string) => {
    if (scriptId === workspace.activeScriptId && draft?.id === scriptId) return;
    if (dirty) {
      const ok = window.confirm('当前版本有未保存修改，切换将丢弃本地草稿，是否继续？');
      if (!ok) return;
    }
    setSwitching(true);
    setLocalError(null);
    try {
      setDirty(false);
      await setActiveScript(scriptId);
      message.success('已切换脚本版本');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '切换版本失败';
      setLocalError(msg);
      message.error(msg);
    } finally {
      setSwitching(false);
    }
  };

  const handleSave = async (): Promise<boolean> => {
    if (!draft) return false;
    setSaving(true);
    setLocalError(null);
    try {
      const scored = applyScoreToScript(draft, sayability);
      await updateScript(scored);
      setDraft(cloneScript(scored));
      setDirty(false);
      message.success('脚本已保存到工作区');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败';
      setLocalError(msg);
      message.error(msg);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!draft) return;
    setGenerating(true);
    setLocalError(null);
    try {
      await delay(900);
      const generated = mockGenerateScript(
        draft,
        facts,
        brief.cta,
        prohibitedWords,
        'refresh',
      );
      const scored = applyScoreToScript(
        generated,
        computeSayability(generated, facts, prohibitedWords, brief.duration || 30),
      );
      setDraft(scored);
      setDirty(true);
      setFocusedBlockId(scored.blocks[0]?.id ?? null);
      message.success('已 Mock 重新生成当前版本（未自动保存）');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成失败';
      setLocalError(msg);
      message.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleResetDraft = () => {
    if (!activeFromStore) return;
    setDraft(cloneScript(activeFromStore));
    setDirty(false);
    setFocusedBlockId(activeFromStore.blocks[0]?.id ?? null);
    message.info('已从工作区恢复当前版本');
  };

  const handleEnterStoryboard = async () => {
    if (!draft) return;
    if (dirty) {
      const saved = await handleSave();
      if (!saved) return;
    }
    navigate(ROUTES.storyboard(DEMO_PROJECT_ID));
  };

  const handleQuickAdjust = (mode: 'spoken' | 'concise') => {
    if (!draft) return;
    setDirty(true);
    message.success(mode === 'spoken' ? '已应用更口语化建议（Mock）' : '已应用精简建议（Mock）');
  };

  const projectMeta = [
    ['项目', '海底捞探店系列'],
    ['场景', '到店探店'],
    ['受众', '18-35 岁 本地人群'],
    ['时长', `15-${brief.duration}s`],
    ['脚本语言', '中文'],
    ['更新时间', draft ? formatShortTime(draft.createdAt) : '--'],
  ];
  const totalCharacters = draft?.blocks.reduce((sum, block) => sum + block.content.length, 0) ?? 0;

  const busy = loading || generating || saving || switching;

  if (!hydrated && loading) {
    return <LoadingState tip="正在加载脚本工作区..." />;
  }

  if (error && !workspace.project.id) {
    return (
      <ErrorState
        title="脚本编辑器不可用"
        subTitle={error}
        onRetry={() => void hydrate()}
        retryLoading={loading}
      />
    );
  }

  if (projectId && !validProject) {
    return (
      <ErrorState
        title="项目不存在"
        subTitle={`仅支持统一 Demo 项目 ${DEMO_PROJECT_ID}，当前为 ${projectId}`}
        onRetry={() => navigate(ROUTES.script(DEMO_PROJECT_ID))}
        retryLabel="打开 Demo 脚本"
      />
    );
  }

  if (!draft || workspace.scripts.length === 0) {
    return (
      <EmptyState
        description="暂无脚本版本，请先完成 Brief / 品牌大脑，或重置 Demo"
        actionLabel="重新加载工作区"
        onAction={() => void hydrate()}
        loading={loading}
      />
    );
  }

  return (
    <div className="script-editor-page" data-testid="script-editor-page">
      <header className="script-project-header">
        <Button
          type="link"
          size="small"
          icon={<LeftOutlined />}
          className="script-project-back"
          onClick={() => navigate('/dashboard')}
        >
          返回脚本列表
        </Button>
        <div className="script-project-main">
          <div className="script-project-summary">
            <div className="script-project-title-line">
              <Typography.Title level={3}>海底捞火锅 · 北京三里屯店探店脚本</Typography.Title>
              <Tag>本地项目</Tag>
              {dirty ? <Tag color="orange">未保存</Tag> : <Tag color="success">已同步</Tag>}
            </div>
            <div className="script-project-meta">
              {projectMeta.map(([label, value]) => (
                <span key={label}>
                  <b>{label}：</b>{value}
                </span>
              ))}
            </div>
            <span className="script-sr-only">CTA：{brief.cta}</span>
          </div>
          <div className="script-project-actions">
            <Button
              size="small"
              icon={<ThunderboltOutlined />}
              loading={generating}
              disabled={busy && !generating}
              onClick={() => void handleGenerate()}
              data-testid="script-generate-btn"
            >
              重新生成
            </Button>
            <Button size="small" icon={<MessageOutlined />} disabled={busy} onClick={() => handleQuickAdjust('spoken')}>
              更口语化
            </Button>
            <Button size="small" icon={<UnorderedListOutlined />} disabled={busy} onClick={() => handleQuickAdjust('concise')}>
              精简
            </Button>
            <Button
              size="small"
              icon={<VideoCameraOutlined />}
              loading={saving}
              disabled={busy}
              onClick={() => void handleEnterStoryboard()}
              data-testid="script-to-storyboard-btn"
            >
              生成分镜
            </Button>
            <Button
              size="small"
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              disabled={busy}
              onClick={() => void handleSave()}
              data-testid="script-save-btn"
            >
              保存版本
            </Button>
            <Button
              size="small"
              icon={dirty ? <ReloadOutlined /> : <EllipsisOutlined />}
              disabled={busy}
              aria-label="还原草稿"
              title="还原草稿"
              onClick={handleResetDraft}
            />
          </div>
        </div>
      </header>

      {error || localError ? (
        <Alert
          type="warning"
          showIcon
          closable
          onClose={() => {
            clearError();
            setLocalError(null);
          }}
          message="最近一次操作异常"
          description={localError || error}
          action={
            <Button size="small" onClick={() => void hydrate()} loading={loading}>
              重新加载
            </Button>
          }
        />
      ) : null}

      <div className="script-editor-layout">
        <aside className="script-editor-left">
          <ScriptVersionTabs
            scripts={workspace.scripts}
            activeScriptId={workspace.activeScriptId}
            loading={busy}
            onChange={(id) => void handleSwitchVersion(id)}
          />
        </aside>

        <section className="script-editor-center">
          <div className="script-document-tabs">
            <button type="button" className="is-active">脚本编辑</button>
            <button type="button" onClick={() => message.info('版本历史为演示视图')}>
              版本历史 <span>8</span>
            </button>
          </div>
          {generating ? (
            <LoadingState tip="正在 Mock 生成脚本版本..." minHeight={320} bordered={false} />
          ) : (
            <div className="script-block-list">
              {sortedBlocks.map((block) => (
                <ScriptBlockEditor
                  key={block.id}
                  block={block}
                  facts={facts}
                  prohibitedWords={prohibitedWords}
                  focused={block.id === (focusedBlock?.id ?? '')}
                  disabled={busy}
                  onFocus={() => setFocusedBlockId(block.id)}
                  onContentChange={(content) =>
                    patchDraft((current) =>
                      updateBlockContent(current, block.id, content, prohibitedWords),
                    )
                  }
                  onDurationChange={(duration) =>
                    patchDraft((current) =>
                      updateBlockDuration(current, block.id, duration, prohibitedWords),
                    )
                  }
                  onToggleClaim={(claimId) =>
                    patchDraft((current) =>
                      toggleClaimOnBlock(current, block.id, claimId, prohibitedWords),
                    )
                  }
                  onAddComment={(content) =>
                    patchDraft((current) =>
                      addBlockComment(current, block.id, content, workspace.project.owner),
                    )
                  }
                />
              ))}
            </div>
          )}
          <div className="script-document-footer">
            <Button type="text" size="small" onClick={() => message.info('已添加空白区块（Mock）')}>
              + 添加区块
            </Button>
            <span>总时长预估：{draft.estimatedDuration}s · 字数：{totalCharacters}</span>
          </div>
        </section>

        <aside className="script-editor-right">
          <ScriptClaimPanel
            facts={facts}
            activeClaimIds={focusedBlock?.claimIds ?? []}
            focusedBlockLabel={
              focusedBlock ? BLOCK_TYPE_LABEL[focusedBlock.type] : undefined
            }
            disabled={busy || !focusedBlock}
            onToggleClaim={(claimId) => {
              if (!focusedBlock) {
                message.warning('请先选择中间的脚本段落');
                return;
              }
              patchDraft((current) =>
                toggleClaimOnBlock(current, focusedBlock.id, claimId, prohibitedWords),
              );
            }}
          />
          <div className="script-panel-card">
            <div className="script-panel-title">
              <Typography.Text strong>品牌规则</Typography.Text>
              <Typography.Text type="secondary" className="script-panel-count">
                {BRAND_RULES.length} 条适用中
              </Typography.Text>
            </div>
            <div className="script-brand-rules">
              {BRAND_RULES.map((rule) => (
                <div key={rule}>
                  <CheckCircleFilled />
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </div>
          <ScriptRiskPanel
            items={riskItems}
            onFocusBlock={(blockId) => setFocusedBlockId(blockId)}
          />
          <ScriptScorePanel
            score={sayability.overall}
            breakdown={sayability}
            versionName={draft.name}
          />
        </aside>
      </div>
    </div>
  );
}
