import { Empty, Input, Progress, Select, Table, Tag, Typography } from 'antd';
import { SearchOutlined, SoundOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import type { Claim, ClaimStatus, ScriptVersion } from '../../domain/types';

const typeLabels: Record<Claim['type'], string> = {
  fact: '事实',
  price: '价格',
  service: '服务',
  policy: '权益',
  disclaimer: '声明',
};

const statusLabels: Record<ClaimStatus, string> = {
  approved: '已确认',
  pending: '待复核',
  expired: '已过期',
  rejected: '已驳回',
};

const statusColors: Record<ClaimStatus, string> = {
  approved: 'green',
  pending: 'orange',
  expired: 'magenta',
  rejected: 'red',
};

interface BrandFactsTableProps {
  facts: Claim[];
  scripts: ScriptVersion[];
  disabled?: boolean;
  className?: string;
  tone?: string[];
  voiceExample?: string;
  onStatusChange: (claimId: string, status: ClaimStatus) => void;
}

export function BrandFactsTable({
  facts,
  scripts,
  disabled,
  className,
  tone = [],
  voiceExample,
  onStatusChange,
}: BrandFactsTableProps) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<string>('all');

  const rows = useMemo(
    () =>
      facts.filter((fact) => {
        const matchesQuery = `${fact.id} ${fact.text} ${fact.source}`
          .toLowerCase()
          .includes(query.trim().toLowerCase());
        return matchesQuery && (type === 'all' || fact.type === type);
      }),
    [facts, query, type],
  );

  return (
    <div className={`brand-facts-panel ${className ?? ''}`} data-testid="brand-facts-panel">
      <div className="brand-panel-heading brand-facts-heading">
        <div>
          <Typography.Title level={5}>事实语料与口吻</Typography.Title>
          <Typography.Text type="secondary">C1—C8 是脚本引用的唯一事实来源</Typography.Text>
        </div>
        <div className="brand-fact-tools">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索编号 / 文案 / 来源"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="brand-fact-search"
          />
          <Select
            value={type}
            onChange={setType}
            className="brand-fact-type-select"
            options={[
              { value: 'all', label: '全部类型' },
              ...Object.entries(typeLabels).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>
      </div>
      {tone.length ? (
        <div className="brand-tone-summary">
          <span className="brand-tone-summary-icon">
            <SoundOutlined />
          </span>
          <div className="brand-tone-summary-copy">
            <div className="brand-tone-summary-title">
              <Typography.Text strong>语调关键词</Typography.Text>
              <span className="brand-tone-summary-tags">
                {tone.map((item) => (
                  <Tag color="blue" key={item}>
                    {item}
                  </Tag>
                ))}
              </span>
            </div>
            <Typography.Text type="secondary">
              口吻示例 {voiceExample ?? '“海底捞服务至上，让每一次用餐都暖心！”'}
            </Typography.Text>
          </div>
          <Typography.Text type="secondary" className="brand-tone-summary-type">
            类型
          </Typography.Text>
        </div>
      ) : null}
      <Table<Claim>
          className="brand-facts-table"
          rowKey="id"
          size="small"
          tableLayout="fixed"
          pagination={false}
          dataSource={rows}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的事实" />,
          }}
          columns={[
            {
              title: '编号',
              dataIndex: 'id',
              width: 46,
              render: (value: string) => (
                <Tag color="blue" className="brand-fact-id-tag">
                  {value}
                </Tag>
              ),
            },
            {
              title: '事实内容',
              dataIndex: 'text',
              render: (value: string, record) => {
                const citationCount = scripts.filter((script) =>
                  script.citations.includes(record.id),
                ).length;
                return (
                  <div className="brand-fact-content">
                    <Typography.Text className="brand-fact-text" title={value}>
                      {value}
                    </Typography.Text>
                    <Typography.Text type="secondary" className="brand-fact-source">
                      {typeLabels[record.type]} · {record.source} · 引用 {citationCount}
                    </Typography.Text>
                  </div>
                );
              },
            },
            {
              title: '可信度',
              dataIndex: 'confidence',
              width: 58,
              render: (value: number) => (
                <div className="brand-confidence-cell">
                  <span>{Math.round(value * 100)}%</span>
                  <Progress
                    percent={Math.round(value * 100)}
                    size="small"
                    showInfo={false}
                    strokeColor={value >= 0.9 ? '#52c41a' : '#faad14'}
                  />
                </div>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 88,
              render: (value: ClaimStatus, record) => (
                <Select
                  size="small"
                  className={`brand-fact-status-select brand-fact-status-${value}`}
                  value={value}
                  disabled={disabled}
                  onChange={(next: ClaimStatus) => onStatusChange(record.id, next)}
                  options={Object.entries(statusLabels).map(([optionValue, label]) => ({
                    value: optionValue,
                    label,
                  }))}
                  optionRender={(option) => (
                    <Tag color={statusColors[option.value as ClaimStatus]}>{option.label}</Tag>
                  )}
                  aria-label={`${record.id} 状态`}
                />
              ),
            },
          ]}
        />
    </div>
  );
}
