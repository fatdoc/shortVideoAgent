import crypto from "node:crypto";
import {
  getBytePlusAssetConfig,
  listBytePlusAssets,
  type BytePlusAssetConfig,
  type BytePlusAssetItem,
} from "./byteplusAssets";

const TOS_ALGORITHM = "TOS4-HMAC-SHA256";
const TOS_SERVICE = "tos";

export interface BytePlusTosTarget {
  accessKey: string;
  secretKey: string;
  region: string;
  bucket: string;
  endpoint: string;
  prefix: string;
  groupId: string;
}

export interface SignedTosPutRequest {
  url: string;
  headers: Record<string, string>;
}

function hmac(key: string | Buffer, value: string): Buffer {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
}

function hashHex(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function uriEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}

function canonicalObjectPath(objectKey: string): string {
  return `/${objectKey.split("/").filter(Boolean).map(uriEncode).join("/")}`;
}

function canonicalQuery(parameters: Record<string, string>): string {
  return Object.keys(parameters)
    .sort()
    .map((key) => `${uriEncode(key)}=${uriEncode(parameters[key])}`)
    .join("&");
}

function tosTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function signingKey(secretKey: string, shortDate: string, region: string): Buffer {
  const dateKey = hmac(secretKey, shortDate);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, TOS_SERVICE);
  return hmac(serviceKey, "request");
}

function signature(
  stringToSign: string,
  config: BytePlusTosTarget,
  shortDate: string,
): string {
  return crypto
    .createHmac("sha256", signingKey(config.secretKey, shortDate, config.region))
    .update(stringToSign, "utf8")
    .digest("hex");
}

function cleanEndpoint(value: string): string {
  return value.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function deriveFromAssetUrl(
  url: string,
  assetConfig: BytePlusAssetConfig,
): BytePlusTosTarget | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  const marker = parsed.hostname.indexOf(".tos-");
  if (marker <= 0) return undefined;
  const bucket = parsed.hostname.slice(0, marker);
  const endpoint = parsed.hostname.slice(marker + 1);
  const prefix = parsed.pathname.split("/").filter(Boolean)[0] || "";
  if (!bucket || !endpoint) return undefined;
  return {
    accessKey: assetConfig.accessKey,
    secretKey: assetConfig.secretKey,
    region: assetConfig.region,
    bucket,
    endpoint,
    prefix,
    groupId: assetConfig.groupId,
  };
}

export function resolveBytePlusTosTarget(
  assets: BytePlusAssetItem[] = [],
  env: NodeJS.ProcessEnv = process.env,
): BytePlusTosTarget | undefined {
  const assetConfig = getBytePlusAssetConfig(env);
  const bucket = env.ARK_ASSET_TOS_BUCKET?.trim();
  const endpoint = env.ARK_ASSET_TOS_ENDPOINT?.trim();
  if (bucket && endpoint) {
    return {
      accessKey: assetConfig.accessKey,
      secretKey: assetConfig.secretKey,
      region: env.ARK_ASSET_TOS_REGION?.trim() || assetConfig.region,
      bucket,
      endpoint: cleanEndpoint(endpoint),
      prefix: env.ARK_ASSET_TOS_PREFIX?.trim().replace(/^\/+|\/+$/g, "") || "",
      groupId: assetConfig.groupId,
    };
  }
  return assets
    .map((asset) => asset.URL)
    .filter((url): url is string => Boolean(url))
    .map((url) => deriveFromAssetUrl(url, assetConfig))
    .find((target): target is BytePlusTosTarget => Boolean(target));
}

export async function getBytePlusTosUploadTarget(): Promise<BytePlusTosTarget> {
  const configured = resolveBytePlusTosTarget([], process.env);
  if (configured) return configured;
  const listing = await listBytePlusAssets();
  const target = resolveBytePlusTosTarget(listing.Items || []);
  if (!target) {
    throw new Error(
      "Image 2 结果需要先上传到海外 TOS 才能注册可信资产；请配置 "
      + "ARK_ASSET_TOS_BUCKET 与 ARK_ASSET_TOS_ENDPOINT。",
    );
  }
  return target;
}

export function createSignedTosPutRequest(
  objectKey: string,
  content: Buffer,
  contentType: string,
  config: BytePlusTosTarget,
  date = new Date(),
): SignedTosPutRequest {
  const timestamp = tosTimestamp(date);
  const shortDate = timestamp.slice(0, 8);
  const host = `${config.bucket}.${cleanEndpoint(config.endpoint)}`;
  const payloadHash = hashHex(content);
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-tos-content-sha256:${payloadHash}`,
    `x-tos-date:${timestamp}`,
    "",
  ].join("\n");
  const signedHeaders = "content-type;host;x-tos-content-sha256;x-tos-date";
  const canonicalRequest = [
    "PUT",
    canonicalObjectPath(objectKey),
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${shortDate}/${config.region}/${TOS_SERVICE}/request`;
  const stringToSign = [
    TOS_ALGORITHM,
    timestamp,
    scope,
    hashHex(canonicalRequest),
  ].join("\n");
  const authorization = `${TOS_ALGORITHM} Credential=${config.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature(stringToSign, config, shortDate)}`;

  return {
    url: `https://${host}${canonicalObjectPath(objectKey)}`,
    headers: {
      Authorization: authorization,
      "Content-Type": contentType,
      Host: host,
      "X-Tos-Content-Sha256": payloadHash,
      "X-Tos-Date": timestamp,
    },
  };
}

export function createSignedTosGetUrl(
  objectKey: string,
  config: BytePlusTosTarget,
  date = new Date(),
  expiresSeconds = 7_200,
): string {
  const timestamp = tosTimestamp(date);
  const shortDate = timestamp.slice(0, 8);
  const host = `${config.bucket}.${cleanEndpoint(config.endpoint)}`;
  const scope = `${shortDate}/${config.region}/${TOS_SERVICE}/request`;
  const query = {
    "X-Tos-Algorithm": TOS_ALGORITHM,
    "X-Tos-Credential": `${config.accessKey}/${scope}`,
    "X-Tos-Date": timestamp,
    "X-Tos-Expires": String(expiresSeconds),
    "X-Tos-SignedHeaders": "host",
  };
  const canonicalRequest = [
    "GET",
    canonicalObjectPath(objectKey),
    canonicalQuery(query),
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    TOS_ALGORITHM,
    timestamp,
    scope,
    hashHex(canonicalRequest),
  ].join("\n");
  const signedQuery = canonicalQuery({
    ...query,
    "X-Tos-Signature": signature(stringToSign, config, shortDate),
  });
  return `https://${host}${canonicalObjectPath(objectKey)}?${signedQuery}`;
}

function extensionForMime(contentType: string): string {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}

export async function uploadBytePlusAssetSource(
  content: Buffer,
  contentType: string,
  name: string,
): Promise<string> {
  const config = await getBytePlusTosUploadTarget();
  const safeName = name.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "") || "character";
  const digest = hashHex(content).slice(0, 20);
  const prefix = config.prefix ? `${config.prefix}/` : "";
  const objectKey = `${prefix}storycanvas/${config.groupId}/${digest}-${safeName}.${extensionForMime(contentType)}`;
  const request = createSignedTosPutRequest(objectKey, content, contentType, config);
  const response = await fetch(request.url, {
    method: "PUT",
    headers: request.headers,
    body: new Uint8Array(content),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(`Image 2 结果上传海外 TOS 失败（HTTP ${response.status}）。`);
  }
  return createSignedTosGetUrl(objectKey, config);
}
