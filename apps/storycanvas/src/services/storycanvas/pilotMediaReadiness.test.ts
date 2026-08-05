import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authorizePilotInternalRequest,
  getPilotMediaReadiness,
} from "./pilotMediaReadiness";

const configuredEnv = {
  MODELS_CONFIG_PATH: "config/models.json",
  ARK_API_KEY: "ark-secret-value",
  ARK_ASSET_ACCESS_KEY: "asset-access-secret",
  ARK_ASSET_SECRET_KEY: "asset-secret-value",
  ARK_ASSET_GROUP_ID: "asset-group",
  ARK_ASSET_TOS_BUCKET: "asset-bucket",
  ARK_ASSET_TOS_ENDPOINT: "tos.example.test",
};

test("reports implemented providers honestly and keeps current pilot blockers visible", async () => {
  const result = await getPilotMediaReadiness({
    env: configuredEnv,
    checkLocalStorage: async () => true,
    inspectFfmpeg: async () => ({ version: "ffmpeg version test", hasH264: true, hasAac: true }),
    now: () => new Date("2026-08-05T08:00:00.000Z"),
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.code, "PILOT_MEDIA_BLOCKED");
  assert.equal(result.checkedAt, "2026-08-05T08:00:00.000Z");
  assert.deepEqual(
    Object.fromEntries(result.checks.map((check) => [check.capability, check.status])),
    {
      storage: "ready",
      image: "ready",
      video: "ready",
      tts: "unavailable",
      ffmpeg: "ready",
    },
  );
  const serialized = JSON.stringify(result);
  for (const secret of ["ark-secret-value", "asset-access-secret", "asset-secret-value"]) {
    assert.equal(serialized.includes(secret), false);
  }
});

test("keeps storage degraded when the remote output adapter is not configured", async () => {
  const result = await getPilotMediaReadiness({
    env: { MODELS_CONFIG_PATH: "config/models.json" },
    checkLocalStorage: async () => true,
    inspectFfmpeg: async () => ({ version: "ffmpeg version test", hasH264: true, hasAac: true }),
  });
  const storage = result.checks.find((check) => check.capability === "storage");
  assert.equal(storage?.status, "degraded");
  assert.equal(storage?.code, "PILOT_STORAGE_OUTPUT_LOCAL_ONLY");
  assert.equal(storage?.details?.remoteOutputImplemented, false);
});

test("reports missing model credentials and an unavailable ffmpeg binary with stable codes", async () => {
  const result = await getPilotMediaReadiness({
    env: { MODELS_CONFIG_PATH: "config/models.json" },
    checkLocalStorage: async () => true,
    inspectFfmpeg: async () => {
      throw new Error("ENOENT");
    },
  });

  assert.equal(result.checks.find((check) => check.capability === "image")?.code, "PILOT_IMAGE_CREDENTIAL_MISSING");
  assert.equal(result.checks.find((check) => check.capability === "video")?.code, "PILOT_VIDEO_CREDENTIAL_MISSING");
  assert.equal(result.checks.find((check) => check.capability === "ffmpeg")?.code, "PILOT_FFMPEG_UNAVAILABLE");
});

test("requires a strong internal token and compares it without returning the secret", () => {
  const token = "pilot-internal-token-at-least-32-characters";
  assert.deepEqual(authorizePilotInternalRequest(token, { STORYCANVAS_INTERNAL_TOKEN: token }), { authorized: true });
  assert.deepEqual(
    authorizePilotInternalRequest("wrong", { STORYCANVAS_INTERNAL_TOKEN: token }),
    { authorized: false, code: "PILOT_INTERNAL_TOKEN_INVALID" },
  );
  assert.deepEqual(
    authorizePilotInternalRequest(undefined, { STORYCANVAS_INTERNAL_TOKEN: "short" }),
    { authorized: false, code: "PILOT_INTERNAL_TOKEN_NOT_CONFIGURED" },
  );
});
