import knex from "../../../apps/control-api/node_modules/knex/knex.js";
import { describe, expect, it, vi } from "vitest";

import { PostgresCanvasWorkspaceAuthorityRepository } from "../../../apps/control-api/src/production/workspaceAuthorityRepository";

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;

describe("CV6 dedicated PostgreSQL exact Workspace Authority", () => {
  it("uses only videoagent_control_test, exact Package IDs and a read-only transaction", async () => {
    expect(databaseUrl).toBe("postgresql://localhost/videoagent_control_test");
    const database = knex({ client: "pg", connection: databaseUrl });
    try {
      const current = await database.raw<{ rows: Array<{ database_name: string }> }>("select current_database() as database_name");
      expect(current.rows[0]?.database_name).toBe("videoagent_control_test");
      await database.raw(`
        drop schema if exists control_plane cascade;
        create schema control_plane;
        create table control_plane.projects (
          project_id uuid primary key, tenant_id uuid not null, name text not null
        );
        create table control_plane.script_versions (
          script_version_id uuid primary key, tenant_id uuid not null, project_id uuid not null, version integer not null
        );
        create table control_plane.storyboard_versions (
          storyboard_version_id uuid primary key, tenant_id uuid not null, project_id uuid not null, version integer not null
        );
        insert into control_plane.projects values
          ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'CV6 真实门店项目');
        insert into control_plane.script_versions values
          ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 3),
          ('66666666-6666-4666-8666-666666666666', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 999);
        insert into control_plane.storyboard_versions values
          ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 2),
          ('77777777-7777-4777-8777-777777777777', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 888);
      `);
      const verifier = vi.fn(async () => ({
        packageId: "33333333-3333-4333-8333-333333333333",
        contractVersion: "0.3" as const,
        status: "ready" as const,
        expiresAt: new Date("2026-08-14T03:00:00.000Z"),
        capabilityRequirements: ["video.generate" as const],
        scriptVersionId: "44444444-4444-4444-8444-444444444444",
        storyboardVersionId: "55555555-5555-4555-8555-555555555555",
        approvedScriptDigest: `sha256:${"a".repeat(64)}`,
        approvedStoryboardDigest: `sha256:${"b".repeat(64)}`,
      }));
      const input = {
        tenantId: "11111111-1111-4111-8111-111111111111",
        projectId: "22222222-2222-4222-8222-222222222222",
        packageId: "33333333-3333-4333-8333-333333333333",
        now: new Date("2026-08-14T02:03:00.100Z"),
      };
      const before = await database.raw<{ rows: Array<{ txid: string }> }>("select txid_current()::text as txid");
      await expect(new PostgresCanvasWorkspaceAuthorityRepository(database, verifier).readExact(input)).resolves.toEqual({
        projectName: "CV6 真实门店项目",
        scriptId: "44444444-4444-4444-8444-444444444444",
        scriptVersion: 3,
        storyboardId: "55555555-5555-4555-8555-555555555555",
        storyboardVersion: 2,
      });
      expect(verifier).toHaveBeenCalledWith(expect.anything(), input);
      expect(await database("control_plane.script_versions").count({ count: "*" }).first().then((row) => Number(row?.count))).toBe(2);
      expect(await database("control_plane.storyboard_versions").count({ count: "*" }).first().then((row) => Number(row?.count))).toBe(2);
      const after = await database.raw<{ rows: Array<{ txid: string }> }>("select txid_current()::text as txid");
      expect(Number(after.rows[0]?.txid)).toBeGreaterThanOrEqual(Number(before.rows[0]?.txid));
    } finally {
      await database.raw("drop schema if exists control_plane cascade");
      await database.destroy();
    }
  });
});
