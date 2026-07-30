import crypto from "node:crypto";

const DEFAULT_HOST = "ark.ap-southeast-1.byteplusapi.com";
const DEFAULT_REGION = "ap-southeast-1";
const DEFAULT_SERVICE = "ark";
const DEFAULT_VERSION = "2024-01-01";
const ALGORITHM = "HMAC-SHA256";

export interface BytePlusAssetConfig {
  accessKey: string;
  secretKey: string;
  groupId: string;
  host: string;
  region: string;
  service: string;
  version: string;
}

export interface BytePlusAssetItem {
  Id?: string;
  AssetId?: string;
  GroupId?: string;
  Name?: string;
  AssetType?: string;
  Status?: string;
  URL?: string;
  CreateTime?: string;
  UpdateTime?: string;
  Error?: {
    Code?: string;
    Message?: string;
  };
}

interface ArkResponse<T> {
  ResponseMetadata?: {
    RequestId?: string;
    Error?: {
      Code?: string;
      Message?: string;
    };
  };
  Result?: T;
}

export interface SignedAssetRequest {
  url: string;
  body: string;
  headers: Record<string, string>;
}

function requiredEnvironment(name: string, env: NodeJS.ProcessEnv): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`缺少 ${name}，请先配置海外 BytePlus 虚拟资产库。`);
  return value;
}

export function getBytePlusAssetConfig(env: NodeJS.ProcessEnv = process.env): BytePlusAssetConfig {
  return {
    accessKey: requiredEnvironment("ARK_ASSET_ACCESS_KEY", env),
    secretKey: requiredEnvironment("ARK_ASSET_SECRET_KEY", env),
    groupId: requiredEnvironment("ARK_ASSET_GROUP_ID", env),
    host: env.ARK_ASSET_HOST?.trim() || DEFAULT_HOST,
    region: env.ARK_ASSET_REGION?.trim() || DEFAULT_REGION,
    service: env.ARK_ASSET_SERVICE?.trim() || DEFAULT_SERVICE,
    version: env.ARK_ASSET_VERSION?.trim() || DEFAULT_VERSION,
  };
}

export function hasBytePlusAssetConfig(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.ARK_ASSET_ACCESS_KEY?.trim()
    && env.ARK_ASSET_SECRET_KEY?.trim()
    && env.ARK_ASSET_GROUP_ID?.trim(),
  );
}

function encodeQueryComponent(value: string): string {
  return encodeURIComponent(value)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}

function canonicalQuery(parameters: Record<string, string>): string {
  return Object.keys(parameters)
    .sort()
    .map((key) => `${encodeQueryComponent(key)}=${encodeQueryComponent(parameters[key])}`)
    .join("&");
}

function hashHex(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string): Buffer {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
}

function signingKey(secretKey: string, shortDate: string, region: string, service: string): Buffer {
  const dateKey = hmac(secretKey, shortDate);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  return hmac(serviceKey, "request");
}

function canonicalHeaders(headers: Record<string, string>) {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value.trim()]),
  );
  const keys = Object.keys(normalized).sort();
  return {
    block: keys.map((key) => `${key}:${normalized[key]}\n`).join(""),
    signed: keys.join(";"),
  };
}

export function createSignedAssetRequest(
  action: string,
  payload: Record<string, unknown>,
  config: BytePlusAssetConfig,
  date = new Date(),
): SignedAssetRequest {
  const body = JSON.stringify(payload);
  const xDate = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const shortDate = xDate.slice(0, 8);
  const bodyHash = hashHex(body);
  const query = canonicalQuery({ Action: action, Version: config.version });
  const headersToSign = {
    "Content-Type": "application/json",
    Host: config.host,
    "X-Content-Sha256": bodyHash,
    "X-Date": xDate,
  };
  const canonical = canonicalHeaders(headersToSign);
  const canonicalRequest = [
    "POST",
    "/",
    query,
    canonical.block,
    canonical.signed,
    bodyHash,
  ].join("\n");
  const credentialScope = `${shortDate}/${config.region}/${config.service}/request`;
  const stringToSign = [
    ALGORITHM,
    xDate,
    credentialScope,
    hashHex(canonicalRequest),
  ].join("\n");
  const signature = crypto
    .createHmac("sha256", signingKey(config.secretKey, shortDate, config.region, config.service))
    .update(stringToSign, "utf8")
    .digest("hex");

  return {
    url: `https://${config.host}/?${query}`,
    body,
    headers: {
      ...headersToSign,
      Authorization: `${ALGORITHM} Credential=${config.accessKey}/${credentialScope}, SignedHeaders=${canonical.signed}, Signature=${signature}`,
    },
  };
}

function publicProviderError(action: string, response: ArkResponse<unknown>, status?: number): Error {
  const metadata = response.ResponseMetadata;
  const providerError = metadata?.Error;
  const statusLabel = status ? `（HTTP ${status}）` : "";
  const code = providerError?.Code ? `${providerError.Code}: ` : "";
  const requestId = metadata?.RequestId ? `，request_id=${metadata.RequestId}` : "";
  return new Error(`${action} 失败${statusLabel}：${code}${providerError?.Message || "海外资产库返回未知错误"}${requestId}`);
}

export async function callBytePlusAssetAction<T>(
  action: string,
  payload: Record<string, unknown>,
  config = getBytePlusAssetConfig(),
): Promise<T> {
  const request = createSignedAssetRequest(action, payload, config);
  const response = await fetch(request.url, {
    method: "POST",
    headers: request.headers,
    body: request.body,
    signal: AbortSignal.timeout(60_000),
  });
  const raw = await response.text();
  let parsed: ArkResponse<T>;
  try {
    parsed = raw ? JSON.parse(raw) as ArkResponse<T> : {};
  } catch {
    throw new Error(`${action} 失败（HTTP ${response.status}）：海外资产库返回了非 JSON 响应。`);
  }
  if (!response.ok || parsed.ResponseMetadata?.Error) {
    throw publicProviderError(action, parsed, response.status);
  }
  return (parsed.Result || {}) as T;
}

export async function getBytePlusAssetGroup(config = getBytePlusAssetConfig()) {
  return callBytePlusAssetAction<Record<string, unknown>>("GetAssetGroup", { Id: config.groupId }, config);
}

export async function listBytePlusAssets(config = getBytePlusAssetConfig()) {
  return callBytePlusAssetAction<{ Items?: BytePlusAssetItem[]; TotalCount?: number }>(
    "ListAssets",
    {
      Filter: {
        GroupType: "AIGC",
        GroupIds: [config.groupId],
      },
      PageNumber: 1,
      PageSize: 100,
      SortBy: "CreateTime",
      SortOrder: "Desc",
      ProjectName: "default",
    },
    config,
  );
}

export async function createBytePlusImageAsset(
  url: string,
  name: string,
  config = getBytePlusAssetConfig(),
  contentType = "image/jpeg",
) {
  const result = await callBytePlusAssetAction<{ Id?: string; AssetId?: string }>(
    "CreateAsset",
    {
      GroupId: config.groupId,
      Name: name,
      AssetType: "Image",
      ContentType: contentType,
      URL: url,
      ProjectName: "default",
    },
    config,
  );
  const assetId = result.Id || result.AssetId;
  if (!assetId) throw new Error("CreateAsset 成功，但海外资产库没有返回资产 ID。");
  return assetId;
}

export async function getBytePlusAsset(assetId: string, config = getBytePlusAssetConfig()) {
  return callBytePlusAssetAction<BytePlusAssetItem>("GetAsset", { Id: assetId }, config);
}

export async function waitForBytePlusAsset(
  assetId: string,
  config = getBytePlusAssetConfig(),
  timeoutMs = 180_000,
) {
  const deadline = Date.now() + timeoutMs;
  let latest: BytePlusAssetItem = {};
  while (Date.now() < deadline) {
    latest = await getBytePlusAsset(assetId, config);
    if (latest.Status === "Active") return latest;
    if (latest.Status === "Failed") {
      const code = latest.Error?.Code ? `${latest.Error.Code}: ` : "";
      throw new Error(`虚拟人物资产审核失败：${code}${latest.Error?.Message || "未知原因"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  throw new Error(`虚拟人物资产等待审核超时：${assetId}（当前状态 ${latest.Status || "未知"}）`);
}

export function toAssetUri(assetId: string): string {
  return assetId.startsWith("asset://") ? assetId : `asset://${assetId}`;
}
