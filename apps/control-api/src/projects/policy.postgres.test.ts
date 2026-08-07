import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from '../db/migrations/001_pilot_core.js';
import { up as addSessionRotation } from '../db/migrations/002_auth_session_rotation.js';
import { up as addContentTenantIntegrity } from '../db/migrations/003_content_tenant_integrity.js';
import { up as addProductionPackageGrant } from '../db/migrations/004_production_package_grant.js';
import { up as hardenProductionSecurity } from '../db/migrations/005_production_security_hardening.js';
import { up as addOrganizationFoundation } from '../db/migrations/006_organization_foundation.js';
import { up as addChannelFoundation } from '../db/migrations/007_channel_foundation.js';
import { up as addOrganizationMembership } from '../db/migrations/008_organization_membership.js';
import { up as addProjectAssignment } from '../db/migrations/009_project_assignment.js';
import { up as addSessionActiveContext } from '../db/migrations/010_session_active_context.js';
import { allowsProjectAction, PostgresProjectPolicy } from './policy.js';
import type { SessionActor } from './types.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const tenantId = '10000000-0000-4000-8000-000000000001';
const organizationId = '10000000-0000-4000-8000-000000000002';
const adminUserId = '10000000-0000-4000-8000-000000000003';
const adminMembershipId = '10000000-0000-4000-8000-000000000004';
const operatorUserId = '10000000-0000-4000-8000-000000000005';
const operatorMembershipId = '10000000-0000-4000-8000-000000000006';
const projectViewer = '10000000-0000-4000-8000-000000000007';
const projectEditor = '10000000-0000-4000-8000-000000000008';
const projectHidden = '10000000-0000-4000-8000-000000000009';

function actor(
  userId: string,
  membershipId: string,
  role: 'tenant_admin' | 'content_operator',
): SessionActor {
  return {
    userId,
    membershipId,
    organizationId,
    organizationType: 'TENANT',
    tenantId,
    membershipVersion: 1,
    primaryRole: role,
    roles: [role],
  };
}

describe.skipIf(!hasDedicatedTestDatabase)('A-BIZ-01.3 Project Policy PostgreSQL', () => {
  let database: Knex;
  let policy: PostgresProjectPolicy;

  beforeAll(async () => {
    database = knex({ client: 'pg', connection: databaseUrl });
    await database.raw('drop schema if exists control_plane cascade');
    await createPilotCore(database);
    await addSessionRotation(database);
    await addContentTenantIntegrity(database);
    await addProductionPackageGrant(database);
    await hardenProductionSecurity(database);
    await addOrganizationFoundation(database);
    await addChannelFoundation(database);
    await addOrganizationMembership(database);
    await addProjectAssignment(database);
    await addSessionActiveContext(database);
    policy = new PostgresProjectPolicy(database);
  });

  beforeEach(async () => {
    await database.raw(`
      truncate table
        control_plane.project_assignments,
        control_plane.project_assignment_backfill_runs,
        control_plane.project_grants,
        control_plane.production_packages,
        control_plane.script_approvals,
        control_plane.script_versions,
        control_plane.creative_briefs,
        control_plane.idempotency_records,
        control_plane.projects,
        control_plane.auth_sessions,
        control_plane.organization_membership_roles,
        control_plane.organization_memberships,
        control_plane.memberships,
        control_plane.users,
        control_plane.tenants,
        control_plane.channels,
        control_plane.organizations
      restart identity cascade
    `);
    await database('control_plane.organizations').insert({
      organization_id: organizationId,
      organization_type: 'TENANT',
      display_name: 'Policy Tenant',
      status: 'active',
    });
    await database('control_plane.tenants').insert({
      tenant_id: tenantId,
      organization_id: organizationId,
      display_name: 'Policy Tenant',
      status: 'active',
    });
    await database('control_plane.users').insert([
      {
        user_id: adminUserId,
        email: 'admin@example.com',
        display_name: 'Admin',
        password_hash: 'unused',
        status: 'active',
      },
      {
        user_id: operatorUserId,
        email: 'operator@example.com',
        display_name: 'Operator',
        password_hash: 'unused',
        status: 'active',
      },
    ]);
    await database.transaction(async (transaction) => {
      await transaction.raw('set constraints all deferred');
      await transaction('control_plane.organization_memberships').insert([
        {
          membership_id: adminMembershipId,
          user_id: adminUserId,
          organization_id: organizationId,
          status: 'active',
          primary_role_code: 'tenant_admin',
          version: 1,
        },
        {
          membership_id: operatorMembershipId,
          user_id: operatorUserId,
          organization_id: organizationId,
          status: 'active',
          primary_role_code: 'content_operator',
          version: 1,
        },
      ]);
      await transaction('control_plane.organization_membership_roles').insert([
        { membership_id: adminMembershipId, role_code: 'tenant_admin' },
        { membership_id: operatorMembershipId, role_code: 'content_operator' },
      ]);
    });
    await database('control_plane.projects').insert(
      [projectViewer, projectEditor, projectHidden].map((projectId, index) => ({
        project_id: projectId,
        tenant_id: tenantId,
        name: `Project ${index + 1}`,
        status: 'draft',
        platform: 'douyin',
        aspect_ratio: '9:16',
        target_duration_seconds: 30,
        created_by: adminUserId,
      })),
    );
    await database('control_plane.project_assignments').insert([
      {
        project_assignment_id: '20000000-0000-4000-8000-000000000001',
        project_id: projectViewer,
        membership_id: operatorMembershipId,
        tenant_id: tenantId,
        organization_id: organizationId,
        access_level: 'viewer',
        status: 'active',
        assignment_source: 'manual',
        created_by: adminUserId,
      },
      {
        project_assignment_id: '20000000-0000-4000-8000-000000000002',
        project_id: projectEditor,
        membership_id: operatorMembershipId,
        tenant_id: tenantId,
        organization_id: organizationId,
        access_level: 'editor',
        status: 'active',
        assignment_source: 'manual',
        created_by: adminUserId,
      },
    ]);
  });

  afterAll(async () => {
    await database?.destroy();
  });

  it('gives an active tenant_admin manager access without assignments', async () => {
    const admin = actor(adminUserId, adminMembershipId, 'tenant_admin');

    await expect(policy.canCreateProject(admin)).resolves.toBe(true);
    await expect(policy.listVisibleProjectIds(admin)).resolves.toBeNull();
    await expect(policy.resolveProjectAccess(admin, projectHidden)).resolves.toBe('manager');
    expect(allowsProjectAction('manager', 'project.manage')).toBe(true);
    expect(allowsProjectAction('manager', 'project.production.write')).toBe(true);
  });

  it('limits content_operator access to live viewer/editor assignments', async () => {
    const operator = actor(operatorUserId, operatorMembershipId, 'content_operator');

    await expect(policy.canCreateProject(operator)).resolves.toBe(false);
    await expect(policy.listVisibleProjectIds(operator)).resolves.toEqual([
      projectViewer,
      projectEditor,
    ]);
    await expect(policy.resolveProjectAccess(operator, projectViewer)).resolves.toBe('viewer');
    await expect(policy.resolveProjectAccess(operator, projectEditor)).resolves.toBe('editor');
    await expect(policy.resolveProjectAccess(operator, projectHidden)).resolves.toBeNull();
    expect(allowsProjectAction('viewer', 'project.content.read')).toBe(true);
    expect(allowsProjectAction('viewer', 'project.content.write')).toBe(false);
    expect(allowsProjectAction('editor', 'project.content.write')).toBe(true);
    expect(allowsProjectAction('editor', 'project.manage')).toBe(false);

    await database('control_plane.project_assignments')
      .where({ project_id: projectEditor, membership_id: operatorMembershipId })
      .update({ status: 'suspended' });
    await expect(policy.resolveProjectAccess(operator, projectEditor)).resolves.toBeNull();

    await database('control_plane.organization_memberships')
      .where({ membership_id: operatorMembershipId })
      .update({ status: 'suspended' });
    await expect(policy.listVisibleProjectIds(operator)).resolves.toEqual([]);
  });

  it('fails closed when Membership version, Role, or Organization status changes', async () => {
    const operator = actor(operatorUserId, operatorMembershipId, 'content_operator');
    const staleVersion = { ...operator, membershipVersion: 99 };

    await expect(policy.listVisibleProjectIds(staleVersion)).resolves.toEqual([]);
    await expect(policy.resolveProjectAccess(staleVersion, projectEditor)).resolves.toBeNull();

    await database.transaction(async (transaction) => {
      await transaction('control_plane.organization_membership_roles').insert({
        membership_id: operatorMembershipId,
        role_code: 'tenant_admin',
      });
      await transaction('control_plane.organization_memberships')
        .where({ membership_id: operatorMembershipId })
        .update({ primary_role_code: 'tenant_admin' });
      await transaction('control_plane.organization_membership_roles')
        .where({ membership_id: operatorMembershipId, role_code: 'content_operator' })
        .delete();
    });
    await expect(policy.listVisibleProjectIds(operator)).resolves.toEqual([]);
    await expect(policy.resolveProjectAccess(operator, projectEditor)).resolves.toBeNull();

    await database('control_plane.organizations')
      .where({ organization_id: organizationId })
      .update({ status: 'suspended' });
    const refreshedVersion = await database('control_plane.organization_memberships')
      .where({ membership_id: adminMembershipId })
      .first('version');
    const admin = {
      ...actor(adminUserId, adminMembershipId, 'tenant_admin'),
      membershipVersion: Number(refreshedVersion?.version ?? 1),
    };
    await expect(policy.canCreateProject(admin)).resolves.toBe(false);
    await expect(policy.resolveProjectAccess(admin, projectHidden)).resolves.toBeNull();
  });

  it('does not expand the active context with another Membership or Tenant project', async () => {
    const otherOrganizationId = '30000000-0000-4000-8000-000000000001';
    const otherTenantId = '30000000-0000-4000-8000-000000000002';
    const otherMembershipId = '30000000-0000-4000-8000-000000000003';
    const otherProjectId = '30000000-0000-4000-8000-000000000004';

    await database('control_plane.organizations').insert({
      organization_id: otherOrganizationId,
      organization_type: 'TENANT',
      display_name: 'Other Tenant',
      status: 'active',
    });
    await database('control_plane.tenants').insert({
      tenant_id: otherTenantId,
      organization_id: otherOrganizationId,
      display_name: 'Other Tenant',
      status: 'active',
    });
    await database.transaction(async (transaction) => {
      await transaction.raw('set constraints all deferred');
      await transaction('control_plane.organization_memberships').insert({
        membership_id: otherMembershipId,
        user_id: operatorUserId,
        organization_id: otherOrganizationId,
        status: 'active',
        primary_role_code: 'content_operator',
        version: 1,
      });
      await transaction('control_plane.organization_membership_roles').insert({
        membership_id: otherMembershipId,
        role_code: 'content_operator',
      });
    });
    await database('control_plane.projects').insert({
      project_id: otherProjectId,
      tenant_id: otherTenantId,
      name: 'Other Project',
      status: 'draft',
      platform: 'douyin',
      aspect_ratio: '9:16',
      target_duration_seconds: 30,
      created_by: adminUserId,
    });
    await database('control_plane.project_assignments').insert({
      project_assignment_id: '30000000-0000-4000-8000-000000000005',
      project_id: otherProjectId,
      membership_id: otherMembershipId,
      tenant_id: otherTenantId,
      organization_id: otherOrganizationId,
      access_level: 'editor',
      status: 'active',
      assignment_source: 'manual',
      created_by: adminUserId,
    });

    const currentOperator = actor(operatorUserId, operatorMembershipId, 'content_operator');
    const currentAdmin = actor(adminUserId, adminMembershipId, 'tenant_admin');
    await expect(policy.listVisibleProjectIds(currentOperator)).resolves.toEqual([
      projectViewer,
      projectEditor,
    ]);
    await expect(policy.resolveProjectAccess(currentOperator, otherProjectId)).resolves.toBeNull();
    await expect(policy.resolveProjectAccess(currentAdmin, otherProjectId)).resolves.toBeNull();
  });
});
