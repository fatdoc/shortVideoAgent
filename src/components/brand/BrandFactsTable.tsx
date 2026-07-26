import { Empty, Input, Progress, Select, Table, Tag, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
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

interface BrandFactsTableProps {
  facts: Claim[];
  scripts: ScriptVersion[];
  disabled?: boolean;
  onStatusChange: (claimId: string, status: ClaimStatus) => void;
}

export function BrandFactsTable({
  facts,
  scripts,
  disabled,
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
    <div className="brand-facts-panel" data-testid="brand-facts-panel">
      <div className="brand-panel-heading">
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
            style={{ width: 220 }}
          />
          <Select
            value={type}
            onChange={setType}
            style={{ width: 110 }}
            options={[
              { value: 'all', label: '全部类型' },
              ...Object.entries(typeLabels).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>
      </div>
      <Table<Claim>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={rows}
        locale={{
          emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的事实" />,
        }}
        columns={[
          {
            title: '编号',
            dataIndex: 'id',
            width: 66,
            render: (value: string) => <Tag color="blue">{value}</Tag>,
          },
          {
            title: '事实内容',
            dataIndex: 'text',
            render: (value: string, record) => (
              <div className="brand-fact-content">
                <Typography.Text>{value}</Typography.Text>
                <Typography.Text type="secondary">
                  {typeLabels[record.type]} · 来源 {record.source}
                </Typography.Text>
              </div>
            ),
          },
          {
            title: '可信度',
            dataIndex: 'confidence',
            width: 150,
            render: (value: number) => (
              <div className="brand-confidence-cell">
                <Progress
                  percent={Math.round(value * 100)}
                  size="small"
                  showInfo={false}
                  strokeColor={value >= 0.9 ? '#52c41a' : '#faad14'}
                />
                <span>{Math.round(value * 100)}%</span>
              </div>
            ),
          },
          {
            title: '脚本引用',
            width: 92,
            render: (_, record) => {
              const count = scripts.filter((script) => script.citations.includes(record.id)).length;
              return <Typography.Text>{count} 个版本</Typography.Text>;
            },
          },
          {
            title: '状态',
            dataIndex: 'status',
            width: 112,
            render: (value: ClaimStatus, record) => (
              <Select
                size="small"
                value={value}
                disabled={disabled}
                onChange={(next: ClaimStatus) => onStatusChange(record.id, next)}
                options={Object.entries(statusLabels).map(([optionValue, label]) => ({
                  value: optionValue,
                  label,
                }))}
                aria-label={`${record.id} 状态`}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
