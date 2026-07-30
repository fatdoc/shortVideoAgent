import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { creativeBriefSchema, mediaAssetSchema, shotSchema, validateStoryboardDuration } from ".";

const brief = {
  city: "郑州",
  storeName: "StoryCanvas 测试餐厅",
  address: "中原路 1 号",
  businessHours: "10:00-22:00",
  averageSpendCny: 68,
  promotions: ["到店九折"],
  sellingPoints: ["明档现做", "适合朋友聚餐"],
  targetAudience: ["本地年轻用户"],
  platform: "douyin" as const,
  callToAction: "收藏并到店体验",
  durationSeconds: 30,
  materialStrategy: "mixed" as const,
};

test("CreativeBrief accepts the MVP local-business fields and rejects unknown fields", () => {
  assert.equal(creativeBriefSchema.parse(brief).durationSeconds, 30);
  assert.equal(creativeBriefSchema.safeParse({ ...brief, platform: "youtube" }).success, false);
  assert.equal(creativeBriefSchema.safeParse({ ...brief, unknown: true }).success, false);
});

test("AI assets must preserve provider and prompt provenance", () => {
  const asset = {
    id: randomUUID(),
    projectId: 1,
    imageId: null,
    videoId: null,
    type: "image" as const,
    source: "generated" as const,
    originalName: null,
    mimeType: "image/png",
    byteSize: 123,
    localPath: "1/images/example.png",
    remoteUrl: null,
    thumbnailPath: null,
    durationMs: null,
    width: 1024,
    height: 1536,
    fps: null,
    provider: null,
    prompt: null,
    sha256: "a".repeat(64),
    rightsNote: null,
    metadata: {},
    createdAt: new Date().toISOString(),
  };
  assert.equal(mediaAssetSchema.safeParse(asset).success, false);
  assert.equal(mediaAssetSchema.safeParse({ ...asset, provider: "openai", prompt: "vertical food scene" }).success, true);
});

test("storyboard duration validation catches incomplete timelines", () => {
  const sceneId = randomUUID();
  const makeShot = (storyboardId: number, durationSeconds: number, sortOrder: number) =>
    shotSchema.parse({
      storyboardId,
      sceneId,
      shotType: "medium",
      cameraMovement: "push-in",
      visualDescription: "餐厅招牌和热气腾腾的菜品",
      imagePrompt: "vertical restaurant image",
      videoPrompt: "slow cinematic push in",
      narration: "",
      onScreenText: "",
      transitionName: "cut",
      materialStrategy: "ai-video",
      durationSeconds,
      locked: false,
      sortOrder,
      generationStatus: "queued",
    });
  const shots = [makeShot(1, 12, 0), makeShot(2, 12, 1), makeShot(3, 6, 2)];
  assert.equal(validateStoryboardDuration(shots, 30), 30);
  assert.throws(() => validateStoryboardDuration(shots, 60), /不一致/);
});
