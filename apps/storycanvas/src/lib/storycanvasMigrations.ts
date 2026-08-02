import type { Knex } from "knex";
import coreMigration from "../../migrations/001_storycanvas_core";
import continuityMemoryMigration from "../../migrations/002_storycanvas_continuity_memory";
import productionContractMigration from "../../migrations/003_storycanvas_production_contract";
import phase1RuntimeMigration from "../../migrations/004_storycanvas_phase1_runtime";
import type { StoryCanvasMigration } from "../../migrations/types";

export const storyCanvasMigrations: StoryCanvasMigration[] = [
  coreMigration,
  continuityMemoryMigration,
  productionContractMigration,
  phase1RuntimeMigration,
];

export async function ensureMigrationRegistry(knex: Knex) {
  if (await knex.schema.hasTable("sc_migrations")) return;
  await knex.schema.createTable("sc_migrations", (table) => {
    table.string("version", 100).primary();
    table.text("appliedAt").notNullable();
    table.string("checksum", 64).notNullable();
  });
}

export async function runStoryCanvasMigrations(knex: Knex, migrations = storyCanvasMigrations): Promise<string[]> {
  await ensureMigrationRegistry(knex);
  const applied: string[] = [];

  for (const migration of migrations) {
    const existing = await knex("sc_migrations").where({ version: migration.version }).first();
    if (existing) {
      if (existing.checksum !== migration.checksum) {
        throw new Error(`Migration ${migration.version} checksum 不一致，拒绝继续启动`);
      }
      continue;
    }

    await knex.transaction(async (transaction) => {
      await migration.up(transaction);
      await transaction("sc_migrations").insert({
        version: migration.version,
        appliedAt: new Date().toISOString(),
        checksum: migration.checksum,
      });
    });
    applied.push(migration.version);
  }
  return applied;
}

export async function rollbackLatestStoryCanvasMigration(knex: Knex, migrations = storyCanvasMigrations): Promise<string | null> {
  await ensureMigrationRegistry(knex);
  const rows = await knex("sc_migrations").orderBy("appliedAt", "desc");
  const latest = rows.find((row) => migrations.some((migration) => migration.version === row.version));
  if (!latest) return null;
  const migration = migrations.find((candidate) => candidate.version === latest.version)!;
  if (latest.checksum !== migration.checksum) throw new Error(`Migration ${migration.version} checksum 不一致，拒绝回滚`);

  await knex.transaction(async (transaction) => {
    await migration.down(transaction);
    await transaction("sc_migrations").where({ version: migration.version }).delete();
  });
  return migration.version;
}

export async function getStoryCanvasMigrationStatus(knex: Knex, migrations = storyCanvasMigrations) {
  await ensureMigrationRegistry(knex);
  const rows = await knex("sc_migrations").select("version", "appliedAt", "checksum");
  return migrations.map((migration) => {
    const row = rows.find((candidate) => candidate.version === migration.version);
    return {
      version: migration.version,
      checksum: migration.checksum,
      applied: Boolean(row),
      appliedAt: row?.appliedAt ?? null,
      checksumMatches: row ? row.checksum === migration.checksum : null,
    };
  });
}
