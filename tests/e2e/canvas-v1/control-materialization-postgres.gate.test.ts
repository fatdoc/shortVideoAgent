import knex from "../../../apps/control-api/node_modules/knex/knex.js";
import { describe, expect, it } from "vitest";

import { PostgresCanvasAssetMaterializationRepository } from "../../../apps/control-api/src/assets/materializationRepository";
import { up as migrate027 } from "../../../apps/control-api/src/db/migrations/027_canvas_asset_materialization";

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;

describe("CV6 dedicated PostgreSQL Control materialization persistence", () => {
  it("uses only videoagent_control_test and survives repository restart without secret-bearing persistence", async () => {
    expect(databaseUrl).toBe("postgresql://localhost/videoagent_control_test");
    const first = knex({ client: "pg", connection: databaseUrl });
    let second: ReturnType<typeof knex> | undefined;
    try {
      const current = await first.raw<{ rows: Array<{ database_name: string }> }>("select current_database() as database_name");
      expect(current.rows[0]?.database_name).toBe("videoagent_control_test");
      await first.raw(`
        drop schema if exists control_plane cascade;
        create schema control_plane;
        create table control_plane.tenants (tenant_id uuid primary key);
        create table control_plane.users (user_id uuid primary key);
        create table control_plane.canvas_asset_sessions (
          tenant_id uuid not null,
          project_id uuid not null,
          package_id uuid not null,
          canvas_session_id text primary key,
          actor_id uuid not null,
          unique (tenant_id, project_id, package_id, canvas_session_id, actor_id)
        );
        create table control_plane.canvas_asset_records (
          asset_id uuid primary key,
          tenant_id uuid not null,
          project_id uuid not null,
          package_id uuid not null
        );
      `);
      await migrate027(first);
      const record = {
        materializationAttemptId: "90909090-9090-4090-8090-909090909090",
        materializationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        tenantId: "11111111-1111-4111-8111-111111111111",
        projectId: "22222222-2222-4222-8222-222222222222",
        packageId: "33333333-3333-4333-8333-333333333333",
        canvasSessionId: "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678",
        actorId: "12121212-1212-4212-8212-121212121212",
        assetId: "88888888-8888-4888-8888-888888888888",
        authorityChecksum: `sha256:${"a".repeat(64)}`,
        mimeType: "image/jpeg" as const,
        byteSize: 3,
        createdAt: new Date("2026-08-14T02:00:00.000Z"),
      };
      await first("control_plane.tenants").insert({ tenant_id: record.tenantId });
      await first("control_plane.users").insert({ user_id: record.actorId });
      await first("control_plane.canvas_asset_sessions").insert({
        tenant_id: record.tenantId,
        project_id: record.projectId,
        package_id: record.packageId,
        canvas_session_id: record.canvasSessionId,
        actor_id: record.actorId,
      });
      await first("control_plane.canvas_asset_records").insert({
        asset_id: record.assetId,
        tenant_id: record.tenantId,
        project_id: record.projectId,
        package_id: record.packageId,
      });
      await expect(new PostgresCanvasAssetMaterializationRepository(first).createOrReplay(record)).resolves.toMatchObject({ kind: "created" });

      second = knex({ client: "pg", connection: databaseUrl });
      await expect(new PostgresCanvasAssetMaterializationRepository(second).createOrReplay(record)).resolves.toMatchObject({
        kind: "replayed",
        value: { materializationId: record.materializationId },
      });
      await expect(new PostgresCanvasAssetMaterializationRepository(second).createOrReplay({
        ...record,
        projectId: "30303030-3030-4030-8030-303030303030",
      })).resolves.toEqual({ kind: "conflict" });

      const columns = await second("information_schema.columns")
        .where({ table_schema: "control_plane", table_name: "canvas_asset_materialization_attempts" })
        .select("column_name")
        .orderBy("ordinal_position");
      const names = columns.map(({ column_name }) => String(column_name));
      expect(names).toEqual([
        "materialization_attempt_id", "materialization_id", "tenant_id", "project_id", "package_id",
        "canvas_session_id", "actor_id", "asset_id", "authority_checksum", "mime_type", "byte_size", "created_at",
      ]);
      expect(names.join(" ")).not.toMatch(/content|bytes|storage|token|secret/i);
      await expect(second("control_plane.canvas_asset_materialization_attempts").where({
        materialization_attempt_id: record.materializationAttemptId,
      }).update({ byte_size: 4 })).rejects.toThrow(/immutable/i);
      await expect(second("control_plane.canvas_asset_materialization_attempts").where({
        materialization_attempt_id: record.materializationAttemptId,
      }).delete()).rejects.toThrow(/immutable/i);
    } finally {
      if (second) await second.destroy();
      await first.raw("drop schema if exists control_plane cascade");
      await first.destroy();
    }
  });
});
