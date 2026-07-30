import crypto from "node:crypto";
import { z } from "zod";

export const PRODUCTION_CONTRACT_VERSION = "0.1" as const;
export const D1_FIXTURE_ID = "demo-local-001" as const;
export const D1_SOURCE_SUITE_DIGEST =
  "sha256:ecb4856cbceb568b931360335822e3beb590b6a8feefa07e773f3813d2552823" as const;
export const D1_PACKAGE_DIGEST =
  "sha256:113bf8ae7b01c5b6328a59afd4d9d0b3c20b8f8978901b1ab2c74e3a2b75d645" as const;

const id = z.string().trim().min(1).max(300);
const isoTimestamp = z.string().datetime({ offset: true });

const claimSchema = z.object({
  id,
  text: z.string().min(1),
  type: z.enum(["fact", "price", "service", "policy", "disclaimer"]),
  source: z.string().min(1),
  status: z.literal("approved"),
  confidence: z.number().min(0).max(1),
}).strict();

const scriptBlockSchema = z.object({
  id,
  type: z.enum(["hook", "body", "proof", "cta", "disclaimer"]),
  content: z.string().min(1),
  duration: z.number().positive(),
  claimIds: z.array(id),
  comments: z.array(z.unknown()),
  riskLevel: z.enum(["none", "low", "medium", "high"]),
}).strict();

const shotDraftSchema = z.object({
  id,
  order: z.number().int().positive(),
  duration: z.number().positive(),
  description: z.string().min(1),
  shotType: z.string().min(1),
  cameraPosition: z.string().min(1),
  narration: z.string(),
  screenText: z.string(),
  sourceType: z.enum(["upload", "shoot", "ai"]),
  riskLevel: z.enum(["none", "low", "medium", "high"]),
  status: z.enum(["done", "shooting", "missing"]),
  assignee: z.string().min(1),
  assetId: id.optional(),
  matchStatus: z.enum(["matched", "reshoot", "missing"]),
}).strict();

const capabilityGrantSchema = z.object({
  capabilityId: id,
  entitlementId: id,
  constraints: z.object({
    projectId: id,
    maxDurationSeconds: z.number().positive(),
    aspectRatio: z.string().min(1),
  }).strict(),
}).strict();

export const projectProductionPackageSchema = z.object({
  packageId: id,
  packageVersion: z.number().int().positive(),
  contractVersion: z.literal(PRODUCTION_CONTRACT_VERSION),
  tenantId: id,
  organizationId: id,
  organizationType: z.literal("TENANT"),
  projectId: id,
  brandId: id,
  storeId: id,
  campaignId: id,
  agentTemplateCode: id,
  creativeBriefSnapshot: z.object({
    projectId: id,
    businessType: id,
    merchantName: z.string().min(1),
    city: z.string().min(1),
    address: z.string().min(1),
    platforms: z.array(z.string().min(1)).min(1),
    aspectRatio: z.string().min(1),
    duration: z.number().positive(),
    targetAudience: z.array(z.string().min(1)),
    cta: z.string().min(1),
    assetIds: z.array(id),
    notes: z.string(),
    restrictions: z.array(z.string().min(1)),
  }).strict(),
  brandFactsSnapshot: z.array(claimSchema).length(8),
  riskRulesSnapshot: z.object({
    prohibitedWords: z.array(z.string().min(1)),
    restrictions: z.array(z.string().min(1)),
    requiredClaimIds: z.array(id).length(8),
  }).strict(),
  approvedScriptVersion: z.object({
    id,
    name: z.string().min(1),
    score: z.number(),
    estimatedDuration: z.number().positive(),
    createdAt: isoTimestamp,
    citations: z.array(id),
    blocks: z.array(scriptBlockSchema).min(1),
    approvalStatus: z.literal("approved"),
    approvedAt: isoTimestamp,
    approvedBy: id,
  }).strict(),
  shotDrafts: z.array(shotDraftSchema).length(8),
  target: z.object({
    platform: z.string().min(1),
    aspectRatio: z.string().min(1),
    durationSeconds: z.number().positive(),
  }).strict(),
  capabilityGrants: z.array(capabilityGrantSchema).min(1),
  sourceVersions: z.object({
    demoWorkspace: z.string().min(1),
    project: z.number().int().positive(),
    brief: z.number().int().positive(),
    brand: z.number().int().positive(),
    script: z.number().int().positive(),
    storyboard: z.number().int().positive(),
  }).strict(),
  idempotencyKey: id,
  createdAt: isoTimestamp,
  expiresAt: isoTimestamp,
  truthMode: z.literal("MOCK-CONTRACT"),
  digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict();

export const demoProjectGrantSchema = z.object({
  grantId: id,
  grantType: z.literal("DEMO_PROJECT_GRANT"),
  mock: z.literal(true),
  truthMode: z.literal("MOCK-CONTRACT"),
  tenantId: id,
  organizationId: id,
  organizationType: z.literal("TENANT"),
  projectId: id,
  packageId: id,
  packageVersion: z.number().int().positive(),
  capabilityIds: z.array(id).min(1),
  scopes: z.array(z.enum(["production.package.read", "production.receipt.write"])).min(1),
  issuedAt: isoTimestamp,
  expiresAt: isoTimestamp,
  mockHandle: z.string().startsWith("mock-handle:"),
  warning: z.string().min(1),
}).strict();

const demoCreditsSchema = z.object({
  value: z.number().int().nonnegative(),
  unit: z.literal("AI_VIDEO_CREDIT"),
  dataMode: z.literal("DEMO"),
  quoteStatus: z.literal("NON_QUOTE"),
  label: z.literal("演示数据 · 非正式报价"),
}).strict();

export const generationTaskReceiptSchema = z.object({
  contractVersion: z.literal(PRODUCTION_CONTRACT_VERSION),
  generationTaskId: id,
  tenantId: id,
  projectId: id,
  shotId: id,
  taskType: z.enum(["image.generate", "video.generate"]),
  capabilityId: id,
  provider: id,
  model: id,
  status: z.enum(["succeeded", "failed"]),
  progress: z.literal(100),
  inputDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  referenceAssetIds: z.array(id),
  reservationReference: id,
  actualCredits: demoCreditsSchema.nullable(),
  outputAssetIds: z.array(id),
  error: z.object({
    code: id,
    message: z.string().min(1),
    retryable: z.boolean(),
    details: z.record(z.string(), z.unknown()),
  }).strict().nullable(),
  createdAt: isoTimestamp,
  startedAt: isoTimestamp,
  completedAt: isoTimestamp,
  idempotencyKey: id,
  truthMode: z.literal("MOCK-CONTRACT"),
}).strict().superRefine((receipt, context) => {
  if (receipt.status === "succeeded" && (!receipt.outputAssetIds.length || receipt.error)) {
    context.addIssue({ code: "custom", message: "成功任务必须有输出资产且不能有错误" });
  }
  if (receipt.status === "failed" && (receipt.outputAssetIds.length || !receipt.error || receipt.actualCredits)) {
    context.addIssue({ code: "custom", message: "失败任务不得伪造输出资产或消费额度" });
  }
});

export const assetReceiptSchema = z.object({
  contractVersion: z.literal(PRODUCTION_CONTRACT_VERSION),
  assetId: id,
  tenantId: id,
  projectId: id,
  shotId: id,
  type: z.enum(["image", "video", "export"]),
  mimeType: z.string().min(1),
  dimensions: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }).strict(),
  durationSeconds: z.number().nonnegative(),
  checksum: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  source: id,
  model: id,
  generationTaskId: id,
  promptDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  storageReference: z.string().min(1),
  rightsNote: z.string().min(1),
  reviewStatus: z.enum(["registered", "approved", "qa_blocked"]),
  version: z.number().int().positive(),
  idempotencyKey: id,
  createdAt: isoTimestamp,
  truthMode: z.literal("MOCK-CONTRACT"),
}).strict();

export type ProjectProductionPackage = z.infer<typeof projectProductionPackageSchema>;
export type DemoProjectGrant = z.infer<typeof demoProjectGrantSchema>;
export type GenerationTaskReceipt = z.infer<typeof generationTaskReceiptSchema>;
export type AssetReceipt = z.infer<typeof assetReceiptSchema>;

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

export function digestValue(value: unknown): string {
  return `sha256:${crypto.createHash("sha256").update(canonicalize(value)).digest("hex")}`;
}

const forbiddenPackageKeys = new Set([
  "wallet",
  "creditLedger",
  "rateCard",
  "customerPrice",
  "customerRetailPrice",
  "providerKey",
  "upstreamApiKey",
  "accessToken",
  "mockHandle",
]);

export function assertPackageContract(value: unknown): ProjectProductionPackage {
  assertNoForbiddenPackageData(value);
  const productionPackage = projectProductionPackageSchema.parse(value);
  if (productionPackage.projectId !== D1_FIXTURE_ID) {
    throw new ProductionContractError("PROJECT_SCOPE_MISMATCH", "只接受 canonical demo-local-001 项目");
  }
  if (
    productionPackage.tenantId !== "tenant-demo-hdl"
    || productionPackage.organizationId !== productionPackage.tenantId
  ) {
    throw new ProductionContractError("TENANT_SCOPE_MISMATCH", "D1 tenant/organization scope 不一致");
  }
  if (productionPackage.creativeBriefSnapshot.projectId !== productionPackage.projectId) {
    throw new ProductionContractError("PROJECT_SCOPE_MISMATCH", "Brief projectId 与包不一致");
  }
  const claims = productionPackage.brandFactsSnapshot.map((claim) => claim.id).join(",");
  if (claims !== "C1,C2,C3,C4,C5,C6,C7,C8") {
    throw new ProductionContractError("PACKAGE_SCHEMA_INVALID", "必须包含 canonical C1-C8 Claim");
  }
  if (productionPackage.riskRulesSnapshot.requiredClaimIds.join(",") !== claims) {
    throw new ProductionContractError("PACKAGE_SCHEMA_INVALID", "风险规则 Claim 集与包不一致");
  }
  const capabilityIds = productionPackage.capabilityGrants.map((grant) => grant.capabilityId).join(",");
  if (
    capabilityIds !== "cap-production-base-generation,cap-agent-local-life"
    || productionPackage.capabilityGrants.some(
      (grant) => grant.constraints.projectId !== productionPackage.projectId,
    )
  ) {
    throw new ProductionContractError("CAPABILITY_SCOPE_DENIED", "D1 capability grants 或 project constraint 不一致");
  }
  if (
    productionPackage.target.aspectRatio !== productionPackage.creativeBriefSnapshot.aspectRatio
    || productionPackage.target.durationSeconds !== productionPackage.creativeBriefSnapshot.duration
  ) {
    throw new ProductionContractError("PACKAGE_SCHEMA_INVALID", "目标比例/时长与 Brief 不一致");
  }
  if (productionPackage.approvedScriptVersion.id !== "script-a") {
    throw new ProductionContractError("PACKAGE_SCHEMA_INVALID", "D1 只接受批准脚本 script-a");
  }
  if (productionPackage.shotDrafts.map((shot) => shot.id).join(",") !==
    "shot-01,shot-02,shot-03,shot-04,shot-05,shot-06,shot-07,shot-08") {
    throw new ProductionContractError("PACKAGE_SCHEMA_INVALID", "D1 必须包含有序的 shot-01 至 shot-08");
  }
  if (canonicalize(productionPackage).includes("南城咖啡")) {
    throw new ProductionContractError("SECOND_SOURCE_OF_TRUTH", "生产包不得包含历史南城咖啡 fixture");
  }
  const { digest, ...unsignedPackage } = productionPackage;
  if (digest !== digestValue(unsignedPackage)) {
    throw new ProductionContractError("PACKAGE_DIGEST_MISMATCH", "包 digest 与 canonical 内容不一致");
  }
  return productionPackage;
}

function assertNoForbiddenPackageData(value: unknown, path = "package") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenPackageData(item, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (forbiddenPackageKeys.has(key)) {
      throw new ProductionContractError("FORBIDDEN_PACKAGE_FIELD", `${path}.${key} 禁止进入生产包`);
    }
    assertNoForbiddenPackageData(child, `${path}.${key}`);
  }
}

export function assertGrantScope(
  grantValue: unknown,
  productionPackage: ProjectProductionPackage,
  requiredCapabilityId: string,
  requiredScopes: Array<"production.package.read" | "production.receipt.write">,
  now = new Date(),
): DemoProjectGrant {
  const grant = demoProjectGrantSchema.parse(grantValue);
  if (
    grant.grantId !== "grant-demo-local-001-v1"
    || grant.mockHandle !== "mock-handle:grant-demo-local-001-v1"
    || grant.capabilityIds.join(",") !== "cap-production-base-generation"
    || grant.scopes.join(",") !== "production.package.read,production.receipt.write"
  ) {
    throw new ProductionContractError(
      "GRANT_SCOPE_MISMATCH",
      "D1 Mock grant 必须与 canonical non-secret handle 和最小 scope 完全一致",
    );
  }
  if (
    grant.tenantId !== productionPackage.tenantId
    || grant.organizationId !== productionPackage.organizationId
    || grant.projectId !== productionPackage.projectId
    || grant.packageId !== productionPackage.packageId
    || grant.packageVersion !== productionPackage.packageVersion
  ) {
    throw new ProductionContractError("GRANT_SCOPE_MISMATCH", "Mock grant 与 tenant/project/package scope 不一致");
  }
  if (!grant.capabilityIds.includes(requiredCapabilityId)) {
    throw new ProductionContractError("CAPABILITY_SCOPE_DENIED", `Mock grant 未授权 ${requiredCapabilityId}`);
  }
  if (!productionPackage.capabilityGrants.some((item) => item.capabilityId === requiredCapabilityId)) {
    throw new ProductionContractError("CAPABILITY_NOT_ENTITLED", `生产包不包含 ${requiredCapabilityId}`);
  }
  if (requiredScopes.some((scope) => !grant.scopes.includes(scope))) {
    throw new ProductionContractError("GRANT_SCOPE_MISMATCH", "Mock grant 缺少所需 scope");
  }
  if (Date.parse(grant.expiresAt) - Date.parse(grant.issuedAt) !== 15 * 60 * 1000) {
    throw new ProductionContractError("GRANT_TTL_INVALID", "D1 Mock grant 必须保持 deterministic 15 分钟 TTL");
  }
  const nowMs = now.getTime();
  const issuedAtMs = Date.parse(grant.issuedAt);
  const expiresAtMs = Date.parse(grant.expiresAt);
  if (issuedAtMs > nowMs + 30_000) {
    throw new ProductionContractError("GRANT_NOT_YET_VALID", "Mock grant 尚未生效");
  }
  if (expiresAtMs <= nowMs) {
    throw new ProductionContractError("GRANT_EXPIRED", "Mock grant 已过期，必须由控制平面重新签发");
  }
  const packageCreatedAtMs = Date.parse(productionPackage.createdAt);
  const packageExpiresAtMs = Date.parse(productionPackage.expiresAt);
  if (packageCreatedAtMs > nowMs + 30_000) {
    throw new ProductionContractError("PACKAGE_NOT_YET_VALID", "生产包尚未生效");
  }
  if (packageExpiresAtMs <= nowMs) {
    throw new ProductionContractError("PACKAGE_EXPIRED", "生产包已过期，禁止新的生产动作");
  }
  if (issuedAtMs < packageCreatedAtMs || expiresAtMs > packageExpiresAtMs) {
    throw new ProductionContractError("GRANT_PACKAGE_TIME_MISMATCH", "Grant 有效期必须位于生产包有效期内");
  }
  return grant;
}

export class ProductionContractError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ProductionContractError";
  }
}
