import "dotenv/config";
import { STORYCANVAS_TEXT_AGENT_KEYS } from "@/config/bindAgentModels";
import { listModelTargets, loadModels, resolveModelTarget } from "@/config/loadModels";
import { databaseReady, db } from "@/utils/db";

const args = new Set(process.argv.slice(2));
const requireKeys = args.has("--require-keys");
const live = args.has("--live");
let failures = 0;

function pass(message: string) {
  console.log(`PASS  ${message}`);
}

function skip(message: string) {
  console.log(`SKIP  ${message}`);
}

function fail(message: string) {
  failures += 1;
  console.error(`FAIL  ${message}`);
}

async function checkModelEndpoint(role: string, target: ReturnType<typeof resolveModelTarget>) {
  if (!target.apiKey) {
    if (requireKeys) fail(`${role} 缺少 ${target.apiKeyEnv}`);
    else skip(`${role} 未配置 ${target.apiKeyEnv}，未联网且未产生费用`);
    return;
  }
  if (!live) {
    pass(`${role} 已配置密钥引用（密钥值未输出；dry-run）`);
    return;
  }

  const response = await fetch(`${target.baseUrl}/models/${encodeURIComponent(target.model)}`, {
    headers: { Authorization: `Bearer ${target.apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.ok) pass(`${role} 鉴权与模型查询通过`);
  else fail(`${role} 鉴权或模型查询失败（HTTP ${response.status}）`);
}

async function main() {
  const config = await loadModels();
  pass("config/models.json 通过严格 Schema 校验");

  await databaseReady;
  const expectedVendors = new Set(listModelTargets(config).map(({ target }) => target.vendor));
  const vendorRows = await db("o_vendorConfig").whereIn("id", [...expectedVendors]);
  for (const vendor of expectedVendors) {
    const row = vendorRows.find((candidate) => candidate.id === vendor);
    if (!row) fail(`SQLite 缺少供应商 ${vendor}`);
    else if (row.enable !== 1) fail(`供应商 ${vendor} 未启用`);
    else pass(`供应商 ${vendor} 已同步并启用`);
  }

  const expectedModelName = `${config.llm.vendor}:${config.llm.model}`;
  const agents = await db("o_agentDeploy").whereIn("key", [...STORYCANVAS_TEXT_AGENT_KEYS]);
  const unbound = agents.filter((agent) => agent.modelName !== expectedModelName);
  if (agents.length !== STORYCANVAS_TEXT_AGENT_KEYS.length) fail("Agent 配置行不完整");
  else if (unbound.length > 0) fail(`${unbound.length} 个 Agent 尚未绑定 ${expectedModelName}`);
  else pass(`${agents.length} 个文本 Agent 已绑定 ${expectedModelName}`);

  for (const { role, target } of listModelTargets(config)) {
    try {
      await checkModelEndpoint(role, resolveModelTarget(target));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fail(`${role} 检查异常：${message}`);
    }
  }

  await db.destroy();
  if (failures > 0) throw new Error(`模型诊断发现 ${failures} 项失败`);
  pass(live ? "模型诊断完成" : "模型诊断完成（安全 dry-run）");
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (failures === 0) fail(message);
  process.exitCode = 1;
});
