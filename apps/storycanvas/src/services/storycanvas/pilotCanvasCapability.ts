import crypto from "node:crypto";
import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response as ExpressResponse } from "express";
import { z } from "zod";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HANDLE_PATTERN = /^ce_[A-Za-z0-9_-]{32,64}$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const CSRF_HEADER_VALUE = "pilot-canvas-bootstrap-v1";
const REDEMPTION_PATH = "/api/v1/internal/canvas-entries/redeem";
const SESSION_REGISTRATION_PATH = "/api/v1/internal/canvas-asset-sessions";
const SESSION_PATH = "/api/v1/auth/session";
const capabilityValues = ["image.generate", "video.generate", "audio.tts", "media.export"] as const;
const scopeValues = ["production.package.read", "production.task.write", "production.receipt.write", "production.asset.write", "production.export.write"] as const;

const uuid = z.string().regex(UUID_PATTERN);
const timestamp = z.string().refine((value) => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
});
const digest = z.string().regex(DIGEST_PATTERN);
const nonEmpty = z.string().min(1).refine((value) => value.trim().length > 0);
const idempotencyKey = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/);
const bindingFields = { tenantId: uuid, projectId: uuid, packageId: uuid } as const;

export const pilotCanvasEntryReferenceSchema = z.object({ handle: z.string().regex(HANDLE_PATTERN), ...bindingFields }).strict();
const capabilityArray = z.array(z.enum(capabilityValues)).min(1).refine((value) => new Set(value).size === value.length);
const scopeArray = z.array(z.enum(scopeValues)).min(1).refine((value) => new Set(value).size === value.length);
export const projectProductionPackageV03Schema = z.object({
  objectType: z.literal("ProjectProductionPackage"), contractVersion: z.literal("0.3"), status: z.literal("ready"), ...bindingFields,
  idempotencyKey, occurredAt: timestamp, payloadDigest: digest, packageVersion: z.number().int().positive(), organizationId: uuid,
  scriptVersionId: uuid, storyboardVersionId: uuid, approvedScriptDigest: digest, approvedStoryboardDigest: digest,
  briefSnapshot: z.object({ briefVersionId: uuid, objective: nonEmpty, audience: z.array(nonEmpty).min(1), platforms: z.array(nonEmpty).min(1) }).strict(),
  brandPolicySnapshot: z.object({
    facts: z.array(z.object({ factId: nonEmpty, text: nonEmpty, sourceReference: nonEmpty, approved: z.literal(true) }).strict()),
    prohibitedTerms: z.array(nonEmpty), requiredDisclosures: z.array(nonEmpty), sourceDigest: digest,
  }).strict(),
  approvedScript: z.object({ scriptVersionId: uuid, payloadDigest: digest, content: nonEmpty, approvedAt: timestamp, approvedBy: uuid }).strict(),
  approvedStoryboard: z.object({ storyboardVersionId: uuid, scriptVersionId: uuid, scriptPayloadDigest: digest, payloadDigest: digest, approvedAt: timestamp, approvedBy: uuid }).strict(),
  storyboard: z.array(z.object({ shotId: nonEmpty, sequence: z.number().int().positive(), description: nonEmpty, durationSeconds: z.number().positive(), sourceMode: z.enum(["uploaded", "generated", "mixed"]) }).strict()).min(1),
  target: z.object({ aspectRatio: nonEmpty, durationSeconds: z.number().positive(), container: z.literal("mp4"), videoCodec: z.literal("h264") }).strict(),
  capabilityRequirements: capabilityArray, createdAt: timestamp, expiresAt: timestamp,
}).strict().superRefine((value, context) => {
  if (value.payloadDigest !== contractDigest(value as unknown as Record<string, unknown>)) context.addIssue({ code: "custom", path: ["payloadDigest"], message: "digest mismatch" });
  if (Date.parse(value.expiresAt) <= Date.parse(value.createdAt)) context.addIssue({ code: "custom", path: ["expiresAt"], message: "expiry invalid" });
  if (value.approvedScript.scriptVersionId !== value.scriptVersionId || value.approvedScript.payloadDigest !== value.approvedScriptDigest) context.addIssue({ code: "custom", path: ["approvedScript"], message: "script binding mismatch" });
  if (value.approvedStoryboard.storyboardVersionId !== value.storyboardVersionId || value.approvedStoryboard.scriptVersionId !== value.scriptVersionId || value.approvedStoryboard.scriptPayloadDigest !== value.approvedScriptDigest || value.approvedStoryboard.payloadDigest !== value.approvedStoryboardDigest) context.addIssue({ code: "custom", path: ["approvedStoryboard"], message: "storyboard binding mismatch" });
  const shotIds = new Set<string>();
  value.storyboard.forEach((shot, index) => {
    if (shot.sequence !== index + 1 || shotIds.has(shot.shotId)) context.addIssue({ code: "custom", path: ["storyboard", index], message: "shot binding mismatch" });
    shotIds.add(shot.shotId);
  });
});
export const projectGrantV02Schema = z.object({
  objectType: z.literal("ProjectGrant"), contractVersion: z.literal("0.2"), ...bindingFields, idempotencyKey, occurredAt: timestamp,
  payloadDigest: digest, grantId: uuid, capabilities: capabilityArray, scopes: scopeArray, tokenDigest: digest,
  keyId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/), issuedAt: timestamp, expiresAt: timestamp,
}).strict().superRefine((value, context) => {
  if (value.payloadDigest !== contractDigest(value as unknown as Record<string, unknown>)) context.addIssue({ code: "custom", path: ["payloadDigest"], message: "digest mismatch" });
  if (Date.parse(value.expiresAt) <= Date.parse(value.issuedAt)) context.addIssue({ code: "custom", path: ["expiresAt"], message: "expiry invalid" });
});
export const canvasEntryRedemptionV01Schema = z.object({
  objectType: z.literal("CanvasEntryRedemption"), contractVersion: z.literal("0.1"), handle: z.string().regex(HANDLE_PATTERN), ...bindingFields,
  consumedAt: timestamp, productionPackage: projectProductionPackageV03Schema, grant: projectGrantV02Schema, tokenType: z.literal("Bearer"), accessToken: z.string().regex(TOKEN_PATTERN), replayed: z.boolean(),
}).strict().superRefine((value, context) => {
  const bindings = [value, value.productionPackage, value.grant];
  if (!bindings.every((record) => record.tenantId === value.tenantId && record.projectId === value.projectId && record.packageId === value.packageId)) context.addIssue({ code: "custom", path: ["productionPackage"], message: "scope mismatch" });
  if (value.productionPackage.organizationId !== value.tenantId) context.addIssue({ code: "custom", path: ["productionPackage", "organizationId"], message: "tenant mismatch" });
  if (value.grant.capabilities.some((item) => !value.productionPackage.capabilityRequirements.includes(item))) context.addIssue({ code: "custom", path: ["grant", "capabilities"], message: "capability mismatch" });
  if (value.grant.tokenDigest !== `sha256:${sha256(value.accessToken)}`) context.addIssue({ code: "custom", path: ["accessToken"], message: "token mismatch" });
  const consumedAt = Date.parse(value.consumedAt);
  if (consumedAt < Date.parse(value.grant.issuedAt) || consumedAt >= Date.parse(value.grant.expiresAt) || consumedAt < Date.parse(value.productionPackage.createdAt) || consumedAt >= Date.parse(value.productionPackage.expiresAt)) context.addIssue({ code: "custom", path: ["consumedAt"], message: "authority time mismatch" });
});

export type PilotCanvasEntryReference = z.infer<typeof pilotCanvasEntryReferenceSchema>;
export type PilotCanvasRedemption = z.infer<typeof canvasEntryRedemptionV01Schema>;
export type PilotCanvasFetch = (url: string | URL, init?: RequestInit) => Promise<Response>;
type SafeCode = "PILOT_CANVAS_CONFIGURATION_ERROR" | "PILOT_CANVAS_DEPENDENCY_UNAVAILABLE" | "PILOT_CANVAS_UNAUTHORIZED" | "PILOT_CANVAS_NOT_FOUND" | "PILOT_CANVAS_CONFLICT" | "PILOT_CANVAS_EXPIRED" | "PILOT_CANVAS_INVALID_RESPONSE" | "PILOT_CANVAS_INTERNAL_ERROR";

export class PilotCanvasRedemptionError extends Error {
  constructor(readonly code: SafeCode, readonly status: number, readonly retryable: boolean, readonly requestId: string | null = null) {
    super("Pilot Canvas authority could not be prepared.");
    this.name = "PilotCanvasRedemptionError";
  }
  toJSON() { return { name: this.name, code: this.code, status: this.status, retryable: this.retryable, requestId: this.requestId }; }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).filter(([, child]) => child !== undefined).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(",")}}`;
}
function sha256(value: string): string { return crypto.createHash("sha256").update(value).digest("hex"); }
function contractDigest(value: Record<string, unknown>): string { const unsigned = structuredClone(value); delete unsigned.payloadDigest; return `sha256:${sha256(canonicalJson(unsigned))}`; }
function validBaseUrl(value: string): URL | null {
  try {
    const parsed = new URL(value); const loopback = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" || parsed.hostname === "::1";
    if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.protocol !== "https:" && !(loopback && parsed.protocol === "http:"))) return null;
    return parsed;
  } catch { return null; }
}
function validOrigin(value: string): string | null {
  const parsed = validBaseUrl(value);
  return parsed && parsed.origin === value ? value : null;
}

export function parseProjectProductionPackageV03(input: unknown) {
  return projectProductionPackageV03Schema.parse(input);
}
export function parseProjectGrantV02(input: unknown) {
  return projectGrantV02Schema.parse(input);
}
export function parseCanvasEntryRedemptionV01(input: unknown) {
  return canvasEntryRedemptionV01Schema.parse(input);
}
function safeRequestId(response: Response): string | null { const value = response.headers.get("x-request-id"); return value && REQUEST_ID_PATTERN.test(value) ? value : null; }
function errorForStatus(status: number, requestId: string | null): PilotCanvasRedemptionError {
  const catalog: Record<number, [SafeCode, boolean]> = { 401: ["PILOT_CANVAS_UNAUTHORIZED", false], 404: ["PILOT_CANVAS_NOT_FOUND", false], 409: ["PILOT_CANVAS_CONFLICT", false], 410: ["PILOT_CANVAS_EXPIRED", false], 422: ["PILOT_CANVAS_INVALID_RESPONSE", false], 503: ["PILOT_CANVAS_DEPENDENCY_UNAVAILABLE", true] };
  const [code, retryable] = catalog[status] ?? ["PILOT_CANVAS_INTERNAL_ERROR", false]; return new PilotCanvasRedemptionError(code, status, retryable, requestId);
}
function assertRedemptionBindings(value: PilotCanvasRedemption, entry: PilotCanvasEntryReference): void {
  const records = [value, value.productionPackage, value.grant];
  const exact = value.handle === entry.handle && records.every((record) => record.tenantId === entry.tenantId && record.projectId === entry.projectId && record.packageId === entry.packageId);
  const packageDigestValid = value.productionPackage.payloadDigest === contractDigest(value.productionPackage as unknown as Record<string, unknown>);
  const grantDigestValid = value.grant.payloadDigest === contractDigest(value.grant as unknown as Record<string, unknown>);
  const tokenDigestValid = value.grant.tokenDigest === `sha256:${sha256(value.accessToken)}`;
  const authorityValid = value.productionPackage.organizationId === entry.tenantId && value.productionPackage.approvedScript.scriptVersionId === value.productionPackage.scriptVersionId && value.productionPackage.approvedScript.payloadDigest === value.productionPackage.approvedScriptDigest && value.productionPackage.approvedStoryboard.storyboardVersionId === value.productionPackage.storyboardVersionId && value.productionPackage.approvedStoryboard.scriptVersionId === value.productionPackage.scriptVersionId && value.productionPackage.approvedStoryboard.scriptPayloadDigest === value.productionPackage.approvedScriptDigest && value.productionPackage.approvedStoryboard.payloadDigest === value.productionPackage.approvedStoryboardDigest;
  const capabilityValid = value.grant.capabilities.every((item) => value.productionPackage.capabilityRequirements.includes(item));
  const consumedAt = Date.parse(value.consumedAt); const timeValid = consumedAt >= Date.parse(value.grant.issuedAt) && consumedAt < Date.parse(value.grant.expiresAt) && consumedAt >= Date.parse(value.productionPackage.createdAt) && consumedAt < Date.parse(value.productionPackage.expiresAt);
  if (!exact || !packageDigestValid || !grantDigestValid || !tokenDigestValid || !authorityValid || !capabilityValid || !timeValid) throw new PilotCanvasRedemptionError("PILOT_CANVAS_INVALID_RESPONSE", 502, false);
}

export interface PilotCanvasRedemptionClientOptions { controlApiBaseUrl: string; internalToken: string; fetchImpl?: PilotCanvasFetch; }
export class PilotCanvasRedemptionClient {
  private readonly baseUrl: URL; private readonly fetchImpl: PilotCanvasFetch; private readonly handleBindings = new Map<string, string>();
  constructor(private readonly options: PilotCanvasRedemptionClientOptions) {
    const baseUrl = validBaseUrl(options.controlApiBaseUrl);
    if (!baseUrl || Buffer.byteLength(options.internalToken, "utf8") < 32) throw new PilotCanvasRedemptionError("PILOT_CANVAS_CONFIGURATION_ERROR", 503, false);
    this.baseUrl = baseUrl; this.fetchImpl = options.fetchImpl ?? fetch;
  }
  async redeem(rawEntry: PilotCanvasEntryReference): Promise<PilotCanvasRedemption> {
    const parsed = pilotCanvasEntryReferenceSchema.safeParse(rawEntry); if (!parsed.success) throw new PilotCanvasRedemptionError("PILOT_CANVAS_INVALID_RESPONSE", 422, false);
    const entry = parsed.data; const body = JSON.stringify(entry); const requestDigest = sha256(body); const existing = this.handleBindings.get(entry.handle);
    if (existing && existing !== requestDigest) throw new PilotCanvasRedemptionError("PILOT_CANVAS_CONFLICT", 409, false);
    this.handleBindings.set(entry.handle, requestDigest); const stableKey = `sc-redeem-v1-${sha256(canonicalJson(entry)).slice(0, 48)}`; const url = new URL(REDEMPTION_PATH, this.baseUrl).toString();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response: Response;
      try { response = await this.fetchImpl(url, { method: "POST", headers: { accept: "application/json", "content-type": "application/json", "cache-control": "no-store", "idempotency-key": stableKey, "x-production-plane-internal-token": this.options.internalToken }, body }); }
      catch { if (attempt === 0) continue; throw new PilotCanvasRedemptionError("PILOT_CANVAS_DEPENDENCY_UNAVAILABLE", 503, true); }
      if (response.status === 503 && attempt === 0) continue;
      if (!response.ok) throw errorForStatus(response.status, safeRequestId(response));
      if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) throw new PilotCanvasRedemptionError("PILOT_CANVAS_INVALID_RESPONSE", 502, false, safeRequestId(response));
      let raw: unknown; try { raw = await response.json(); } catch { throw new PilotCanvasRedemptionError("PILOT_CANVAS_INVALID_RESPONSE", 502, false, safeRequestId(response)); }
      const parsedResponse = canvasEntryRedemptionV01Schema.safeParse(raw); if (!parsedResponse.success) throw new PilotCanvasRedemptionError("PILOT_CANVAS_INVALID_RESPONSE", 502, false, safeRequestId(response));
      assertRedemptionBindings(parsedResponse.data, entry);
      if ((response.headers.get("idempotency-replayed") === "true") !== parsedResponse.data.replayed) throw new PilotCanvasRedemptionError("PILOT_CANVAS_INVALID_RESPONSE", 502, false, safeRequestId(response));
      return parsedResponse.data;
    }
    throw new PilotCanvasRedemptionError("PILOT_CANVAS_DEPENDENCY_UNAVAILABLE", 503, true);
  }
}

const canvasSessionRegistrationSchema = z.object({
  handle: z.string().regex(HANDLE_PATTERN),
  ...bindingFields,
  canvasSessionId: z.string().regex(/^pcs_[A-Za-z0-9_-]{24,128}$/),
  actorId: uuid,
}).strict();
const canvasSessionRegistrationResultSchema = z.object({
  status: z.literal("active"),
  expiresAt: timestamp,
  replayed: z.boolean(),
}).strict();
export type PilotCanvasSessionRegistration = z.infer<typeof canvasSessionRegistrationSchema>;
export type PilotCanvasSessionRegistrationResult = z.infer<typeof canvasSessionRegistrationResultSchema>;
export interface PilotCanvasSessionRegistrar {
  register(input: PilotCanvasSessionRegistration): Promise<PilotCanvasSessionRegistrationResult>;
}
export class PilotCanvasSessionRegistrationClient implements PilotCanvasSessionRegistrar {
  private readonly baseUrl: URL;
  private readonly fetchImpl: PilotCanvasFetch;
  constructor(private readonly options: PilotCanvasRedemptionClientOptions) {
    const baseUrl = validBaseUrl(options.controlApiBaseUrl);
    if (!baseUrl || Buffer.byteLength(options.internalToken, "utf8") < 32) {
      throw new PilotCanvasRedemptionError("PILOT_CANVAS_CONFIGURATION_ERROR", 503, false);
    }
    this.baseUrl = baseUrl;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }
  async register(inputValue: PilotCanvasSessionRegistration): Promise<PilotCanvasSessionRegistrationResult> {
    const parsed = canvasSessionRegistrationSchema.safeParse(inputValue);
    if (!parsed.success) throw new PilotCanvasRedemptionError("PILOT_CANVAS_INVALID_RESPONSE", 422, false);
    const body = JSON.stringify(parsed.data);
    const url = new URL(SESSION_REGISTRATION_PATH, this.baseUrl).toString();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "cache-control": "no-store",
            "x-production-plane-internal-token": this.options.internalToken,
          },
          body,
        });
      } catch {
        if (attempt === 0) continue;
        throw new PilotCanvasRedemptionError("PILOT_CANVAS_DEPENDENCY_UNAVAILABLE", 503, true);
      }
      if (response.status === 503 && attempt === 0) continue;
      if (!response.ok) throw errorForStatus(response.status, safeRequestId(response));
      if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
        throw new PilotCanvasRedemptionError("PILOT_CANVAS_INVALID_RESPONSE", 502, false, safeRequestId(response));
      }
      const raw = await response.json().catch(() => null);
      const result = canvasSessionRegistrationResultSchema.safeParse(raw);
      if (!result.success || (response.headers.get("idempotency-replayed") === "true") !== result.data.replayed) {
        throw new PilotCanvasRedemptionError("PILOT_CANVAS_INVALID_RESPONSE", 502, false, safeRequestId(response));
      }
      return result.data;
    }
    throw new PilotCanvasRedemptionError("PILOT_CANVAS_DEPENDENCY_UNAVAILABLE", 503, true);
  }
}

type PilotRole = "platform_admin" | "channel_admin" | "tenant_admin" | "content_operator" | "pilot_support";
export interface PilotCanvasSessionContext { actorId: string; tenantId: string; organizationType: "TENANT"; roles: readonly PilotRole[]; setCookie?: string; }
export interface BrowserSafeCanvasBootstrap { schemaVersion: "pilot-canvas-bootstrap.v1"; status: "ready"; projectId: string; packageId: string; canvasSessionId: string; expiresAt: string; requestId: string; }
export interface PilotCanvasBootstrapRouterOptions { allowedOrigin: string; verifySession(cookie: string): Promise<PilotCanvasSessionContext | null>; redeem(entry: PilotCanvasEntryReference, session: PilotCanvasSessionContext): Promise<{ authorityId: string; expiresAt: string; requestId: string | null }>; }
function requestId(request: Request): string { const supplied = request.header("x-request-id"); return supplied && REQUEST_ID_PATTERN.test(supplied) ? supplied : crypto.randomUUID(); }
function safeBrowserError(response: ExpressResponse, status: number, code: string, retryable: boolean, id: string): void { response.setHeader("cache-control", "no-store"); response.setHeader("x-request-id", id); response.status(status).json({ error: { code, message: "Pilot Canvas could not be opened.", retryable, requestId: id } }); }
function safeRequestBodyError(response: ExpressResponse, status: 400 | 413, code: string, message: string, id: string): void {
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-request-id", id);
  response.status(status).json({ error: { code, message, requestId: id, retryable: false } });
}
export function createPilotCanvasBootstrapRouter(options: PilotCanvasBootstrapRouterOptions): express.Router {
  const allowed = validOrigin(options.allowedOrigin); if (!allowed) throw new PilotCanvasRedemptionError("PILOT_CANVAS_CONFIGURATION_ERROR", 503, false);
  const router = express.Router(); router.post("/", async (request, response) => {
    const id = requestId(request); response.setHeader("cache-control", "no-store"); response.setHeader("vary", "Origin");
    if (request.header("origin") !== allowed || request.header("x-storycanvas-csrf") !== CSRF_HEADER_VALUE) { safeBrowserError(response, 403, "PILOT_CANVAS_FORBIDDEN", false, id); return; }
    response.setHeader("access-control-allow-origin", allowed); response.setHeader("access-control-allow-credentials", "true");
    let session: PilotCanvasSessionContext | null; try { session = await options.verifySession(request.header("cookie") ?? ""); } catch { safeBrowserError(response, 503, "PILOT_CANVAS_SESSION_UNAVAILABLE", true, id); return; }
    if (!session) { safeBrowserError(response, 401, "PILOT_CANVAS_SESSION_REQUIRED", false, id); return; }
    const parsed = pilotCanvasEntryReferenceSchema.safeParse(request.body); if (!parsed.success) { safeBrowserError(response, 422, "PILOT_CANVAS_ENTRY_INVALID", false, id); return; }
    if (session.organizationType !== "TENANT" || session.tenantId !== parsed.data.tenantId) { safeBrowserError(response, 404, "PILOT_CANVAS_NOT_FOUND", false, id); return; }
    if (!session.roles.some((role) => role === "tenant_admin" || role === "content_operator")) { safeBrowserError(response, 403, "PILOT_CANVAS_FORBIDDEN", false, id); return; }
    try {
      const authority = await options.redeem(parsed.data, session); const output: BrowserSafeCanvasBootstrap = { schemaVersion: "pilot-canvas-bootstrap.v1", status: "ready", projectId: parsed.data.projectId, packageId: parsed.data.packageId, canvasSessionId: authority.authorityId, expiresAt: authority.expiresAt, requestId: authority.requestId ?? id };
      if (session.setCookie) response.setHeader("set-cookie", session.setCookie); response.setHeader("x-request-id", output.requestId); response.status(200).json(output);
    } catch (error) {
      if (error instanceof PilotCanvasRedemptionError) { const status = [401, 404, 409, 410, 422, 500, 503].includes(error.status) ? error.status : 500; safeBrowserError(response, status, error.code, error.retryable, error.requestId ?? id); return; }
      safeBrowserError(response, 500, "PILOT_CANVAS_INTERNAL_ERROR", false, id);
    }
  }); return router;
}

export function createPilotCanvasSafeBootstrapRouter(options: PilotCanvasBootstrapRouterOptions): express.Router {
  const router = express.Router();
  router.use(express.json({ limit: "16kb", strict: true }));
  router.use(createPilotCanvasBootstrapRouter(options));
  router.use((error: unknown, request: Request, response: ExpressResponse, next: NextFunction) => {
    const parserError = error as { status?: number; type?: string } | null;
    const id = requestId(request);
    if (parserError?.status === 413 || parserError?.type === "entity.too.large") {
      safeRequestBodyError(response, 413, "PILOT_CANVAS_REQUEST_TOO_LARGE", "Pilot Canvas request body is too large.", id);
      return;
    }
    if (parserError?.status === 400 || parserError?.type === "entity.parse.failed") {
      safeRequestBodyError(response, 400, "PILOT_CANVAS_MALFORMED_JSON", "Pilot Canvas request body is invalid.", id);
      return;
    }
    next(error);
  });
  return router;
}

const sessionResponseSchema = z.object({ session: z.object({ user: z.object({ id: uuid }).passthrough(), activeContext: z.object({ organizationType: z.literal("TENANT"), tenantId: uuid, roles: z.array(z.enum(["platform_admin", "channel_admin", "tenant_admin", "content_operator", "pilot_support"])) }).passthrough() }).passthrough() }).passthrough();
export function createControlApiSessionVerifier(options: { controlApiBaseUrl: string; fetchImpl?: PilotCanvasFetch }) {
  const baseUrl = validBaseUrl(options.controlApiBaseUrl); if (!baseUrl) throw new PilotCanvasRedemptionError("PILOT_CANVAS_CONFIGURATION_ERROR", 503, false); const fetchImpl = options.fetchImpl ?? fetch;
  return async (cookie: string): Promise<PilotCanvasSessionContext | null> => {
    if (!/(?:^|;\s*)videoagent_session=/.test(cookie)) return null; let response: Response;
    try { response = await fetchImpl(new URL(SESSION_PATH, baseUrl).toString(), { method: "GET", headers: { accept: "application/json", cookie, "cache-control": "no-store" } }); }
    catch { throw new PilotCanvasRedemptionError("PILOT_CANVAS_DEPENDENCY_UNAVAILABLE", 503, true); }
    if (response.status === 401) return null; if (!response.ok) throw new PilotCanvasRedemptionError("PILOT_CANVAS_DEPENDENCY_UNAVAILABLE", 503, true, safeRequestId(response));
    const parsed = sessionResponseSchema.safeParse(await response.json().catch(() => null)); if (!parsed.success) throw new PilotCanvasRedemptionError("PILOT_CANVAS_INVALID_RESPONSE", 502, false, safeRequestId(response));
    return { actorId: parsed.data.session.user.id, tenantId: parsed.data.session.activeContext.tenantId, organizationType: "TENANT", roles: parsed.data.session.activeContext.roles, setCookie: response.headers.get("set-cookie") ?? undefined };
  };
}

export interface PilotCanvasServerAuthority {
  actorId: string;
  redemption: PilotCanvasRedemption;
  expiresAt: string;
}

export class PilotCanvasAuthorityRegistry {
  private readonly values = new Map<string, { actorId: string; redemption: PilotCanvasRedemption; expiresAt: string; entryKey: string }>();
  private readonly authorityByEntry = new Map<string, string>();
  private readonly capacity: number;
  private readonly now: () => number;
  private readonly onEvent?: (event: PilotCanvasAuthorityRegistryEvent) => void;
  private readonly registrar: PilotCanvasSessionRegistrar;
  constructor(
    private readonly client: PilotCanvasRedemptionClient,
    options: PilotCanvasAuthorityRegistryOptions = {},
  ) {
    this.capacity = options.capacity ?? 64;
    this.now = options.now ?? Date.now;
    this.onEvent = options.onEvent;
    if (!options.registrar) {
      throw new PilotCanvasRedemptionError("PILOT_CANVAS_CONFIGURATION_ERROR", 503, false);
    }
    this.registrar = options.registrar;
    if (!Number.isSafeInteger(this.capacity) || this.capacity < 2 || this.capacity > 1_024) {
      throw new PilotCanvasRedemptionError("PILOT_CANVAS_CONFIGURATION_ERROR", 503, false);
    }
  }
  async openEntry(entry: PilotCanvasEntryReference, actorId = entry.tenantId): Promise<{ authorityId: string; expiresAt: string; requestId: string | null }> {
    this.purgeExpired();
    if (!UUID_PATTERN.test(actorId)) throw new PilotCanvasRedemptionError("PILOT_CANVAS_UNAUTHORIZED", 401, false);
    const entryKey = sha256(canonicalJson({ ...entry, actorId }));
    const existingId = this.authorityByEntry.get(entryKey);
    const existing = existingId ? this.values.get(existingId) : undefined;
    if (existing) {
      this.emit("authority-deduplicated");
      return { authorityId: existingId!, expiresAt: existing.expiresAt, requestId: null };
    }

    const redemption = await this.client.redeem(entry);
    const expiryTime = Math.min(Date.parse(redemption.grant.expiresAt), Date.parse(redemption.productionPackage.expiresAt));
    if (!Number.isFinite(expiryTime) || this.now() >= expiryTime) {
      throw new PilotCanvasRedemptionError("PILOT_CANVAS_EXPIRED", 410, false);
    }
    if (this.values.size >= this.capacity) {
      const oldest = this.values.keys().next().value as string | undefined;
      if (oldest) this.deleteAuthority(oldest);
      this.emit("capacity-evicted");
    }
    const authorityId = `pcs_${crypto.randomBytes(24).toString("base64url")}`;
    const expectedExpiresAt = new Date(expiryTime).toISOString();
    const registration = await this.registrar.register({
      ...entry,
      canvasSessionId: authorityId,
      actorId,
    });
    if (registration.expiresAt !== expectedExpiresAt || this.now() >= Date.parse(registration.expiresAt)) {
      throw new PilotCanvasRedemptionError("PILOT_CANVAS_INVALID_RESPONSE", 502, false);
    }
    const expiresAt = registration.expiresAt;
    this.values.set(authorityId, { actorId, redemption, expiresAt, entryKey });
    this.authorityByEntry.set(entryKey, authorityId);
    this.emit(this.values.size === this.capacity ? "capacity-filled" : "authority-issued");
    return { authorityId, expiresAt, requestId: null };
  }
  readServerAuthority(authorityId: string): PilotCanvasRedemption | null {
    const found = this.values.get(authorityId);
    if (!found) return null;
    if (this.now() >= Date.parse(found.expiresAt)) {
      this.emit("expired-observed");
      this.deleteAuthority(authorityId);
      this.emit("expired-purged");
      return null;
    }
    return found.redemption;
  }
  readServerSessionAuthority(authorityId: string): PilotCanvasServerAuthority | null {
    const redemption = this.readServerAuthority(authorityId);
    if (!redemption) return null;
    const found = this.values.get(authorityId);
    return found ? { actorId: found.actorId, redemption, expiresAt: found.expiresAt } : null;
  }
  purgeExpired(): number {
    const expired = [...this.values.entries()]
      .filter(([, value]) => this.now() >= Date.parse(value.expiresAt))
      .map(([authorityId]) => authorityId);
    if (expired.length > 0) this.emit("expired-observed");
    for (const authorityId of expired) this.deleteAuthority(authorityId);
    if (expired.length > 0) this.emit("expired-purged");
    return expired.length;
  }
  activeCount(): number { return this.values.size; }
  clear(): void {
    this.values.clear();
    this.authorityByEntry.clear();
    this.emit("shutdown-cleared");
  }
  private deleteAuthority(authorityId: string): void {
    const found = this.values.get(authorityId);
    if (!found) return;
    this.values.delete(authorityId);
    if (this.authorityByEntry.get(found.entryKey) === authorityId) this.authorityByEntry.delete(found.entryKey);
  }
  private emit(kind: PilotCanvasAuthorityRegistryEvent["kind"]): void {
    this.onEvent?.({ kind, activeCount: this.values.size });
  }
}

export interface PilotCanvasAuthorityRegistryOptions {
  capacity?: number;
  now?: () => number;
  onEvent?: (event: PilotCanvasAuthorityRegistryEvent) => void;
  registrar?: PilotCanvasSessionRegistrar;
}
export interface PilotCanvasAuthorityRegistryEvent {
  kind: "authority-issued" | "authority-deduplicated" | "expired-observed" | "expired-purged" | "capacity-filled" | "capacity-evicted" | "shutdown-cleared";
  activeCount: number;
}

interface CallbackClosable { close(callback: (error?: Error) => void): unknown; }
export interface PilotCanvasRuntimeResources {
  signal: "SIGTERM" | "SIGINT";
  timeoutMs?: number;
  registry: { clear(): void };
  http: CallbackClosable & { closeAllConnections?(): void };
  socketIo: CallbackClosable | null;
  webSocket: CallbackClosable | null;
}
export interface PilotCanvasRuntimeCloseEvidence {
  signal: "SIGTERM" | "SIGINT";
  registryCleared: true;
  httpClosed: true;
  socketIoClosed: true;
  webSocketClosed: true;
  pendingTimerCount: 0;
}
function closeCallbackResource(resource: CallbackClosable | null): Promise<void> {
  if (!resource) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    try {
      resource.close((error?: Error) => {
        if (error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING") reject(error);
        else resolve();
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ERR_SERVER_NOT_RUNNING") resolve();
      else reject(error);
    }
  });
}
export async function closePilotCanvasRuntimeResources(input: PilotCanvasRuntimeResources): Promise<PilotCanvasRuntimeCloseEvidence> {
  const timeoutMs = input.timeoutMs ?? 5_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5_000) {
    throw new PilotCanvasRedemptionError("PILOT_CANVAS_CONFIGURATION_ERROR", 503, false);
  }
  input.registry.clear();
  let timer: NodeJS.Timeout | undefined;
  const bounded = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      input.http.closeAllConnections?.();
      reject(new PilotCanvasRedemptionError("PILOT_CANVAS_INTERNAL_ERROR", 500, false));
    }, timeoutMs);
  });
  try {
    await Promise.race([
      (async () => {
        await closeCallbackResource(input.socketIo);
        await closeCallbackResource(input.webSocket);
        await closeCallbackResource(input.http);
      })(),
      bounded,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  return {
    signal: input.signal,
    registryCleared: true,
    httpClosed: true,
    socketIoClosed: true,
    webSocketClosed: true,
    pendingTimerCount: 0,
  };
}

export interface PilotCanvasRuntimeCapability {
  schemaVersion: "pilot-canvas-runtime-capability.v1"; status: "ready" | "blocked"; code: "PILOT_CANVAS_CAPABILITY_READY" | "PILOT_CANVAS_CAPABILITY_BLOCKED"; checkedAt: string;
  startCommand: "npm --prefix apps/storycanvas run start:pilot-canvas"; endpoint: "/api/production/pilot/canvas/bootstrap"; readinessEndpoint: "/api/production/pilot/canvas/capability"; shutdownTimeoutMs: 5000;
  checks: Array<{ name: "enabled" | "control-api" | "internal-token" | "allowed-origin" | "data-root"; ready: boolean }>;
  logMarkers: readonly ["PILOT_CANVAS_RUNTIME_READY", "PILOT_CANVAS_RUNTIME_BLOCKED", "PILOT_CANVAS_RUNTIME_STOPPED"];
}
export async function getPilotCanvasRuntimeCapability(dependencies: { env?: NodeJS.ProcessEnv; ensureDataRoot?: (path: string) => Promise<boolean>; now?: () => Date } = {}): Promise<PilotCanvasRuntimeCapability> {
  const env = dependencies.env ?? process.env; const root = env.STORYCANVAS_DATA_ROOT?.trim() ?? "";
  const ensureDataRoot = dependencies.ensureDataRoot ?? (async (target: string) => { if (!path.isAbsolute(target) || target === path.parse(target).root) return false; await mkdir(target, { recursive: true }); await access(target, constants.R_OK | constants.W_OK); return true; });
  let dataRootReady = false; try { dataRootReady = await ensureDataRoot(root); } catch { dataRootReady = false; }
  const checks: PilotCanvasRuntimeCapability["checks"] = [
    { name: "enabled", ready: env.STORYCANVAS_PILOT_CANVAS_ENABLED === "true" },
    { name: "control-api", ready: Boolean(validBaseUrl(env.CONTROL_API_BASE_URL?.trim() ?? "")) },
    { name: "internal-token", ready: Buffer.byteLength(env.PRODUCTION_PLANE_INTERNAL_TOKEN?.trim() ?? "", "utf8") >= 32 },
    { name: "allowed-origin", ready: Boolean(validOrigin(env.STORYCANVAS_PILOT_ALLOWED_ORIGIN?.trim() ?? "")) },
    { name: "data-root", ready: dataRootReady },
  ];
  const ready = checks.every((check) => check.ready);
  return { schemaVersion: "pilot-canvas-runtime-capability.v1", status: ready ? "ready" : "blocked", code: ready ? "PILOT_CANVAS_CAPABILITY_READY" : "PILOT_CANVAS_CAPABILITY_BLOCKED", checkedAt: (dependencies.now ?? (() => new Date()))().toISOString(), startCommand: "npm --prefix apps/storycanvas run start:pilot-canvas", endpoint: "/api/production/pilot/canvas/bootstrap", readinessEndpoint: "/api/production/pilot/canvas/capability", shutdownTimeoutMs: 5000, checks, logMarkers: ["PILOT_CANVAS_RUNTIME_READY", "PILOT_CANVAS_RUNTIME_BLOCKED", "PILOT_CANVAS_RUNTIME_STOPPED"] };
}
