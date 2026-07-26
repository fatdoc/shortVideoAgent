import {
  Button,
  Input,
  InputNumber,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  CommentOutlined,
  LinkOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import type { Claim, ScriptBlock } from '../../domain/types';
import { StatusTag } from '../common/StatusTag';
import {
  BLOCK_TYPE_HINT,
  BLOCK_TYPE_LABEL,
  detectProhibitedHits,
  formatShortTime,
} from './scriptHelpers';

interface ScriptBlockEditorProps {
  block: ScriptBlock;
  facts: Claim[];
  prohibitedWords: string[];
  focused: boolean;
  disabled?: boolean;
  onFocus: () => void;
  onContentChange: (content: string) => void;
  onDurationChange: (duration: number) => void;
  onToggleClaim: (claimId: string) => void;
  onAddComment: (content: string) => void;
}

export function ScriptBlockEditor({
  block,
  facts,
  prohibitedWords,
  focused,
  disabled = false,
  onFocus,
  onContentChange,
  onDurationChange,
  onToggleClaim,
  onAddComment,
}: ScriptBlockEditorProps) {
  const [commentDraft, setCommentDraft] = useState('');
  const [showComments, setShowComments] = useState(block.comments.length > 0);
  const hits = detectProhibitedHits(block.content, prohibitedWords);
  const factMap = new Map(facts.map((f) => [f.id, f]));

  const riskClass =
    block.riskLevel === 'high'
      ? ' is-risk-high'
      : block.riskLevel === 'medium'
        ? ' is-risk-medium'
        : '';

  const submitComment = () => {
    if (!commentDraft.trim()) return;
    onAddComment(commentDraft);
    setCommentDraft('');
    setShowComments(true);
  };

  return (
    <div
      className={`script-block-card${focused ? ' is-focused' : ''}${riskClass}`}
      data-testid={`script-block-${block.type}`}
      onClick={onFocus}
    >
      <div className="script-block-head">
        <div>
          <div className="script-block-type">
            <span className="script-block-type-label">{BLOCK_TYPE_LABEL[block.type]}</span>
            <StatusTag kind="risk" value={block.riskLevel} />
            {hits.length > 0 ? (
              <Tooltip title={`禁用词：${hits.join('、')}`}>
                <Tag icon={<WarningOutlined />} color="error">
                  禁用词 {hits.length}
                </Tag>
              </Tooltip>
            ) : null}
          </div>
          <div className="script-block-hint">{BLOCK_TYPE_HINT[block.type]}</div>
        </div>
        <Space size={8}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            时长
          </Typography.Text>
          <Space.Compact size="small" onClick={(event) => event.stopPropagation()}>
            <InputNumber
              min={1}
              max={30}
              size="small"
              value={block.duration}
              disabled={disabled}
              onChange={(value) => onDurationChange(Number(value) || 1)}
              style={{ width: 72 }}
            />
            <Button size="small" disabled>
              s
            </Button>
          </Space.Compact>
        </Space>
      </div>

      <Input.TextArea
        value={block.content}
        disabled={disabled}
        autoSize={{ minRows: 2, maxRows: 6 }}
        placeholder={`填写 ${BLOCK_TYPE_LABEL[block.type]} 文案`}
        onFocus={onFocus}
        onChange={(event) => onContentChange(event.target.value)}
        data-testid={`script-block-content-${block.type}`}
      />

      <div className="script-block-meta-row" onClick={(event) => event.stopPropagation()}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          <LinkOutlined /> 事实引用
        </Typography.Text>
        {facts.map((fact) => {
          const active = block.claimIds.includes(fact.id);
          return (
            <Tag.CheckableTag
              key={fact.id}
              checked={active}
              className="script-claim-chip"
              onChange={() => {
                if (!disabled) onToggleClaim(fact.id);
              }}
              data-testid={`script-block-${block.type}-claim-${fact.id}`}
            >
              {fact.id}
            </Tag.CheckableTag>
          );
        })}
      </div>

      {block.claimIds.length > 0 ? (
        <div style={{ marginTop: 4 }}>
          {block.claimIds.map((id) => {
            const fact = factMap.get(id);
            return (
              <Typography.Paragraph
                key={id}
                type="secondary"
                style={{ marginBottom: 2, fontSize: 12 }}
              >
                <Tag color="blue">{id}</Tag>
                {fact?.text ?? '（事实不存在）'}
              </Typography.Paragraph>
            );
          })}
        </div>
      ) : (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          点击上方编号，或右侧事实库，将 C1—C8 绑定到本段
        </Typography.Text>
      )}

      <div style={{ marginTop: 10 }} onClick={(event) => event.stopPropagation()}>
        <Space wrap>
          <Button
            size="small"
            type="text"
            icon={<CommentOutlined />}
            onClick={() => setShowComments((v) => !v)}
          >
            评论 {block.comments.length > 0 ? `(${block.comments.length})` : ''}
          </Button>
        </Space>
        {showComments ? (
          <div className="script-comment-list">
            {block.comments.map((comment) => (
              <div key={comment.id} className="script-comment-item">
                <div className="script-comment-meta">
                  {comment.author} · {formatShortTime(comment.createdAt)}
                </div>
                <div>{comment.content}</div>
              </div>
            ))}
            <Space.Compact style={{ width: '100%', marginTop: 4 }}>
              <Input
                size="small"
                placeholder="添加协作评论…"
                value={commentDraft}
                disabled={disabled}
                onChange={(event) => setCommentDraft(event.target.value)}
                onPressEnter={submitComment}
              />
              <Button size="small" type="primary" disabled={disabled} onClick={submitComment}>
                发送
              </Button>
            </Space.Compact>
          </div>
        ) : null}
      </div>
    </div>
  );
}
