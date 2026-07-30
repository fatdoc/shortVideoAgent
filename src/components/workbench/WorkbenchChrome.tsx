import { SafetyCertificateOutlined } from '@ant-design/icons';
import { Select, Space, Tag, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useControlPlaneStore } from '../../stores/controlPlaneStore';
import {
  resolveWorkbenchKind,
  WORKBENCH_OPTIONS,
} from './workbench';
import { TruthBadge } from './TruthBadge';

export function WorkbenchSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const snapshot = useControlPlaneStore((state) => state.snapshot);
  const activeOrganization = useControlPlaneStore(
    (state) => state.activeOrganization,
  );
  const switchActiveOrganization = useControlPlaneStore(
    (state) => state.switchActiveOrganization,
  );
  const kind = resolveWorkbenchKind(location.pathname);
  const activeMembershipIds = new Set(
    snapshot.commercial.memberships
      .filter((membership) => membership.status === 'active')
      .map((membership) => membership.organizationId),
  );
  const organizationOptions = [
    {
      value: snapshot.commercial.platform.platformId,
      label: `平台 actor · ${snapshot.commercial.platform.displayName} · ${snapshot.commercial.platform.platformId}`,
      disabled: !activeMembershipIds.has(
        snapshot.commercial.platform.platformId,
      ),
    },
    ...snapshot.commercial.channels.map((channel) => ({
      value: channel.channelOrganizationId,
      label: `渠道 ${channel.tier} actor · ${channel.displayName} · ${channel.channelOrganizationId}`,
      disabled: !activeMembershipIds.has(channel.channelOrganizationId),
    })),
    {
      value: snapshot.commercial.tenant.tenantId,
      label: `企业 / 媒体生产 actor · ${snapshot.commercial.tenant.displayName} · ${snapshot.commercial.tenant.tenantId}`,
      disabled: !activeMembershipIds.has(snapshot.commercial.tenant.tenantId),
    },
  ];
  const activeOrganizationName =
    activeOrganization?.organizationType === 'PLATFORM'
      ? snapshot.commercial.platform.displayName
      : activeOrganization?.organizationType === 'CHANNEL'
        ? snapshot.commercial.channels.find(
            (channel) =>
              channel.channelOrganizationId ===
              activeOrganization.activeOrganizationId,
          )?.displayName ?? '渠道组织不可用'
        : snapshot.commercial.tenant.displayName;

  return (
    <div className="d1-context-switcher">
      <div className="d1-context-selects">
        <Select
          aria-label="切换工作台"
          value={kind}
          popupMatchSelectWidth={240}
          onChange={(nextKind) => {
            const target = WORKBENCH_OPTIONS.find((item) => item.kind === nextKind);
            if (target) navigate(target.home);
          }}
          options={WORKBENCH_OPTIONS.map((option) => ({
            value: option.kind,
            label: option.label,
          }))}
        />
        <Select
          aria-label="切换当前组织"
          value={activeOrganization?.activeOrganizationId}
          placeholder="选择 active organization"
          popupMatchSelectWidth={360}
          onChange={(organizationId) => {
            switchActiveOrganization(organizationId);
          }}
          options={organizationOptions}
        />
      </div>
      <div className="d1-context-copy">
        <Typography.Text strong ellipsis>
          Active · {activeOrganizationName}
        </Typography.Text>
        <Typography.Text type="secondary" ellipsis>
          Organization [{activeOrganization?.organizationType ?? 'UNRESOLVED'}]{' '}
          {activeOrganization?.activeOrganizationId ?? 'unresolved'}
          {' · '}Workbench {activeOrganization?.workbenchKind ?? 'unresolved'}
        </Typography.Text>
        <Typography.Text
          type="secondary"
          ellipsis
          title={activeOrganization?.projectIds.join(' · ') ?? ''}
        >
          Tenant {activeOrganization?.tenantId ?? 'N/A'} · Project{' '}
          {activeOrganization?.projectIds.join(', ') || 'N/A'}
          {' · '}Role{' '}
          {activeOrganization?.roleCodes.join(' · ') || '无有效角色'}
        </Typography.Text>
      </div>
    </div>
  );
}

export function DemoTruthBar() {
  const snapshot = useControlPlaneStore((state) => state.snapshot);
  return (
    <div className="d1-truth-bar">
      <Space size={10} wrap>
        <SafetyCertificateOutlined />
        <Typography.Text strong>{snapshot.truthManifest.disclaimer}</Typography.Text>
        <Tag color={snapshot.stateName === 'DEMO_READY' ? 'green' : 'processing'}>
          {snapshot.stateName}
        </Tag>
        <TruthBadge capabilityId="demo.local-life-golden-path" compact />
        <TruthBadge capabilityId="production.storycanvas-foundation" compact />
      </Space>
      <Typography.Text type="secondary" className="d1-truth-digest">
        Fixture {snapshot.fixtureId} · {snapshot.fixtureDigest.slice(0, 19)}…
      </Typography.Text>
    </div>
  );
}
