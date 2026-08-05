import crypto from "node:crypto";
import express, { type Request, type Response } from "express";
import { contractPayloadDigest } from "@/contracts/v0.2/runtime";
import {
  GrantSecurityError,
  loadHttpGrantIntrospector,
  loadProjectGrantVerifyKeyring,
  ProjectGrantVerifierV02,
  type ActiveGrantIntrospector,
  type ActiveGrantContextV02,
} from "@/contracts/v0.2/security";
import {
  PilotV02Receiver,
  PilotV02ReceiverError,
  type PilotV02AuthorizationObserver,
} from "@/services/storycanvas/pilotV02Receiver";
import type { Knex } from "knex";

export interface RawBodyRequest extends Request {
  pilotV02RawBody?: Buffer;
}

export function capturePilotV02RawBody(request: Request, _response: Response, buffer: Buffer): void {
  if (request.path.startsWith("/api/production/v0.2/") || request.baseUrl === "/api/production/v0.2") {
    (request as RawBodyRequest).pilotV02RawBody = Buffer.from(buffer);
  }
}

export interface ProductionV02RouterOptions {
  database: Knex;
  verifier?: ProjectGrantVerifierV02;
  introspector?: ActiveGrantIntrospector;
  now?: () => Date;
}

function standardError(
  response: Response,
  request: Request,
  error: PilotV02ReceiverError | GrantSecurityError,
  authenticated?: ActiveGrantContextV02,
): void {
  const tenantId = authenticated?.tenantId ?? "tenant-unauthenticated";
  const projectId = authenticated?.projectId ?? "project-unauthenticated";
  const incomingKey = request.header("idempotency-key");
  const idempotencyKey = incomingKey && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(incomingKey)
    ? incomingKey
    : `error-${crypto.randomUUID()}`;
  const receiverError = error instanceof PilotV02ReceiverError
    ? error
    : new PilotV02ReceiverError(error.code === "GRANT_EXPIRED" ? "GRANT_EXPIRED" : error.code === "CAPABILITY_SCOPE_DENIED" ? "CAPABILITY_SCOPE_DENIED" : "GRANT_INVALID");
  const unsigned = {
    objectType: "StandardError",
    contractVersion: "0.2",
    tenantId,
    projectId,
    idempotencyKey,
    occurredAt: new Date().toISOString(),
    errorId: `error-${crypto.randomUUID()}`,
    requestId: `request-${crypto.randomUUID()}`,
    error: {
      code: receiverError.code,
      message: receiverError.message,
      retryable: false,
      category: receiverError.category,
      details: receiverError.details,
    },
  };
  response.status(receiverError.status).json({ ...unsigned, payloadDigest: contractPayloadDigest(unsigned) });
}

function transportError(code: "SCHEMA_INVALID" | "IDEMPOTENCY_CONFLICT" = "SCHEMA_INVALID", details: Record<string, unknown> = {}) {
  return new PilotV02ReceiverError(code, details);
}

function verifyTransport(request: RawBodyRequest): void {
  if (request.header("x-contract-version") !== "0.2") throw transportError("SCHEMA_INVALID", { fieldPaths: ["/contractVersion"] });
  const body = request.body as Record<string, unknown> | undefined;
  if (!body || request.header("idempotency-key") !== body.idempotencyKey) throw transportError("SCHEMA_INVALID", { fieldPaths: ["/idempotencyKey"] });
  const raw = request.pilotV02RawBody;
  const supplied = request.header("content-digest");
  if (!raw || !supplied) throw transportError("SCHEMA_INVALID", { fieldPaths: ["/contentDigest"] });
  const expected = `sha-256=:${crypto.createHash("sha256").update(raw).digest("base64")}:`;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.length !== suppliedBytes.length || !crypto.timingSafeEqual(expectedBytes, suppliedBytes)) {
    throw transportError("SCHEMA_INVALID", { fieldPaths: ["/contentDigest"] });
  }
}

function bearerToken(request: Request): string {
  const authorization = request.header("authorization") || "";
  const match = authorization.match(/^Bearer ([^\s]+)$/);
  if (!match) throw new PilotV02ReceiverError("GRANT_INVALID");
  return match[1];
}

export function createProductionV02Router(options: ProductionV02RouterOptions) {
  const router = express.Router();
  const receiver = new PilotV02Receiver(options);

  const write = (operation: (
    body: unknown,
    token: string,
    onAuthorized: PilotV02AuthorizationObserver,
  ) => Promise<{ value: Record<string, unknown>; replayed: boolean; httpStatus: number }>) =>
    async (request: RawBodyRequest, response: Response) => {
      let authenticated: ActiveGrantContextV02 | undefined;
      try {
        verifyTransport(request);
        const result = await operation(request.body, bearerToken(request), (context) => { authenticated = context; });
        response.setHeader("idempotency-replayed", String(result.replayed));
        response.status(result.replayed ? 200 : result.httpStatus).json(result.value);
      } catch (error) {
        if (error instanceof PilotV02ReceiverError || error instanceof GrantSecurityError) {
          standardError(response, request, error, authenticated);
          return;
        }
        standardError(response, request, transportError(), authenticated);
      }
    };

  router.post("/packages", write((body, token, onAuthorized) => receiver.receivePackage(body, token, onAuthorized)));
  router.post("/grants", write((body, token, onAuthorized) => receiver.receiveGrant(body, token, onAuthorized)));
  router.post("/commands", write((body, token, onAuthorized) => receiver.receiveCommand(body, token, onAuthorized)));
  router.post("/receipts", write((body, token, onAuthorized) => receiver.receiveReceipt(body, token, onAuthorized)));
  return router;
}

const defaultRouter = express.Router();
let loadedDefaultRouter: Promise<ReturnType<typeof createProductionV02Router>> | undefined;

defaultRouter.use((request, response, next) => {
  loadedDefaultRouter ??= import("@/utils").then(({ default: u }) => {
    const keyring = loadProjectGrantVerifyKeyring();
    return createProductionV02Router({
      database: u.db as unknown as Knex,
      introspector: loadHttpGrantIntrospector(),
      verifier: Object.keys(keyring).length
        ? new ProjectGrantVerifierV02({ keyring, sessionSecret: process.env.STORYCANVAS_SESSION_SECRET })
        : undefined,
    });
  });
  void loadedDefaultRouter.then((router) => router(request, response, next), next);
});

export default defaultRouter;
