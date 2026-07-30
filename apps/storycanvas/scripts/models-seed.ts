import "dotenv/config";
import { bindAgentModels } from "@/config/bindAgentModels";
import { loadModels } from "@/config/loadModels";
import { seedVendorConfig } from "@/config/seedVendorConfig";
import { databaseReady, db } from "@/utils/db";

async function main() {
  await databaseReady;
  const config = await loadModels();
  const vendors = await seedVendorConfig(db, config);
  const agentCount = await bindAgentModels(db, config);
  console.log(`模型配置已同步：供应商 ${vendors.join(", ")}；Agent ${agentCount} 个。`);
  console.log("API Key 未写入 SQLite，运行时从配置指定的环境变量读取。");
  await db.destroy();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`模型配置同步失败：${message}`);
  process.exitCode = 1;
});
