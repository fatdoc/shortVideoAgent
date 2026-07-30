import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSignedTosGetUrl,
  createSignedTosPutRequest,
  resolveBytePlusTosTarget,
} from "./byteplusTos";

const config = {
  accessKey: "test-ak",
  secretKey: "test-sk",
  region: "ap-southeast-1",
  bucket: "character-assets",
  endpoint: "tos-ap-southeast-1.volces.com",
  prefix: "account-1",
  groupId: "group-test",
};

test("derives the overseas TOS upload target from an existing approved asset", () => {
  const target = resolveBytePlusTosTarget(
    [{
      URL: "https://ark-media-asset-ap-southeast-1.tos-ap-southeast-1.volces.com/3002701657/portrait.png?X-Tos-Signature=hidden",
    }],
    {
      ARK_ASSET_ACCESS_KEY: "asset-ak",
      ARK_ASSET_SECRET_KEY: "asset-sk",
      ARK_ASSET_GROUP_ID: "group-assets",
    },
  );

  assert.deepEqual(target, {
    accessKey: "asset-ak",
    secretKey: "asset-sk",
    region: "ap-southeast-1",
    bucket: "ark-media-asset-ap-southeast-1",
    endpoint: "tos-ap-southeast-1.volces.com",
    prefix: "3002701657",
    groupId: "group-assets",
  });
});

test("builds deterministic overseas TOS PUT and signed GET requests", () => {
  const date = new Date("2026-07-27T08:00:00.000Z");
  const put = createSignedTosPutRequest(
    "account-1/storycanvas/角色.png",
    Buffer.from("image"),
    "image/png",
    config,
    date,
  );
  assert.equal(
    put.url,
    "https://character-assets.tos-ap-southeast-1.volces.com/account-1/storycanvas/%E8%A7%92%E8%89%B2.png",
  );
  assert.equal(put.headers["X-Tos-Date"], "20260727T080000Z");
  assert.match(
    put.headers.Authorization,
    /^TOS4-HMAC-SHA256 Credential=test-ak\/20260727\/ap-southeast-1\/tos\/request, SignedHeaders=content-type;host;x-tos-content-sha256;x-tos-date, Signature=[a-f0-9]{64}$/,
  );

  const getUrl = createSignedTosGetUrl(
    "account-1/storycanvas/角色.png",
    config,
    date,
    7_200,
  );
  assert.match(getUrl, /^https:\/\/character-assets\.tos-ap-southeast-1\.volces\.com\/account-1\/storycanvas\/%E8%A7%92%E8%89%B2\.png\?/);
  assert.match(getUrl, /X-Tos-Expires=7200/);
  assert.match(getUrl, /X-Tos-Signature=[a-f0-9]{64}/);
});
