import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BytePlusTtsError,
  createBytePlusTtsAdapter,
  inspectBytePlusTtsConfiguration,
  mapBytePlusTtsError,
  type BytePlusTtsTransport,
} from "./byteplusTts";

function testTransport(
  synthesize: BytePlusTtsTransport["synthesize"] = async () => ({
    audio: new Uint8Array([1, 2, 3]),
    mimeType: "audio/mpeg",
    providerRequestId: "provider-request-1",
  }),
): BytePlusTtsTransport {
  return {
    protocol: "verified-test-v1",
    requiredEnvironment: ["BYTEPLUS_TTS_TEST_TOKEN"],
    synthesize,
  };
}

const configuredEnv = {
  BYTEPLUS_TTS_ENABLED: "true",
  BYTEPLUS_TTS_PROTOCOL: "verified-test-v1",
  BYTEPLUS_TTS_TEST_TOKEN: "server-only-secret",
};

const validInput = {
  text: "欢迎来到受控试点。",
  voice: "pilot-voice",
  format: "mp3" as const,
  sampleRateHz: 24_000 as const,
  idempotencyKey: "tts-task-0001",
};

test("keeps TTS disabled by default without inventing endpoint or credentials", () => {
  assert.deepEqual(inspectBytePlusTtsConfiguration({}), {
    enabled: false,
    configured: false,
    executable: false,
    code: "BYTEPLUS_TTS_DISABLED",
    requiredEnvironment: ["BYTEPLUS_TTS_ENABLED", "BYTEPLUS_TTS_PROTOCOL"],
    missingEnvironment: [],
    message: "独立 TTS 默认安全关闭；只有显式启用并注册已核验的 BytePlus 协议后才可执行。",
  });
});

test("blocks enabled but unregistered protocols before any network call", async () => {
  const adapter = createBytePlusTtsAdapter({
    env: { BYTEPLUS_TTS_ENABLED: "true", BYTEPLUS_TTS_PROTOCOL: "guessed-http-v1" },
  });
  assert.equal(adapter.inspect().code, "BYTEPLUS_TTS_PROTOCOL_UNVERIFIED");
  await assert.rejects(
    adapter.synthesize(validInput),
    (error: unknown) => error instanceof BytePlusTtsError && error.code === "TTS_PROTOCOL_UNVERIFIED",
  );
});

test("reports only credential names and never returns credential values", () => {
  const missing = inspectBytePlusTtsConfiguration(
    { BYTEPLUS_TTS_ENABLED: "true", BYTEPLUS_TTS_PROTOCOL: "verified-test-v1" },
    [testTransport()],
  );
  assert.equal(missing.code, "BYTEPLUS_TTS_CONFIGURATION_MISSING");
  assert.deepEqual(missing.missingEnvironment, ["BYTEPLUS_TTS_TEST_TOKEN"]);

  const ready = inspectBytePlusTtsConfiguration(configuredEnv, [testTransport()]);
  assert.equal(ready.code, "BYTEPLUS_TTS_READY");
  assert.equal(JSON.stringify(ready).includes("server-only-secret"), false);
});

test("deduplicates concurrent synthesis with the same key and payload", async () => {
  let calls = 0;
  let started = 0;
  const transport = testTransport(async (request, configuration) => {
    calls += 1;
    assert.equal(configuration.BYTEPLUS_TTS_TEST_TOKEN, "server-only-secret");
    assert.equal(request.requestDigest.length, 64);
    assert.equal(request.idempotencyKey, "tts-task-0001");
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { audio: new Uint8Array([9, 8, 7]), mimeType: "audio/mpeg", providerRequestId: "tts-1" };
  });
  const adapter = createBytePlusTtsAdapter({ env: configuredEnv, transports: [transport] });
  const hooks = { onStarted: () => { started += 1; } };
  const [first, replay] = await Promise.all([
    adapter.synthesize(validInput, hooks),
    adapter.synthesize({ ...validInput }, hooks),
  ]);

  assert.equal(calls, 1);
  assert.equal(started, 1);
  assert.equal(first.requestDigest, replay.requestDigest);
  assert.equal(first.provider, "byteplus");
});

test("rejects reuse of one idempotency key for different TTS content", async () => {
  const adapter = createBytePlusTtsAdapter({ env: configuredEnv, transports: [testTransport()] });
  await adapter.synthesize(validInput);
  await assert.rejects(
    adapter.synthesize({ ...validInput, text: "不同内容" }),
    (error: unknown) => error instanceof BytePlusTtsError && error.code === "TTS_IDEMPOTENCY_CONFLICT",
  );
});

test("maps provider failures to stable retry and permission errors", () => {
  const forbidden = mapBytePlusTtsError(Object.assign(new Error("secret body"), { status: 403 }));
  assert.equal(forbidden.code, "TTS_PERMISSION_DENIED");
  assert.equal(forbidden.retryable, false);

  const limited = mapBytePlusTtsError(Object.assign(new Error("too many requests"), { status: 429 }));
  assert.equal(limited.code, "TTS_RATE_LIMITED");
  assert.equal(limited.retryable, true);

  const timeout = mapBytePlusTtsError(new Error("request timed out"));
  assert.equal(timeout.code, "TTS_PROVIDER_TIMEOUT");
  assert.equal(timeout.retryable, true);

  const rejected = mapBytePlusTtsError(new Error("provider echoed server-only-secret"));
  assert.equal(rejected.code, "TTS_PROVIDER_REJECTED");
  assert.equal(rejected.message.includes("server-only-secret"), false);
});

test("allows the same idempotency key to retry after a transient provider failure", async () => {
  let calls = 0;
  const adapter = createBytePlusTtsAdapter({
    env: configuredEnv,
    transports: [testTransport(async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error("busy"), { status: 503 });
      return { audio: new Uint8Array([4, 5, 6]), mimeType: "audio/mpeg" };
    })],
  });
  await assert.rejects(
    adapter.synthesize(validInput),
    (error: unknown) => error instanceof BytePlusTtsError && error.code === "TTS_PROVIDER_UNAVAILABLE",
  );
  await adapter.synthesize(validInput);
  assert.equal(calls, 2);
});

test("rejects empty or unsupported transport responses", async () => {
  const adapter = createBytePlusTtsAdapter({
    env: configuredEnv,
    transports: [testTransport(async () => ({ audio: new Uint8Array(), mimeType: "audio/mpeg" }))],
  });
  await assert.rejects(
    adapter.synthesize(validInput),
    (error: unknown) => error instanceof BytePlusTtsError && error.code === "TTS_RESPONSE_INVALID",
  );
});
