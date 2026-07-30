import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBytePlusVideoPayload, extractBytePlusVideoUrl } from "./byteplusVideo";

test("builds an overseas Seedance first-frame request from a local data URL", () => {
  const payload = buildBytePlusVideoPayload(
    {
      prompt: "镜头缓慢向店门推进",
      referenceImage: "data:image/png;base64,AAAA",
      ratio: "9:16",
      duration: 8,
      resolution: "720p",
    },
    "dreamina-seedance-2-0-260128",
    false,
  );

  assert.deepEqual(payload, {
    model: "dreamina-seedance-2-0-260128",
    content: [
      { type: "text", text: "镜头缓慢向店门推进" },
      {
        type: "image_url",
        image_url: { url: "data:image/png;base64,AAAA" },
        role: "first_frame",
      },
    ],
    generate_audio: false,
    ratio: "9:16",
    duration: 8,
    resolution: "720p",
    watermark: false,
    return_last_frame: false,
  });
});

test("extracts the succeeded video URL from BytePlus task content", () => {
  assert.equal(
    extractBytePlusVideoUrl({
      status: "succeeded",
      content: { video_url: "https://cdn.example.test/result.mp4" },
    }),
    "https://cdn.example.test/result.mp4",
  );
});

test("uses approved overseas asset references instead of a raw real-person frame", () => {
  const payload = buildBytePlusVideoPayload(
    {
      prompt: "角色自然看向镜头",
      referenceImage: "data:image/png;base64,RAW",
      referenceAssetUris: ["asset://asset-approved-character"],
      ratio: "9:16",
      duration: 8,
      resolution: "720p",
    },
    "dreamina-seedance-2-0-260128",
  );

  assert.deepEqual(payload.content, [
    { type: "text", text: "角色自然看向镜头" },
    {
      type: "image_url",
      image_url: { url: "asset://asset-approved-character" },
      role: "reference_image",
    },
  ]);
});
