import { SafetyCertificateOutlined } from '@ant-design/icons';
import { Select, Space, Tag, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { authorizeDemoNavigationRoute } from '../../domain/demoRouteAccess';
import { useControlPlaneStore } from '../../stores/controlPlaneStore';
import { useAuthStore } from '../../stores/authStore';
import { resolveWorkbenchKind, WORKBENCH_OPTIONS } from './workbench';
import { TruthBadge } from './TruthBadge';

export function WorkbenchSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const identity = useAuthStore((state) => state.identity);
  const kind = resolveWorkbenchKind(location.pathname);
  const allowedOptions = WORKBENCH_OPTIONS.filter(
    (option) =>
      identity?.allowedWorkbenches.includes(option.kind) &&
      authorizeDemoNavigationRoute(identity, option.home).status === 'allowed',
  );

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
          options={allowedOptions.map((option) => ({
            value: option.kind,
            label: option.label,
          }))}
          disabled={allowedOptions.length <= 1}
        />
        <Select
          aria-label="当前登录组织"
          value={identity?.activeOrganization.organizationId}
          popupMatchSelectWidth={360}
          options={
            identity
              ? [
                  {
                    value: identity.activeOrganization.organizationId,
                    label: `${identity.activeOrganization.organizationName} · ${identity.activeOrganization.organizationId}`,
                  },
                ]
              : []
          }
          disabled
        />
      </div>
      <div className="d1-context-copy">
        <Typography.Text strong ellipsis>
          Active · {identity?.activeOrganization.organizationName ?? '未登录'}
        </Typography.Text>
        <Typography.Text type="secondary" ellipsis>
          Organization [{identity?.activeOrganization.organizationType ?? 'UNRESOLVED'}]{' '}
          {identity?.activeOrganization.organizationId ?? 'unresolved'}
          {' · '}Workbench {kind}
        </Typography.Text>
        <Typography.Text type="secondary" ellipsis>
          Membership {identity?.activeMembership.membershipId ?? 'N/A'}
          {' · '}Role {identity?.activeMembership.roleCodes.join(' · ') || '无有效角色'}
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
