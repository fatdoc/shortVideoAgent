import { readFile, writeFile } from "fs/promises";
import getPath from "@/utils/getPath";
import fs from "fs";
import path from "path";
import knex from "knex";
import initDB from "@/lib/initDB";
// import fixDB from "@/lib/fixDB";
import type { DB } from "@/types/database";
import crypto from "crypto";
import fixDB from "@/lib/fixDB";
import { runStoryCanvasMigrations } from "@/lib/storycanvasMigrations";
import canvasV1AssetCommandMigration from "../../migrations/005_canvas_v1_asset_command";
import dotenv from "dotenv";

dotenv.config({ quiet: true });
if (!process.env.NODE_ENV) process.env.NODE_ENV = "dev";

const pilotRuntime = process.env.STORYCANVAS_PILOT_CANVAS_ENABLED === "true";
function isSafePilotRuntimeMarker(line: string): boolean {
  if (line === "PILOT_CANVAS_RUNTIME_BLOCKED" || line === "PILOT_CANVAS_RUNTIME_STOPPED") return true;
  const ready = /^PILOT_CANVAS_RUNTIME_READY http:\/\/127\.0\.0\.1:(\d{1,5})$/.exec(line);
  if (!ready) return false;
  const port = Number(ready[1]);
  return Number.isSafeInteger(port) && port >= 1 && port <= 65_535;
}
if (pilotRuntime) {
  const writeSafeMarker = console.log.bind(console);
  console.log = (...values: unknown[]) => {
    const line = values.length === 1 && typeof values[0] === "string" ? values[0] : "";
    if (isSafePilotRuntimeMarker(line)) {
      writeSafeMarker(line);
    }
  };
  console.info = console.log;
  console.debug = () => undefined;
  console.warn = () => undefined;
  console.error = () => undefined;
}

type TableName = keyof DB & string;
type RowType<TName extends TableName> = DB[TName];

const dbPath = getPath("db2.sqlite");
if (!pilotRuntime) console.log("数据库目录:", dbPath);
const dbDir = path.dirname(dbPath);

// 确保数据库目录存在
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 创建空数据库文件
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, "");
}

const db = knex({
  client: "better-sqlite3",
  connection: {
    filename: dbPath,
  },
  useNullAsDefault: true,
});

const databaseReady = (async () => {
  await db.raw("PRAGMA foreign_keys = ON");
  if (pilotRuntime) {
    await runStoryCanvasMigrations(db, [canvasV1AssetCommandMigration]);
    return;
  }
  await initDB(db);
  await fixDB(db);
  await runStoryCanvasMigrations(db);
  if (process.env.NODE_ENV == "dev") await initKnexType(db);
})();

const dbClient = Object.assign(<TName extends TableName>(table: TName) => db<RowType<TName>, RowType<TName>[]>(table), db);
dbClient.schema = db.schema;
export default dbClient;

export { db, databaseReady };

async function initKnexType(knexDb: any) {
  const { Client } = await import("@rmp135/sql-ts");
  const outFile = "src/types/database.d.ts";
  const dbClient = Client.fromConfig({
    interfaceNameFormat: "${table}",
    typeMap: {
      number: ["bigint"],
      string: ["text", "varchar", "char"],
    },
  }).fetchDatabase(knexDb);
  const declarations = await dbClient.toTypescript();
  const dbObject = await dbClient.toObject();
  const customHeader = `//该文件由脚本自动生成，请勿手动修改`;
  // 清除上次的注释头
  let declBody = declarations.replace(/^\/\*[\s\S]*?\*\/\s*/, "");
  declBody = declBody.replace(/(\n\s*)\/\*([^*][\s\S]*?)\*\//g, "$1/**$2*/");
  const tableInterfaces = dbObject.schemas.flatMap((schema) => schema.tables.map((table) => table.interfaceName));
  const aggregateTypes = `
export interface DB {
${tableInterfaces.map((name) => `  ${JSON.stringify(name)}: ${name};`).join("\n")}
}
`;
  // 哈希仅基于结构化信息，header和空格不算
  const hashSource = JSON.stringify({
    tableInterfaces,
    declBody,
  });
  const hash = crypto.createHash("md5").update(hashSource).digest("hex");
  // 文件内容
  const content = `// @db-hash ${hash}\n${customHeader}\n\n` + declBody + aggregateTypes;
  let needWrite = true;
  try {
    const current = await readFile(outFile, "utf8");
    // 文件头已存在相同 hash，不需要写
    const match = current.match(/^\/\/\s*@db-hash\s*([a-zA-Z0-9]+)\n/);
    const currentHash = match ? match[1] : null;
    if (currentHash === hash) {
      needWrite = false;
    }
  } catch (err) {
    needWrite = true;
  }
  if (needWrite) await writeFile(outFile, content, "utf8");
}
