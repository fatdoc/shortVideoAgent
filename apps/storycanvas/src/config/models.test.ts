import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import FormData from "form-data";
import knex from "knex";
import { transform } from "sucrase";
import { VM } from "vm2";
import { bindAgentModels, STORYCANVAS_TEXT_AGENT_KEYS } from "./bindAgentModels";
import { getRuntimeVendorInputs, loadModels } from "./loadModels";
import { modelsConfigSchema } from "./models.schema";
import { seedVendorConfig } from "./seedVendorConfig";

test("loads the strict role-to-model configuration", async () => {
  const config = await loadModels();
  assert.equal(config.llm.model, "gpt-5.2");
  assert.equal(config.image.primary.model, "gpt-image-2");
  assert.equal(config.image.fallback.vendor, "volcengine");
  assert.equal(config.video.vendor, "byteplus");
  assert.equal(config.video.model, "dreamina-seedance-2-0-260128");

  const invalid = modelsConfigSchema.safeParse({ ...config, unexpected: true });
  assert.equal(invalid.success, false);
});

test("injects role-specific secrets only at runtime", async () => {
  const config = await loadModels();
  const env = {
    LLM_BASE_URL: "https://llm.example.test/v1/",
    LLM_API_KEY: "llm-secret",
    OPENAI_BASE_URL: "https://images.example.test/v1/",
    OPENAI_API_KEY: "image-secret",
  };

  assert.deepEqual(getRuntimeVendorInputs(config, "text", "openai", "gpt-5.2", env), {
    baseUrl: "https://llm.example.test/v1",
    apiKey: "llm-secret",
  });
  assert.deepEqual(getRuntimeVendorInputs(config, "image", "openai", "gpt-image-2", env), {
    baseUrl: "https://images.example.test/v1",
    apiKey: "image-secret",
  });
  assert.deepEqual(getRuntimeVendorInputs(config, "video", "openai", "gpt-image-2", env), {});
});

test("seeds vendors and agents without persisting API keys", async () => {
  const database = knex({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  await database.schema.createTable("o_vendorConfig", (table) => {
    table.string("id").primary();
    table.text("inputValues");
    table.text("models");
    table.integer("enable");
  });
  await database.schema.createTable("o_agentDeploy", (table) => {
    table.increments("id");
    table.string("key");
    table.string("model");
    table.string("modelName");
    table.string("vendorId");
  });
  await database("o_agentDeploy").insert(STORYCANVAS_TEXT_AGENT_KEYS.map((key) => ({ key })));

  const config = await loadModels();
  const env = {
    LLM_BASE_URL: "https://llm.example.test/v1",
    LLM_API_KEY: "must-not-be-persisted-llm",
    OPENAI_BASE_URL: "https://images.example.test/v1",
    OPENAI_API_KEY: "must-not-be-persisted-image",
    ARK_BASE_URL: "https://ark.example.test/v3",
    ARK_API_KEY: "must-not-be-persisted-ark",
  };
  await seedVendorConfig(database, config, env);
  const count = await bindAgentModels(database, config);
  assert.equal(count, STORYCANVAS_TEXT_AGENT_KEYS.length);

  const serializedRows = JSON.stringify(await database("o_vendorConfig").select("*"));
  assert.equal(serializedRows.includes("must-not-be-persisted"), false);
  assert.match(serializedRows, /LLM_API_KEY/);
  assert.match(serializedRows, /OPENAI_API_KEY/);
  assert.match(serializedRows, /ARK_API_KEY/);

  const agents = await database("o_agentDeploy").select("modelName", "vendorId");
  assert.ok(agents.every((agent) => agent.modelName === "openai:gpt-5.2" && agent.vendorId === "openai"));
  await database.destroy();
});

test("OpenAI vendor sends gpt-image-2 generation payload without a paid request", async () => {
  const source = await readFile("data/vendor/openai.ts", "utf8");
  const code = transform(source, { transforms: ["typescript"] }).code.replace(/export\s*\{\s*\};?/g, "");
  let capturedUrl = "";
  let capturedBody: Record<string, unknown> = {};
  const logs: string[] = [];
  const exports: Record<string, any> = {};
  const sandbox = {
    exports,
    Buffer,
    FormData,
    axios: { post: async () => ({ data: { data: [{ b64_json: "unused" }] } }) },
    fetch: async (url: string, init: { body?: string }) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init.body || "{}");
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [{ b64_json: "generated-base64" }] }),
        text: async () => "",
      };
    },
    logger: (message: string) => logs.push(message),
    urlToBase64: async () => "unused",
    createOpenAI: () => ({ chat: () => ({}) }),
  };
  new VM({ sandbox, eval: false, wasm: false }).run(code);
  exports.vendor.inputValues.apiKey = "not-logged-secret";
  exports.vendor.inputValues.baseUrl = "https://api.example.test/v1/";

  const output = await exports.imageRequest(
    { prompt: "vertical restaurant scene", referenceList: [], size: "2K", aspectRatio: "9:16" },
    exports.vendor.models.find((model: any) => model.modelName === "gpt-image-2"),
  );

  assert.equal(output, "generated-base64");
  assert.equal(capturedUrl, "https://api.example.test/v1/images/generations");
  assert.deepEqual(capturedBody, {
    model: "gpt-image-2",
    prompt: "vertical restaurant scene",
    size: "1024x1536",
    quality: "medium",
    output_format: "png",
  });
  assert.equal(logs.join("\n").includes("not-logged-secret"), false);
});
