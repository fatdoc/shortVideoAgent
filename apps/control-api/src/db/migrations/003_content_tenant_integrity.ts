import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    alter table control_plane.projects
      add constraint projects_id_tenant_uq unique (project_id, tenant_id);

    alter table control_plane.script_versions
      add constraint script_versions_id_project_tenant_uq
      unique (script_version_id, project_id, tenant_id);

    alter table control_plane.creative_briefs
      add constraint creative_briefs_project_tenant_fk
      foreign key (project_id, tenant_id)
      references control_plane.projects(project_id, tenant_id);

    alter table control_plane.script_versions
      add constraint script_versions_project_tenant_fk
      foreign key (project_id, tenant_id)
      references control_plane.projects(project_id, tenant_id);

    alter table control_plane.script_approvals
      add column approval_sequence bigint generated always as identity,
      add constraint script_approvals_project_tenant_fk
      foreign key (project_id, tenant_id)
      references control_plane.projects(project_id, tenant_id),
      add constraint script_approvals_script_project_tenant_fk
      foreign key (script_version_id, project_id, tenant_id)
      references control_plane.script_versions(script_version_id, project_id, tenant_id);

    create index script_approvals_latest_idx
      on control_plane.script_approvals
      (tenant_id, project_id, script_version_id, approval_sequence desc);
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    drop index if exists control_plane.script_approvals_latest_idx;
    alter table control_plane.script_approvals
      drop constraint if exists script_approvals_script_project_tenant_fk,
      drop constraint if exists script_approvals_project_tenant_fk,
      drop column if exists approval_sequence;
    alter table control_plane.script_versions
      drop constraint if exists script_versions_project_tenant_fk,
      drop constraint if exists script_versions_id_project_tenant_uq;
    alter table control_plane.creative_briefs
      drop constraint if exists creative_briefs_project_tenant_fk;
    alter table control_plane.projects
      drop constraint if exists projects_id_tenant_uq;
  `);
}
