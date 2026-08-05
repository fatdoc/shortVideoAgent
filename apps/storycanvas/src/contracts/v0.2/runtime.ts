import crypto from "node:crypto";
import contractSchema from "./pilot-contract-v0.2.schema.json";
import safetyPolicy from "./error-safety-policy.json";

type JsonRecord = Record<string, unknown>;
type JsonSchema = JsonRecord;

export const PILOT_CONTRACT_VERSION = "0.2" as const;
export const PILOT_CONTRACT_SCHEMA_SOURCE_SHA256 = "aa4857e680838126d5a1bcddf6c7c7a12147bc3bf549eaac5751c2dac254005e";
export const PILOT_ERROR_POLICY_SOURCE_SHA256 = "7102caa9446166c8df864077e121caf96c3a644f60a8dcf8fd60ed7fe32e9f73";

export const pilotObjectDefinitions = {
  ProjectProductionPackage: "projectProductionPackage",
  ProjectGrant: "projectGrant",
  GenerationTaskCommand: "generationTaskCommand",
  TaskReceipt: "taskReceipt",
  AssetReceipt: "assetReceipt",
  ExportReceipt: "exportReceipt",
  UsageReceipt: "usageReceipt",
  StandardError: "standardError",
  ReceiptAck: "receiptAck",
} as const;

export type PilotObjectType = keyof typeof pilotObjectDefinitions;

export interface ContractValidationIssue {
  path: string;
  message: string;
}

export class PilotContractValidationError extends Error {
  constructor(readonly issues: ContractValidationIssue[]) {
    super("Request cannot be accepted.");
    this.name = "PilotContractValidationError";
  }
}

function record(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as JsonRecord)
    .filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
    .join(",")}}`;
}

export function contractPayloadDigest(value: unknown): string {
  const unsigned = structuredClone(value) as JsonRecord;
  delete unsigned.payloadDigest;
  return `sha256:${crypto.createHash("sha256").update(canonicalJson(unsigned)).digest("hex")}`;
}

export function tokenDigest(token: string): string {
  return `sha256:${crypto.createHash("sha256").update(token).digest("hex")}`;
}

function resolvePointer(pointer: string): JsonSchema {
  if (!pointer.startsWith("#/")) throw new Error(`unsupported schema reference ${pointer}`);
  let current: unknown = contractSchema;
  for (const raw of pointer.slice(2).split("/")) {
    const part = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!record(current) || !(part in current)) throw new Error(`unknown schema reference ${pointer}`);
    current = current[part];
  }
  if (!record(current)) throw new Error(`schema reference is not an object ${pointer}`);
  return current;
}

function deepEqual(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function matchesType(value: unknown, type: string): boolean {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return record(value);
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  return typeof value === type;
}

function allowedProperties(schema: JsonSchema, visited = new Set<JsonSchema>()): Set<string> {
  if (visited.has(schema)) return new Set();
  visited.add(schema);
  const result = new Set<string>();
  if (typeof schema.$ref === "string") {
    for (const key of allowedProperties(resolvePointer(schema.$ref), visited)) result.add(key);
  }
  if (record(schema.properties)) Object.keys(schema.properties).forEach((key) => result.add(key));
  if (Array.isArray(schema.allOf)) {
    for (const child of schema.allOf) {
      if (record(child)) for (const key of allowedProperties(child, visited)) result.add(key);
    }
  }
  return result;
}

function validateSchema(value: unknown, schema: JsonSchema, path: string): ContractValidationIssue[] {
  const issues: ContractValidationIssue[] = [];
  const issue = (message: string, childPath = path) => issues.push({ path: childPath, message });

  if (typeof schema.$ref === "string") issues.push(...validateSchema(value, resolvePointer(schema.$ref), path));
  if (Array.isArray(schema.allOf)) {
    for (const child of schema.allOf) if (record(child)) issues.push(...validateSchema(value, child, path));
  }
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter((child) => record(child) && validateSchema(value, child, path).length === 0).length;
    if (matches !== 1) issue("must match exactly one allowed schema");
  }
  if (record(schema.if) && validateSchema(value, schema.if, path).length === 0 && record(schema.then)) {
    issues.push(...validateSchema(value, schema.then, path));
  }

  if (Object.hasOwn(schema, "const") && !deepEqual(value, schema.const)) issue("does not match the required constant");
  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => deepEqual(value, candidate))) issue("is not an allowed value");

  const declaredTypes = Array.isArray(schema.type)
    ? schema.type.filter((item): item is string => typeof item === "string")
    : typeof schema.type === "string" ? [schema.type] : [];
  if (declaredTypes.length && !declaredTypes.some((type) => matchesType(value, type))) {
    issue(`must be ${declaredTypes.join(" or ")}`);
    return issues;
  }
  if (value === null) return issues;

  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) issue("is too short");
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) issue("is too long");
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern, "u").test(value)) issue("has an invalid format");
    if (schema.format === "date-time") {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) {
        issue("must be an UTC ISO date-time");
      }
    }
  }

  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) issue("is below the minimum");
    if (typeof schema.maximum === "number" && value > schema.maximum) issue("is above the maximum");
    if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) issue("must be above the minimum");
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) issue("has too few items");
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) issue("has too many items");
    if (schema.uniqueItems === true && new Set(value.map(canonicalJson)).size !== value.length) issue("contains duplicate items");
    if (record(schema.items)) value.forEach((item, index) => issues.push(...validateSchema(item, schema.items as JsonSchema, `${path}/${index}`)));
  }

  if (record(value)) {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) if (typeof key === "string" && !Object.hasOwn(value, key)) issue("is required", `${path}/${key}`);
    }
    if (record(schema.properties)) {
      for (const [key, childSchema] of Object.entries(schema.properties)) {
        if (Object.hasOwn(value, key) && record(childSchema)) issues.push(...validateSchema(value[key], childSchema, `${path}/${key}`));
      }
    }
    if (schema.additionalProperties === false || schema.unevaluatedProperties === false) {
      const allowed = allowedProperties(schema);
      for (const key of Object.keys(value)) if (!allowed.has(key)) issue("is not allowed", `${path}/${key}`);
    }
  }
  return issues;
}

function semanticIssues(value: JsonRecord): ContractValidationIssue[] {
  const issues: ContractValidationIssue[] = [];
  const push = (path: string, message: string) => issues.push({ path, message });
  if (value.payloadDigest !== contractPayloadDigest(value)) push("/payloadDigest", "does not match the semantic payload");
  const created = typeof value.createdAt === "string" ? Date.parse(value.createdAt) : NaN;
  const expires = typeof value.expiresAt === "string" ? Date.parse(value.expiresAt) : NaN;
  if (Number.isFinite(created) && Number.isFinite(expires) && created >= expires) push("/expiresAt", "must be after createdAt");

  if (value.objectType === "ProjectProductionPackage" && Array.isArray(value.storyboard)) {
    const ids = value.storyboard.filter(record).map((shot) => shot.shotId);
    if (new Set(ids.map(String)).size !== ids.length) push("/storyboard", "shotId values must be unique");
  }
  if (value.objectType === "ProjectGrant") {
    const issued = typeof value.issuedAt === "string" ? Date.parse(value.issuedAt) : NaN;
    if (Number.isFinite(issued) && Number.isFinite(expires) && issued >= expires) push("/expiresAt", "must be after issuedAt");
  }
  if (value.objectType === "GenerationTaskCommand" && value.taskType !== value.capability) {
    push("/capability", "must equal taskType");
  }
  if (value.objectType === "AssetReceipt" && value.deliverable === true && value.reviewStatus !== "approved") {
    push("/reviewStatus", "deliverable assets must be approved");
  }
  if (value.objectType === "UsageReceipt" && record(value.customerSettlement)) {
    const eligible = value.customerSettlement.eligibility === "eligible";
    const expected = eligible ? "deliverable_asset_registered" : "no_deliverable_asset";
    if (value.customerSettlement.reason !== expected) push("/customerSettlement/reason", "does not match eligibility");
  }
  return issues;
}

function unsafePayloadIssues(value: JsonRecord): ContractValidationIssue[] {
  const issues: ContractValidationIssue[] = [];
  const forbidden = new Set(["apikey", "upstreamapikey", "providerkey", "accesstoken", "authorization", "credential", "wallet", "creditledger", "ratecard", "customerprice", "customercredits"]);
  const walk = (child: unknown, path: string) => {
    if (Array.isArray(child)) return child.forEach((item, index) => walk(item, `${path}/${index}`));
    if (!record(child)) return;
    for (const [key, nested] of Object.entries(child)) {
      if (forbidden.has(key.toLowerCase())) issues.push({ path: `${path}/${key}`, message: "contains a forbidden field" });
      walk(nested, `${path}/${key}`);
    }
  };
  walk(value, "");
  return issues;
}

function errorSafetyIssues(error: unknown, envelope: JsonRecord, path: string): ContractValidationIssue[] {
  if (!record(error) || typeof error.code !== "string" || typeof error.message !== "string" || !record(error.details)) return [];
  const issues: ContractValidationIssue[] = [];
  const policy = safetyPolicy as {
    maxMessageLength: number;
    maxDetailStringLength: number;
    allowedDetailKeys: string[];
    messageCatalog: Record<string, string[]>;
    valueRules: Array<{ id: string; pattern: string }>;
    tenantIdentifierPattern: string;
  };
  if (!(policy.messageCatalog[error.code] ?? []).includes(error.message)) issues.push({ path: `${path}/message`, message: "is not in the external message catalog" });
  for (const key of Object.keys(error.details)) if (!policy.allowedDetailKeys.includes(key)) issues.push({ path: `${path}/details/${key}`, message: "is not allowlisted" });
  const strings: Array<{ path: string; value: string }> = [{ path: `${path}/message`, value: error.message }];
  const collect = (child: unknown, childPath: string) => {
    if (typeof child === "string") strings.push({ path: childPath, value: child });
    else if (Array.isArray(child)) child.forEach((item, index) => collect(item, `${childPath}/${index}`));
    else if (record(child)) Object.entries(child).forEach(([key, nested]) => collect(nested, `${childPath}/${key}`));
  };
  collect(error.details, `${path}/details`);
  for (const item of strings) {
    const max = item.path.endsWith("/message") ? policy.maxMessageLength : policy.maxDetailStringLength;
    if (item.value.length > max) issues.push({ path: item.path, message: "exceeds the safe length" });
    for (const rule of policy.valueRules) if (new RegExp(rule.pattern, "iu").test(item.value)) issues.push({ path: item.path, message: `contains denied content (${rule.id})` });
    const tenants = item.value.match(new RegExp(policy.tenantIdentifierPattern, "giu")) ?? [];
    if (tenants.some((tenant) => tenant.toLowerCase() !== String(envelope.tenantId).toLowerCase())) issues.push({ path: item.path, message: "contains a cross-tenant identifier" });
  }
  return issues;
}

function nestedError(value: JsonRecord): { error: unknown; path: string } | undefined {
  if (value.objectType === "StandardError") return { error: value.error, path: "/error" };
  if (["TaskReceipt", "ExportReceipt", "ReceiptAck"].includes(String(value.objectType)) && value.error !== null) return { error: value.error, path: "/error" };
  return undefined;
}

export function contractValidationIssues(value: unknown, expectedType?: PilotObjectType): ContractValidationIssue[] {
  if (!record(value)) return [{ path: "", message: "must be an object" }];
  const objectType = value.objectType;
  if (typeof objectType !== "string" || !(objectType in pilotObjectDefinitions)) return [{ path: "/objectType", message: "is not registered" }];
  if (expectedType && objectType !== expectedType) return [{ path: "/objectType", message: `must be ${expectedType}` }];
  const definition = (pilotObjectDefinitions as Record<string, string>)[objectType];
  const issues = validateSchema(value, resolvePointer(`#/$defs/${definition}`), "");
  issues.push(...semanticIssues(value), ...unsafePayloadIssues(value));
  const error = nestedError(value);
  if (error) issues.push(...errorSafetyIssues(error.error, value, error.path));
  return issues;
}

export function assertContractObject<T extends JsonRecord = JsonRecord>(value: unknown, expectedType?: PilotObjectType): T {
  const issues = contractValidationIssues(value, expectedType);
  if (issues.length) throw new PilotContractValidationError(issues);
  return value as T;
}
