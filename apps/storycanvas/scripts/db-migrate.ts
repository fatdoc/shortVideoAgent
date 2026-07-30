import { databaseReady, db } from "@/utils/db";
import { getStoryCanvasMigrationStatus, rollbackLatestStoryCanvasMigration, runStoryCanvasMigrations } from "@/lib/storycanvasMigrations";

async function main() {
  await databaseReady;
  const command = process.argv[2] || "up";
  if (command === "up") {
    const applied = await runStoryCanvasMigrations(db);
    console.log(applied.length > 0 ? `已应用 Migration：${applied.join(", ")}` : "Migration 已是最新状态");
  } else if (command === "down") {
    const rolledBack = await rollbackLatestStoryCanvasMigration(db);
    console.log(rolledBack ? `已回滚 Migration：${rolledBack}` : "没有可回滚的 Migration");
  } else if (command === "status") {
    for (const item of await getStoryCanvasMigrationStatus(db)) {
      console.log(`${item.applied && item.checksumMatches ? "APPLIED" : "PENDING"} ${item.version}`);
    }
  } else {
    throw new Error(`未知命令 ${command}，只支持 up/down/status`);
  }
  await db.destroy();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
