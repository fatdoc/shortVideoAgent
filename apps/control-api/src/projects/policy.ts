import type { Knex } from 'knex';
import type { SessionActor } from './types.js';

export type ProjectAccess = 'viewer' | 'editor' | 'manager';

export type ProjectAction =
  | 'project.read'
  | 'project.manage'
  | 'project.content.read'
  | 'project.content.write'
  | 'project.production.read'
  | 'project.production.write';

export interface ProjectPolicy {
  canCreateProject(actor: SessionActor): Promise<boolean>;
  listVisibleProjectIds(actor: SessionActor): Promise<readonly string[] | null>;
  resolveProjectAccess(actor: SessionActor, projectId: string): Promise<ProjectAccess | null>;
}

const viewerActions = new Set<ProjectAction>([
  'project.read',
  'project.content.read',
  'project.production.read',
]);
const editorActions = new Set<ProjectAction>([
  ...viewerActions,
  'project.content.write',
  'project.production.write',
]);

export function allowsProjectAction(access: ProjectAccess, action: ProjectAction): boolean {
  if (access === 'manager') return true;
  return (access === 'editor' ? editorActions : viewerActions).has(action);
}

type AssignmentAccessRow = { access_level: 'viewer' | 'editor' };
type ProjectIdRow = { project_id: string };

export class PostgresProjectPolicy implements ProjectPolicy {
  constructor(private readonly database: Knex) {}

  async canCreateProject(actor: SessionActor): Promise<boolean> {
    if (!actor.roles.includes('tenant_admin')) return false;
    return Boolean(await this.activeRole(actor, 'tenant_admin').first());
  }

  async listVisibleProjectIds(actor: SessionActor): Promise<readonly string[] | null> {
    if (actor.roles.includes('tenant_admin') && (await this.canCreateProject(actor))) return null;
    if (!actor.roles.includes('content_operator')) return [];

    const rows = (await this.activeAssignment(actor)
      .select('assignment.project_id')
      .orderBy('assignment.project_id')) as ProjectIdRow[];
    return rows.map((row) => row.project_id);
  }

  async resolveProjectAccess(
    actor: SessionActor,
    projectId: string,
  ): Promise<ProjectAccess | null> {
    if (actor.roles.includes('tenant_admin')) {
      const project = await this.activeRole(actor, 'tenant_admin')
        .join({ project: 'control_plane.projects' }, 'project.tenant_id', 'tenant.tenant_id')
        .where('project.project_id', projectId)
        .select('project.project_id')
        .first();
      if (project) return 'manager';
    }
    if (!actor.roles.includes('content_operator')) return null;

    const assignment = (await this.activeAssignment(actor)
      .where('assignment.project_id', projectId)
      .select('assignment.access_level')
      .first()) as AssignmentAccessRow | undefined;
    return assignment?.access_level ?? null;
  }

  private activeRole(actor: SessionActor, role: 'tenant_admin' | 'content_operator') {
    return this.database({ membership: 'control_plane.organization_memberships' })
      .join(
        { membershipRole: 'control_plane.organization_membership_roles' },
        'membershipRole.membership_id',
        'membership.membership_id',
      )
      .join(
        { organization: 'control_plane.organizations' },
        'organization.organization_id',
        'membership.organization_id',
      )
      .join(
        { tenant: 'control_plane.tenants' },
        'tenant.organization_id',
        'organization.organization_id',
      )
      .where({
        'membership.membership_id': actor.membershipId,
        'membership.user_id': actor.userId,
        'membership.organization_id': actor.organizationId,
        'membership.status': 'active',
        'membership.version': actor.membershipVersion,
        'membershipRole.role_code': role,
        'organization.organization_type': 'TENANT',
        'organization.status': 'active',
        'tenant.tenant_id': actor.tenantId,
        'tenant.status': 'active',
      });
  }

  private activeAssignment(actor: SessionActor) {
    return this.activeRole(actor, 'content_operator')
      .join({ assignment: 'control_plane.project_assignments' }, function joinAssignment() {
        this.on('assignment.membership_id', '=', 'membership.membership_id')
          .andOn('assignment.organization_id', '=', 'organization.organization_id')
          .andOn('assignment.tenant_id', '=', 'tenant.tenant_id');
      })
      .join({ project: 'control_plane.projects' }, function joinProject() {
        this.on('project.project_id', '=', 'assignment.project_id').andOn(
          'project.tenant_id',
          '=',
          'assignment.tenant_id',
        );
      })
      .where('assignment.status', 'active');
  }
}
