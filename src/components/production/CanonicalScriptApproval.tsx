import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { Alert, Button, Input, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useControlPlaneStore } from '../../stores/controlPlaneStore';

const statusMeta = {
  pending: { color: 'default', label: '待批准' },
  approved: { color: 'success', label: '已批准' },
  revoked: { color: 'warning', label: '已撤销' },
  blocked: { color: 'error', label: '事实风险阻断' },
} as const;

export function CanonicalScriptApproval() {
  const approval = useControlPlaneStore((state) =>
    state.snapshot.scriptApprovals.find(
      (item) => item.scriptVersionId === 'script-a',
    ),
  );
  const loading = useControlPlaneStore((state) => state.loading);
  const approve = useControlPlaneStore((state) => state.approveCanonicalScript);
  const revoke = useControlPlaneStore((state) => state.revokeCanonicalScript);
  const block = useControlPlaneStore((state) => state.blockCanonicalScript);
  const [blockReason, setBlockReason] = useState('品牌事实来源待复核');
  const [factRiskInput, setFactRiskInput] = useState('fact-risk-c6-source');

  if (!approval) {
    return (
      <Alert
        type="error"
        showIcon
        message="SCRIPT_NOT_APPROVED"
        description="canonical script-a 没有批准记录，生产包与发包已阻断。"
      />
    );
  }

  const meta = statusMeta[approval.status];
  const riskIds = factRiskInput
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <section className="d1-surface d1-script-approval">
      <div className="d1-section-heading">
        <div>
          <Space size={8} wrap>
            <Typography.Title level={4}>企业项目 · canonical 脚本审批</Typography.Title>
            <Tag color={meta.color}>{meta.label}</Tag>
          </Space>
          <Typography.Text type="secondary">
            script-a · 未批准、已撤销或事实风险阻断时，不得创建生产包或发包。
          </Typography.Text>
        </div>
        <Space wrap>
          <Button
            type={approval.status === 'approved' ? 'default' : 'primary'}
            icon={<CheckCircleOutlined />}
            disabled={approval.status === 'approved'}
            loading={loading}
            onClick={() => approve()}
          >
            批准脚本
          </Button>
          <Button
            icon={<CloseCircleOutlined />}
            disabled={approval.status !== 'approved'}
            loading={loading}
            onClick={() => revoke()}
          >
            撤销批准
          </Button>
        </Space>
      </div>

      <div className="d1-approval-grid">
        <div>
          <Typography.Text type="secondary">批准主体</Typography.Text>
          <Typography.Text strong>{approval.approvedBy ?? '—'}</Typography.Text>
        </div>
        <div>
          <Typography.Text type="secondary">最后更新时间</Typography.Text>
          <Typography.Text strong>{approval.updatedAt}</Typography.Text>
        </div>
        <div>
          <Typography.Text type="secondary">事实风险</Typography.Text>
          <Typography.Text strong>
            {approval.factRiskIds.join(' · ') || '已清除'}
          </Typography.Text>
        </div>
      </div>

      <div className="d1-approval-blocker">
        <Input
          aria-label="事实风险 ID"
          value={factRiskInput}
          onChange={(event) => setFactRiskInput(event.target.value)}
          placeholder="fact-risk-id，多个用逗号分隔"
        />
        <Input
          aria-label="阻断原因"
          value={blockReason}
          onChange={(event) => setBlockReason(event.target.value)}
          placeholder="记录事实风险阻断原因"
        />
        <Button
          danger
          icon={<StopOutlined />}
          disabled={!blockReason.trim() || riskIds.length === 0}
          loading={loading}
          onClick={() => block(blockReason.trim(), riskIds)}
        >
          阻断发包
        </Button>
      </div>

      {approval.status === 'blocked' ? (
        <Alert
          type="error"
          showIcon
          message={`SCRIPT_APPROVAL_BLOCKED · ${approval.blockedReason}`}
          description={`Fact Risk: ${approval.factRiskIds.join(' · ')}。修复事实后需显式重新批准。`}
        />
      ) : null}
    </section>
  );
}
