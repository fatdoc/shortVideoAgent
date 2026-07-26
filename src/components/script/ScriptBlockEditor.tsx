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
          <Typography.Text type="secondary" className="script-block-hint">
            {BLOCK_TYPE_HINT[block.type]}
          </Typography.Text>
        </div>
        <Space.Compact size="small" onClick={(event) => event.stopPropagation()}>
          <InputNumber
            min={1}
            max={30}
            size="small"
            value={block.duration}
            disabled={disabled}
            onChange={(value) => onDurationChange(Number(value) || 1)}
            className="script-duration-input"
          />
          <span className="script-duration-label">s</span>
        </Space.Compact>
      </div>

      <Input.TextArea
        className="script-block-textarea"
        value={block.content}
        disabled={disabled}
        autoSize={{ minRows: 2, maxRows: 5 }}
        placeholder={`填写 ${BLOCK_TYPE_LABEL[block.type]} 文案`}
        onFocus={onFocus}
        onChange={(event) => onContentChange(event.target.value)}
        data-testid={`script-block-content-${block.type}`}
      />

      <div className="script-block-meta-row" onClick={(event) => event.stopPropagation()}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              <LinkOutlined /> 事实引用
            </Typography.Text>
            {block.claimIds.length > 0 ? (
              <Space size={6} wrap>
                {block.claimIds.map((id) => (
                  <Tag.CheckableTag
                    key={id}
                    checked
                    className="script-claim-chip"
                    onChange={() => {
                      if (!disabled) onToggleClaim(id);
                    }}
                    data-testid={`script-block-${block.type}-claim-${id}`}
                  >
                    {id}
                  </Tag.CheckableTag>
                ))}
              </Space>
            ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            当前未绑定事实
          </Typography.Text>
        )}
      </div>

      {block.claimIds.length > 0 ? (
        <div className="script-claim-descriptions">
          {block.claimIds.map((id) => {
            const fact = factMap.get(id);
            return (
              <Typography.Paragraph key={id} type="secondary" style={{ marginBottom: 2, fontSize: 12 }}>
                <Tag color="blue" style={{ marginRight: 6 }}>
                  {id}
                </Tag>
                {fact?.text ?? '（事实不存在）'}
              </Typography.Paragraph>
            );
          })}
        </div>
      ) : null}

      <div className="script-comment-block" onClick={(event) => event.stopPropagation()}>
        <Space wrap>
          <Button
            size="small"
            type="text"
            icon={<CommentOutlined />}
            onClick={() => setShowComments((v) => !v)}
          >
            评论 {block.comments.length > 0 ? `(${block.comments.length})` : ''}
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {block.comments.length ? `${block.comments.length} 条评论` : '暂无评论'}
          </Typography.Text>
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
