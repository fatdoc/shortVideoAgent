import { describe, expect, it } from 'vitest';
import { resolveTenantPageHandoffContext, type TenantPageHandoffInput } from './tenantPageHandoff';

function validInput(overrides: Partial<TenantPageHandoffInput> = {}): TenantPageHandoffInput {
  return {
    runtime: {
      mode: 'pilot',
      controlApiBaseUrl: 'https://control.example.com',
      configurationError: null,
    },
    sessionContext: {
      organizationType: 'TENANT',
      tenantId: 'tenant-1',
      membershipId: 'membership-1',
      roleCodes: ['tenant_admin'],
    },
    projectContext: {
      tenantId: 'tenant-1',
      projectId: 'project-alpha',
      sessionMembershipId: 'membership-1',
      roleCodes: ['tenant_admin'],
    },
    requestedProjectId: 'project-alpha',
    ...overrides,
  };
}

describe('Tenant page handoff context', () => {
  it('builds the exact six-field contract for a tenant admin', () => {
    const result = resolveTenantPageHandoffContext(validInput());

    expect(result).toEqual({
      status: 'ready',
      context: {
        projectId: 'project-alpha',
        tenantId: 'tenant-1',
        sessionMembershipId: 'membership-1',
        roleCodes: ['tenant_admin'],
        runtimeMode: 'pilot',
        controlApiBaseUrl: 'https://control.example.com',
      },
    });
    if (result.status === 'ready') {
      expect(Object.keys(result.context).sort()).toEqual(
        [
          'projectId',
          'tenantId',
          'sessionMembershipId',
          'roleCodes',
          'runtimeMode',
          'controlApiBaseUrl',
        ].sort(),
      );
    }
  });

  it('supports content operators and emits roles in a stable deduplicated order', () => {
    const result = resolveTenantPageHandoffContext(
      validInput({
        sessionContext: {
          organizationType: 'TENANT',
          tenantId: 'tenant-1',
          membershipId: 'membership-1',
          roleCodes: ['content_operator', 'tenant_admin', 'content_operator'],
        },
        projectContext: {
          tenantId: 'tenant-1',
          projectId: 'project-alpha',
          sessionMembershipId: 'membership-1',
          roleCodes: ['tenant_admin', 'content_operator'],
        },
      }),
    );

    expect(result).toMatchObject({
      status: 'ready',
      context: { roleCodes: ['tenant_admin', 'content_operator'] },
    });
  });

  it('rejects Demo or unresolved runtime instead of creating a Pilot context', () => {
    expect(
      resolveTenantPageHandoffContext(
        validInput({
          runtime: { mode: 'demo', controlApiBaseUrl: null, configurationError: null },
        }),
      ),
    ).toEqual({ status: 'unavailable', reason: 'runtime-not-pilot' });
    expect(
      resolveTenantPageHandoffContext(
        validInput({
          runtime: {
            mode: null,
            controlApiBaseUrl: null,
            configurationError: 'mode missing',
          },
        }),
      ),
    ).toEqual({ status: 'unavailable', reason: 'runtime-not-pilot' });
  });

  it.each([
    [null, null],
    ['https://control.example.com', 'invalid runtime'],
    ['https://user:secret@control.example.com', null],
    ['https://control.example.com?token=secret', null],
  ])('rejects unavailable or unsafe Control API configuration', (controlApiBaseUrl, error) => {
    expect(
      resolveTenantPageHandoffContext(
        validInput({
          runtime: {
            mode: 'pilot',
            controlApiBaseUrl,
            configurationError: error,
          },
        }),
      ),
    ).toEqual({ status: 'unavailable', reason: 'control-api-unavailable' });
  });

  it('rejects missing and non-Tenant session context', () => {
    expect(resolveTenantPageHandoffContext(validInput({ sessionContext: null }))).toEqual({
      status: 'unavailable',
      reason: 'tenant-context-required',
    });
    expect(
      resolveTenantPageHandoffContext(
        validInput({
          sessionContext: {
            organizationType: 'PLATFORM',
            tenantId: null,
            membershipId: 'membership-1',
            roleCodes: ['platform_admin'],
          },
        }),
      ),
    ).toEqual({ status: 'unavailable', reason: 'tenant-context-required' });
  });

  it('rejects a missing Project context', () => {
    expect(resolveTenantPageHandoffContext(validInput({ projectContext: null }))).toEqual({
      status: 'unavailable',
      reason: 'project-context-unavailable',
    });
  });

  it('rejects a requested Project outside the authorized in-memory context', () => {
    expect(
      resolveTenantPageHandoffContext(validInput({ requestedProjectId: 'project-unassigned' })),
    ).toEqual({ status: 'unavailable', reason: 'project-mismatch' });
  });

  it('rejects Tenant mismatch between Session and Project context', () => {
    expect(
      resolveTenantPageHandoffContext(
        validInput({
          projectContext: {
            tenantId: 'tenant-other',
            projectId: 'project-alpha',
            sessionMembershipId: 'membership-1',
            roleCodes: ['tenant_admin'],
          },
        }),
      ),
    ).toEqual({ status: 'unavailable', reason: 'tenant-context-required' });
  });

  it('rejects Membership mismatch between Session and Project context', () => {
    expect(
      resolveTenantPageHandoffContext(
        validInput({
          projectContext: {
            tenantId: 'tenant-1',
            projectId: 'project-alpha',
            sessionMembershipId: 'membership-other',
            roleCodes: ['tenant_admin'],
          },
        }),
      ),
    ).toEqual({ status: 'unavailable', reason: 'membership-context-mismatch' });
  });

  it('rejects Role drift or unknown roles', () => {
    expect(
      resolveTenantPageHandoffContext(
        validInput({
          projectContext: {
            tenantId: 'tenant-1',
            projectId: 'project-alpha',
            sessionMembershipId: 'membership-1',
            roleCodes: ['content_operator'],
          },
        }),
      ),
    ).toEqual({ status: 'unavailable', reason: 'role-context-mismatch' });
    expect(
      resolveTenantPageHandoffContext(
        validInput({
          sessionContext: {
            organizationType: 'TENANT',
            tenantId: 'tenant-1',
            membershipId: 'membership-1',
            roleCodes: ['tenant_admin', 'unknown_role'],
          },
        }),
      ),
    ).toEqual({ status: 'unavailable', reason: 'role-context-mismatch' });
  });

  it('does not expose secrets, assignments, access levels, display data, or Demo state', () => {
    const result = resolveTenantPageHandoffContext(validInput());
    expect(JSON.stringify(result)).not.toMatch(
      /token|cookie|authorization|grant|assignment|accessLevel|email|displayName|projectName|demo-local/i,
    );
  });

  it('clones and freezes the ready context so later input mutation cannot expand scope', () => {
    const sessionRoles = ['tenant_admin'];
    const projectRoles = ['tenant_admin'];
    const input = validInput({
      sessionContext: {
        organizationType: 'TENANT',
        tenantId: 'tenant-1',
        membershipId: 'membership-1',
        roleCodes: sessionRoles,
      },
      projectContext: {
        tenantId: 'tenant-1',
        projectId: 'project-alpha',
        sessionMembershipId: 'membership-1',
        roleCodes: projectRoles,
      },
    });

    const result = resolveTenantPageHandoffContext(input);
    sessionRoles.push('content_operator');
    projectRoles.push('content_operator');

    expect(result).toMatchObject({
      status: 'ready',
      context: { roleCodes: ['tenant_admin'] },
    });
    if (result.status === 'ready') {
      expect(Object.isFrozen(result.context)).toBe(true);
      expect(Object.isFrozen(result.context.roleCodes)).toBe(true);
    }
  });
});
