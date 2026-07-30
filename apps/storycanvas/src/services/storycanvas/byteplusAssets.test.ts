import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSignedAssetRequest,
  getBytePlusAssetConfig,
  hasBytePlusAssetConfig,
  toAssetUri,
} from "./byteplusAssets";

const config = {
  accessKey: "test-ak",
  secretKey: "test-sk",
  groupId: "group-test",
  host: "ark.ap-southeast-1.byteplusapi.com",
  region: "ap-southeast-1",
  service: "ark",
  version: "2024-01-01",
};

test("builds a deterministic overseas BytePlus SigV4 request", () => {
  const request = createSignedAssetRequest(
    "GetAssetGroup",
    { Id: "group-test" },
    config,
    new Date("2026-07-27T07:00:00.000Z"),
  );

  assert.equal(
    request.url,
    "https://ark.ap-southeast-1.byteplusapi.com/?Action=GetAssetGroup&Version=2024-01-01",
  );
  assert.equal(request.headers.Host, "ark.ap-southeast-1.byteplusapi.com");
  assert.equal(request.headers["X-Date"], "20260727T070000Z");
  assert.match(
    request.headers.Authorization,
    /^HMAC-SHA256 Credential=test-ak\/20260727\/ap-southeast-1\/ark\/request, SignedHeaders=content-type;host;x-content-sha256;x-date, Signature=[a-f0-9]{64}$/,
  );
  assert.equal(request.body, "{\"Id\":\"group-test\"}");
});

test("keeps asset credentials separate from the ModelArk bearer key", () => {
  const env = {
    ARK_API_KEY: "bearer-key",
    ARK_ASSET_ACCESS_KEY: "asset-ak",
    ARK_ASSET_SECRET_KEY: "asset-sk",
    ARK_ASSET_GROUP_ID: "group-assets",
  };
  assert.equal(hasBytePlusAssetConfig(env), true);
  assert.deepEqual(getBytePlusAssetConfig(env), {
    accessKey: "asset-ak",
    secretKey: "asset-sk",
    groupId: "group-assets",
    host: "ark.ap-southeast-1.byteplusapi.com",
    region: "ap-southeast-1",
    service: "ark",
    version: "2024-01-01",
  });
  assert.equal(toAssetUri("asset-123"), "asset://asset-123");
});
