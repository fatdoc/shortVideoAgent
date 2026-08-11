import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    alter table control_plane.project_grants
      add constraint project_grants_id_package_project_tenant_uq
        unique (grant_id, package_id, project_id, tenant_id);

    alter table control_plane.canvas_entries
      drop constraint canvas_entries_grant_project_tenant_fk,
      add constraint canvas_entries_grant_package_project_tenant_fk
        foreign key (grant_id, package_id, project_id, tenant_id)
        references control_plane.project_grants(
          grant_id,
          package_id,
          project_id,
          tenant_id
        );
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    alter table control_plane.canvas_entries
      drop constraint if exists canvas_entries_grant_package_project_tenant_fk,
      add constraint canvas_entries_grant_project_tenant_fk
        foreign key (grant_id, project_id, tenant_id)
        references control_plane.project_grants(grant_id, project_id, tenant_id);

    alter table control_plane.project_grants
      drop constraint if exists project_grants_id_package_project_tenant_uq;
  `);
}
