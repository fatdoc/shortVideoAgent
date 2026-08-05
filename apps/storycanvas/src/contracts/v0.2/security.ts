import crypto from "node:crypto";
import { tokenDigest } from "./runtime";

export const PROJECT_GRANT_ISSUER = "videoagent-control-plane";
export const PROJECT_GRANT_AUDIENCE = "storycanvas-production-plane";
const CLOCK_TOLERANCE_SECONDS = 5;
const MAX_GRANT_TTL_SECONDS = 900;
const CAPABILITIES = new Set(["image.generate", "video.generate", "audio.tts", "media.export"]);
const SCOPES = new Set(["production.package.read", "production.task.write", "production.receipt.write", "production.asset.write", "production.export.write"]);
const CLAIM_KEYS = new Set(["iss", "aud", "jti", "tenantId", "projectId", "packageId", "capabilities", "scopes", "contractVersion", "nonce", "iat", "nbf", "exp"]);

export type ProjectGrantClaimsV02 = {
  iss: typeof PROJECT_GRANT_ISSUER;
  aud: typeof PROJECT_GRANT_AUDIENCE;
  jti: string;
  tenantId: string;
  projectId: string;
  packageId: string;
  capabilities: string[];
  scopes: string[];
  contractVersion: "0.2";
  nonce: string;
  iat: number;
  nbf: number;
  exp: number;
};

export type ActiveGrantContextV02 = {
  active: true;
  tenantId: string;
  projectId: string;
  packageId: string;
  capabilities: string[];
  scopes: string[];
  exp: number;
};

export type GrantSecurityCode = "GRANT_INVALID" | "GRANT_EXPIRED" | "CAPABILITY_SCOPE_DENIED";

export class GrantSecurityError extends Error {
  constructor(readonly code: GrantSecurityCode, readonly status: number) {
    super(code === "GRANT_EXPIRED" ? "Project authorization has expired." : code === "CAPABILITY_SCOPE_DENIED" ? "Requested capability is not authorized." : "Project authorization is invalid.");
    this.name = "GrantSecurityError";
  }
}

export interface ActiveGrantIntrospector {
  introspect(token: string): Promise<ActiveGrantContextV02>;
}

export const failClosedGrantIntrospector: ActiveGrantIntrospector = {
  async introspect() {
    throw invalid();
  },
};

export interface HttpGrantIntrospectorOptions {
  url: string;
  internalToken: string;
  timeoutMs?: number;
  allowInsecureHttp?: boolean;
  fetchImpl?: typeof fetch;
}

function validateActiveContext(value: unknown): ActiveGrantContextV02 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  const context = value as Record<string, unknown>;
  const keys = ["active", "tenantId", "projectId", "packageId", "capabilities", "scopes", "exp"];
  if (
    Object.keys(context).length !== keys.length || keys.some((key) => !Object.hasOwn(context, key)) ||
    context.active !== true || typeof context.tenantId !== "string" || !context.tenantId ||
    typeof context.projectId !== "string" || !context.projectId || typeof context.packageId !== "string" || !context.packageId ||
    !Array.isArray(context.capabilities) || context.capabilities.length === 0 ||
    context.capabilities.some((item) => typeof item !== "string" || !CAPABILITIES.has(item)) ||
    new Set(context.capabilities).size !== context.capabilities.length ||
    !Array.isArray(context.scopes) || context.scopes.length === 0 ||
    context.scopes.some((item) => typeof item !== "string" || !SCOPES.has(item)) ||
    new Set(context.scopes).size !== context.scopes.length || !Number.isInteger(context.exp)
  ) throw invalid();
  return context as ActiveGrantContextV02;
}

export class HttpActiveGrantIntrospector implements ActiveGrantIntrospector {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: HttpGrantIntrospectorOptions) {
    const url = new URL(options.url);
    if (url.protocol !== "https:" && !(options.allowInsecureHttp && url.protocol === "http:")) {
      throw new Error("Control API Grant introspection requires HTTPS");
    }
    if (options.internalToken.length < 32) throw new Error("Production-plane internal token is missing or too short");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5_000;
  }

  async introspect(token: string): Promise<ActiveGrantContextV02> {
    try {
      const response = await this.fetchImpl(this.options.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Production-Plane-Internal-Token": this.options.internalToken,
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) {
        if (response.status === 410) throw new GrantSecurityError("GRANT_EXPIRED", 410);
        throw invalid();
      }
      return validateActiveContext(await response.json());
    } catch (error) {
      if (error instanceof GrantSecurityError) throw error;
      throw invalid();
    }
  }
}

export function loadHttpGrantIntrospector(env: NodeJS.ProcessEnv = process.env): ActiveGrantIntrospector {
  const baseUrl = env.CONTROL_API_BASE_URL?.trim().replace(/\/+$/, "");
  const url = env.CONTROL_API_GRANT_INTROSPECTION_URL?.trim()
    || (baseUrl ? `${baseUrl}/api/v1/internal/project-grants/introspect` : "");
  const internalToken = env.PRODUCTION_PLANE_INTERNAL_TOKEN?.trim() || "";
  if (!url || !internalToken) return failClosedGrantIntrospector;
  return new HttpActiveGrantIntrospector({
    url,
    internalToken,
    allowInsecureHttp: env.NODE_ENV !== "production" && env.STORYCANVAS_ALLOW_INSECURE_INTROSPECTION === "true",
  });
}

export interface ProjectGrantVerifierOptions {
  keyring: Readonly<Record<string, string>>;
  sessionSecret?: string;
  now?: () => Date;
}

function decodeJson(value: string): Record<string, unknown> {
  const decoded = Buffer.from(value, "base64url").toString("utf8");
  const parsed = JSON.parse(decoded) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid token json");
  return parsed as Record<string, unknown>;
}

function invalid(): GrantSecurityError {
  return new GrantSecurityError("GRANT_INVALID", 401);
}

function validateKeyring(keyring: Readonly<Record<string, string>>, sessionSecret?: string): void {
  for (const [kid, secret] of Object.entries(keyring)) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(kid) || secret.length < 32 || secret === sessionSecret) {
      throw new Error("StoryCanvas ProjectGrant verification keyring is invalid or shares the session secret");
    }
  }
}

export function loadProjectGrantVerifyKeyring(env: NodeJS.ProcessEnv = process.env): Readonly<Record<string, string>> {
  const raw = env.STORYCANVAS_PROJECT_GRANT_VERIFY_KEYS_JSON?.trim();
  if (!raw) return Object.freeze({});
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    const keyring = Object.fromEntries(Object.entries(parsed as Record<string, unknown>).map(([kid, value]) => {
      if (typeof value !== "string") throw new Error("key must be a string");
      return [kid, value];
    }));
    validateKeyring(keyring, env.STORYCANVAS_SESSION_SECRET);
    return Object.freeze(keyring);
  } catch {
    throw new Error("STORYCANVAS_PROJECT_GRANT_VERIFY_KEYS_JSON is invalid");
  }
}

export class ProjectGrantVerifierV02 {
  private readonly now: () => Date;

  constructor(private readonly options: ProjectGrantVerifierOptions) {
    validateKeyring(options.keyring, options.sessionSecret);
    this.now = options.now ?? (() => new Date());
  }

  verify(token: string): ProjectGrantClaimsV02 {
    if (!token || token.length > 16_384) throw invalid();
    const parts = token.split(".");
    if (parts.length !== 3) throw invalid();
    const [headerPart, payloadPart, signaturePart] = parts;
    if (!headerPart || !payloadPart || !signaturePart) throw invalid();
    try {
      const header = decodeJson(headerPart);
      if (Object.keys(header).length !== 3 || header.alg !== "HS256" || header.typ !== "JWT" || typeof header.kid !== "string") throw invalid();
      const secret = this.options.keyring[header.kid];
      if (!secret) throw invalid();
      const signingKey = crypto.createHmac("sha256", secret).update("videoagent/project-grant/v0.2").digest();
      const expected = crypto.createHmac("sha256", signingKey).update(`${headerPart}.${payloadPart}`).digest("base64url");
      const expectedBytes = Buffer.from(expected);
      const suppliedBytes = Buffer.from(signaturePart);
      if (expectedBytes.length !== suppliedBytes.length || !crypto.timingSafeEqual(expectedBytes, suppliedBytes)) throw invalid();

      const claims = decodeJson(payloadPart);
      if (
        Object.keys(claims).length !== CLAIM_KEYS.size ||
        Object.keys(claims).some((key) => !CLAIM_KEYS.has(key)) ||
        claims.iss !== PROJECT_GRANT_ISSUER ||
        claims.aud !== PROJECT_GRANT_AUDIENCE ||
        claims.contractVersion !== "0.2" ||
        typeof claims.jti !== "string" || !claims.jti ||
        typeof claims.tenantId !== "string" || !claims.tenantId ||
        typeof claims.projectId !== "string" || !claims.projectId ||
        typeof claims.packageId !== "string" || !claims.packageId ||
        typeof claims.nonce !== "string" || !claims.nonce ||
        !Array.isArray(claims.capabilities) || claims.capabilities.length === 0 ||
        claims.capabilities.some((value) => typeof value !== "string" || !CAPABILITIES.has(value)) ||
        new Set(claims.capabilities).size !== claims.capabilities.length ||
        !Array.isArray(claims.scopes) || claims.scopes.length === 0 ||
        claims.scopes.some((value) => typeof value !== "string" || !SCOPES.has(value)) ||
        new Set(claims.scopes).size !== claims.scopes.length ||
        !Number.isInteger(claims.iat) || !Number.isInteger(claims.nbf) || !Number.isInteger(claims.exp) ||
        (claims.iat as number) > (claims.nbf as number) ||
        (claims.nbf as number) >= (claims.exp as number) ||
        (claims.exp as number) - (claims.iat as number) > MAX_GRANT_TTL_SECONDS
      ) throw invalid();
      const now = Math.floor(this.now().getTime() / 1000);
      if (now + CLOCK_TOLERANCE_SECONDS < (claims.nbf as number)) throw invalid();
      if (now - CLOCK_TOLERANCE_SECONDS >= (claims.exp as number)) throw new GrantSecurityError("GRANT_EXPIRED", 410);
      return claims as ProjectGrantClaimsV02;
    } catch (error) {
      if (error instanceof GrantSecurityError) throw error;
      throw invalid();
    }
  }

  assertGrantBinding(token: string, claims: ProjectGrantClaimsV02, grant: Record<string, unknown>): void {
    if (
      grant.grantId !== claims.jti ||
      grant.tenantId !== claims.tenantId ||
      grant.projectId !== claims.projectId ||
      grant.packageId !== claims.packageId ||
      grant.keyId === undefined ||
      tokenDigest(token) !== grant.tokenDigest ||
      JSON.stringify(grant.capabilities) !== JSON.stringify(claims.capabilities) ||
      JSON.stringify(grant.scopes) !== JSON.stringify(claims.scopes)
    ) throw invalid();
  }
}

export function assertGrantScope(claims: ActiveGrantContextV02, capability: string | undefined, scopes: string[]): void {
  if (capability && !claims.capabilities.includes(capability)) throw new GrantSecurityError("CAPABILITY_SCOPE_DENIED", 403);
  if (scopes.some((scope) => !claims.scopes.includes(scope))) throw new GrantSecurityError("CAPABILITY_SCOPE_DENIED", 403);
}
