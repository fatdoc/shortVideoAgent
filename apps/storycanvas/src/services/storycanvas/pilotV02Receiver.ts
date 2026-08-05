import crypto from "node:crypto";
import type { Knex } from "knex";
import {
  assertContractObject,
  contractPayloadDigest,
  tokenDigest,
  type PilotObjectType,
} from "@/contracts/v0.2/runtime";
import {
  assertActiveGrantContext,
  assertActiveGrantFresh,
  assertGrantScope,
  failClosedGrantIntrospector,
  GrantSecurityError,
  type ActiveGrantIntrospector,
  type ActiveGrantContextV02,
  ProjectGrantVerifierV02,
} from "@/contracts/v0.2/security";

type ContractObject = Record<string, any>;
type ReceiptType = "TaskReceipt" | "AssetReceipt" | "ExportReceipt" | "UsageReceipt";

const ERROR_CATALOG = {
  SCHEMA_INVALID: [422, "schema", "Request cannot be accepted."],
  TENANT_SCOPE_MISMATCH: [403, "scope", "Request scope is not authorized."],
  PROJECT_SCOPE_MISMATCH: [403, "scope", "Request scope is not authorized."],
  CAPABILITY_SCOPE_DENIED: [403, "scope", "Requested capability is not authorized."],
  GRANT_INVALID: [401, "grant", "Project authorization is invalid."],
  GRANT_EXPIRED: [410, "grant", "Project authorization has expired."],
  IDEMPOTENCY_CONFLICT: [409, "idempotency", "Request conflicts with an earlier request."],
  RECEIPT_REPLAY_CONFLICT: [409, "receipt", "Receipt conflicts with an earlier receipt."],
  RECEIPT_TASK_NOT_FOUND: [404, "receipt", "Receipt cannot be accepted."],
} as const;

export type PilotV02ReceiverErrorCode = keyof typeof ERROR_CATALOG;

export class PilotV02ReceiverError extends Error {
  readonly status: number;
  readonly category: string;
  constructor(readonly code: PilotV02ReceiverErrorCode, readonly details: Record<string, unknown> = {}) {
    const catalog = ERROR_CATALOG[code];
    super(catalog[2]);
    this.name = "PilotV02ReceiverError";
    this.status = catalog[0];
    this.category = catalog[1];
  }
}

export interface PilotV02ReceiverOptions {
  database: Knex;
  verifier?: ProjectGrantVerifierV02;
  introspector?: ActiveGrantIntrospector;
  now?: () => Date;
  randomId?: () => string;
}

export type PilotV02AuthorizationObserver = (context: ActiveGrantContextV02) => void;

type StoredIdempotency = {
  payloadDigest: string;
  httpStatus: number;
  resultJson: string;
};

function parseJson(source: string): ContractObject {
  return JSON.parse(source) as ContractObject;
}

function scopeMismatch(code: "TENANT_SCOPE_MISMATCH" | "PROJECT_SCOPE_MISMATCH"): never {
  throw new PilotV02ReceiverError(code);
}

function assertScope(value: ContractObject, claims: ActiveGrantContextV02): void {
  if (value.tenantId !== claims.tenantId) scopeMismatch("TENANT_SCOPE_MISMATCH");
  if (value.projectId !== claims.projectId) scopeMismatch("PROJECT_SCOPE_MISMATCH");
}

function assertNotExpired(value: ContractObject, now: Date): void {
  if (typeof value.expiresAt === "string" && now.getTime() >= Date.parse(value.expiresAt)) {
    throw new PilotV02ReceiverError("GRANT_EXPIRED");
  }
}

function receiptTaskId(receipt: ContractObject): string | undefined {
  return typeof receipt.generationTaskId === "string" ? receipt.generationTaskId : undefined;
}

export class PilotV02Receiver {
  private readonly introspector: ActiveGrantIntrospector;
  private readonly now: () => Date;
  private readonly randomId: () => string;

  constructor(private readonly options: PilotV02ReceiverOptions) {
    this.introspector = options.introspector ?? failClosedGrantIntrospector;
    this.now = options.now ?? (() => new Date());
    this.randomId = options.randomId ?? (() => crypto.randomUUID());
  }

  private async authorize(token: string): Promise<ActiveGrantContextV02> {
    try {
      const active = assertActiveGrantContext(await this.introspector.introspect(token), this.now());
      if (this.options.verifier) {
        const verified = this.options.verifier.verify(token);
        if (
          verified.jti !== active.grantId || verified.tenantId !== active.tenantId || verified.projectId !== active.projectId ||
          verified.packageId !== active.packageId || verified.exp !== active.exp ||
          JSON.stringify(verified.capabilities) !== JSON.stringify(active.capabilities) ||
          JSON.stringify(verified.scopes) !== JSON.stringify(active.scopes)
        ) throw new GrantSecurityError("GRANT_INVALID", 401);
      }
      return active;
    } catch (error) {
      if (error instanceof GrantSecurityError) {
        throw new PilotV02ReceiverError(error.code === "GRANT_EXPIRED" ? "GRANT_EXPIRED" : error.code === "CAPABILITY_SCOPE_DENIED" ? "CAPABILITY_SCOPE_DENIED" : "GRANT_INVALID");
      }
      throw new PilotV02ReceiverError("GRANT_INVALID");
    }
  }

  private assertFresh(claims: ActiveGrantContextV02): void {
    try {
      assertActiveGrantFresh(claims, this.now());
    } catch {
      throw new PilotV02ReceiverError("GRANT_EXPIRED");
    }
  }

  private validate(value: unknown, expected: PilotObjectType): ContractObject {
    try {
      return assertContractObject(value, expected);
    } catch {
      throw new PilotV02ReceiverError("SCHEMA_INVALID", { fieldPaths: ["/"] });
    }
  }

  private async idempotent<T extends ContractObject>(
    claims: ActiveGrantContextV02,
    tenantId: string,
    operation: string,
    value: ContractObject,
    httpStatus: number,
    work: (transaction: Knex.Transaction) => Promise<T>,
  ): Promise<{ value: T; replayed: boolean; httpStatus: number }> {
    return this.options.database.transaction(async (transaction) => {
      this.assertFresh(claims);
      const existing = await transaction("sc_v02_idempotency")
        .where({ tenantId, operation, idempotencyKey: value.idempotencyKey })
        .first<StoredIdempotency>();
      if (existing) {
        if (existing.payloadDigest !== value.payloadDigest) {
          throw new PilotV02ReceiverError("IDEMPOTENCY_CONFLICT", { conflictField: "idempotencyKey" });
        }
        return { value: parseJson(existing.resultJson) as T, replayed: true, httpStatus: existing.httpStatus };
      }
      this.assertFresh(claims);
      const result = await work(transaction);
      this.assertFresh(claims);
      await transaction("sc_v02_idempotency").insert({
        tenantId,
        operation,
        idempotencyKey: value.idempotencyKey,
        payloadDigest: value.payloadDigest,
        httpStatus,
        resultJson: JSON.stringify(result),
        createdAt: this.now().toISOString(),
      });
      return { value: result, replayed: false, httpStatus };
    });
  }

  async receivePackage(raw: unknown, token: string, onAuthorized?: PilotV02AuthorizationObserver) {
    const value = this.validate(raw, "ProjectProductionPackage");
    const claims = await this.authorize(token);
    onAuthorized?.(claims);
    assertScope(value, claims);
    assertGrantScope(claims, undefined, ["production.package.read"]);
    if (value.packageId !== claims.packageId) throw new PilotV02ReceiverError("GRANT_INVALID");
    assertNotExpired(value, this.now());
    return this.idempotent(claims, value.tenantId, "package.receive", value, 202, async (transaction) => {
      const existing = await transaction("sc_v02_packages").where({ packageId: value.packageId }).first();
      if (existing && existing.payloadDigest !== value.payloadDigest) throw new PilotV02ReceiverError("IDEMPOTENCY_CONFLICT", { conflictField: "payloadDigest" });
      if (!existing) await transaction("sc_v02_packages").insert({
        packageId: value.packageId,
        tenantId: value.tenantId,
        projectId: value.projectId,
        payloadDigest: value.payloadDigest,
        payloadJson: JSON.stringify(value),
        acceptedAt: this.now().toISOString(),
      });
      return { status: "accepted", objectType: value.objectType, packageId: value.packageId, payloadDigest: value.payloadDigest };
    });
  }

  async receiveGrant(raw: unknown, token: string, onAuthorized?: PilotV02AuthorizationObserver) {
    const value = this.validate(raw, "ProjectGrant");
    const claims = await this.authorize(token);
    onAuthorized?.(claims);
    assertScope(value, claims);
    if (value.grantId !== claims.grantId) throw new PilotV02ReceiverError("GRANT_INVALID");
    if (this.options.verifier) {
      this.options.verifier.assertGrantBinding(token, this.options.verifier.verify(token), value);
    }
    if (
      tokenDigest(token) !== value.tokenDigest || value.tenantId !== claims.tenantId ||
      value.projectId !== claims.projectId || value.packageId !== claims.packageId ||
      Date.parse(value.expiresAt) !== claims.exp * 1000 ||
      JSON.stringify(value.capabilities) !== JSON.stringify(claims.capabilities) ||
      JSON.stringify(value.scopes) !== JSON.stringify(claims.scopes)
    ) throw new PilotV02ReceiverError("GRANT_INVALID");
    assertGrantScope(claims, undefined, ["production.package.read"]);
    assertNotExpired(value, this.now());
    return this.idempotent(claims, value.tenantId, "grant.receive", value, 202, async (transaction) => {
      const productionPackage = await transaction("sc_v02_packages").where({
        packageId: value.packageId,
        tenantId: value.tenantId,
        projectId: value.projectId,
      }).first();
      if (!productionPackage) throw new PilotV02ReceiverError("PROJECT_SCOPE_MISMATCH");
      const existing = await transaction("sc_v02_grants").where({ grantId: value.grantId }).first();
      if (existing && existing.payloadDigest !== value.payloadDigest) throw new PilotV02ReceiverError("IDEMPOTENCY_CONFLICT", { conflictField: "payloadDigest" });
      if (!existing) await transaction("sc_v02_grants").insert({
        grantId: value.grantId,
        tenantId: value.tenantId,
        projectId: value.projectId,
        packageId: value.packageId,
        tokenDigest: value.tokenDigest,
        payloadDigest: value.payloadDigest,
        payloadJson: JSON.stringify(value),
        verifiedAt: this.now().toISOString(),
      });
      return { status: "accepted", objectType: value.objectType, grantId: value.grantId, payloadDigest: value.payloadDigest };
    });
  }

  async receiveCommand(raw: unknown, token: string, onAuthorized?: PilotV02AuthorizationObserver) {
    const value = this.validate(raw, "GenerationTaskCommand");
    const claims = await this.authorize(token);
    onAuthorized?.(claims);
    assertScope(value, claims);
    assertGrantScope(claims, value.capability, ["production.task.write"]);
    if (value.packageId !== claims.packageId || value.grantId !== claims.grantId) throw new PilotV02ReceiverError("GRANT_INVALID");
    assertNotExpired(value, this.now());
    if (Date.parse(value.expiresAt) > claims.exp * 1000) throw new PilotV02ReceiverError("GRANT_INVALID");
    return this.idempotent(claims, value.tenantId, "command.receive", value, 202, async (transaction) => {
      const packageRow = await transaction("sc_v02_packages").where({ packageId: value.packageId, tenantId: value.tenantId, projectId: value.projectId }).first();
      const grantRow = await transaction("sc_v02_grants").where({ grantId: value.grantId, packageId: value.packageId, tenantId: value.tenantId, projectId: value.projectId }).first();
      if (!packageRow || !grantRow) throw new PilotV02ReceiverError("PROJECT_SCOPE_MISMATCH");
      if (grantRow.tokenDigest !== tokenDigest(token)) throw new PilotV02ReceiverError("GRANT_INVALID");
      const packageValue = parseJson(packageRow.payloadJson);
      if (!packageValue.capabilityRequirements.includes(value.capability)) throw new PilotV02ReceiverError("CAPABILITY_SCOPE_DENIED", { conflictField: "capability" });
      if (!packageValue.storyboard.some((shot: ContractObject) => shot.shotId === value.shotId)) throw new PilotV02ReceiverError("PROJECT_SCOPE_MISMATCH");
      const existing = await transaction("sc_v02_generation_commands").where({ generationTaskId: value.generationTaskId }).first();
      if (existing && existing.payloadDigest !== value.payloadDigest) throw new PilotV02ReceiverError("IDEMPOTENCY_CONFLICT", { conflictField: "payloadDigest" });
      if (!existing) await transaction("sc_v02_generation_commands").insert({
        generationTaskId: value.generationTaskId,
        tenantId: value.tenantId,
        projectId: value.projectId,
        packageId: value.packageId,
        grantId: value.grantId,
        capability: value.capability,
        reservationReference: value.reservationReference,
        payloadDigest: value.payloadDigest,
        payloadJson: JSON.stringify(value),
        status: "accepted",
        acceptedAt: this.now().toISOString(),
      });
      return { status: "accepted", objectType: value.objectType, generationTaskId: value.generationTaskId, payloadDigest: value.payloadDigest, providerSubmitted: false };
    });
  }

  private rejectedAck(receipt: ContractObject, code: "RECEIPT_TASK_NOT_FOUND" | "RECEIPT_REPLAY_CONFLICT" | "IDEMPOTENCY_CONFLICT") {
    const now = this.now().toISOString();
    const error = new PilotV02ReceiverError(code, { receiptType: receipt.objectType, reasonCode: code === "RECEIPT_TASK_NOT_FOUND" ? "receipt_not_accepted" : "receipt_conflict" });
    const unsigned: ContractObject = {
      objectType: "ReceiptAck",
      contractVersion: "0.2",
      tenantId: receipt.tenantId,
      projectId: receipt.projectId,
      idempotencyKey: `ack-${crypto.createHash("sha256").update(String(receipt.receiptId)).digest("hex").slice(0, 32)}`,
      occurredAt: now,
      ackId: `ack-${this.randomId()}`,
      receiptId: receipt.receiptId,
      receiptType: receipt.objectType,
      acknowledgedPayloadDigest: receipt.payloadDigest,
      status: "rejected",
      durablyRecorded: false,
      domainReference: null,
      error: { code: error.code, message: error.message, retryable: false, category: error.category, details: error.details },
      receivedAt: now,
    };
    return { ...unsigned, payloadDigest: contractPayloadDigest(unsigned) };
  }

  private acceptedAck(receipt: ContractObject, status: "accepted" | "duplicate") {
    const now = this.now().toISOString();
    const unsigned: ContractObject = {
      objectType: "ReceiptAck",
      contractVersion: "0.2",
      tenantId: receipt.tenantId,
      projectId: receipt.projectId,
      idempotencyKey: `ack-${crypto.createHash("sha256").update(String(receipt.receiptId)).digest("hex").slice(0, 32)}`,
      occurredAt: now,
      ackId: `ack-${this.randomId()}`,
      receiptId: receipt.receiptId,
      receiptType: receipt.objectType,
      acknowledgedPayloadDigest: receipt.payloadDigest,
      status,
      durablyRecorded: true,
      domainReference: `storycanvas-inbox:${receipt.receiptId}`,
      error: null,
      receivedAt: now,
    };
    return { ...unsigned, payloadDigest: contractPayloadDigest(unsigned) };
  }

  async receiveReceipt(raw: unknown, token: string, onAuthorized?: PilotV02AuthorizationObserver): Promise<{ value: ContractObject; replayed: boolean; httpStatus: number }> {
    const objectType = (raw as ContractObject)?.objectType as ReceiptType;
    if (!new Set<ReceiptType>(["TaskReceipt", "AssetReceipt", "ExportReceipt", "UsageReceipt"]).has(objectType)) throw new PilotV02ReceiverError("SCHEMA_INVALID", { fieldPaths: ["/objectType"] });
    const receipt = this.validate(raw, objectType);
    const claims = await this.authorize(token);
    onAuthorized?.(claims);
    assertScope(receipt, claims);
    const scopes = ["production.receipt.write"];
    if (objectType === "AssetReceipt") scopes.push("production.asset.write");
    if (objectType === "ExportReceipt") scopes.push("production.export.write");
    assertGrantScope(claims, undefined, scopes);

    const taskId = receiptTaskId(receipt);
    const activeGrant = await this.options.database("sc_v02_grants").where({
      grantId: claims.grantId,
      tenantId: claims.tenantId,
      projectId: claims.projectId,
      packageId: claims.packageId,
      tokenDigest: tokenDigest(token),
    }).first();
    if (!activeGrant) throw new PilotV02ReceiverError("GRANT_INVALID");
    const task = taskId ? await this.options.database("sc_v02_generation_commands").where({
      generationTaskId: taskId,
      tenantId: claims.tenantId,
      projectId: claims.projectId,
      packageId: claims.packageId,
      grantId: activeGrant.grantId,
    }).first() : await this.options.database("sc_v02_generation_commands").where({ tenantId: claims.tenantId, projectId: claims.projectId, packageId: claims.packageId, grantId: activeGrant.grantId }).first();
    this.assertFresh(claims);
    if (!task) return { value: this.rejectedAck(receipt, "RECEIPT_TASK_NOT_FOUND"), replayed: false, httpStatus: 404 };

    const existingReceipt = await this.options.database("sc_v02_receipt_inbox").where({ receiptId: receipt.receiptId }).first();
    if (existingReceipt && existingReceipt.payloadDigest !== receipt.payloadDigest) {
      this.assertFresh(claims);
      return { value: this.rejectedAck(receipt, "RECEIPT_REPLAY_CONFLICT"), replayed: false, httpStatus: 409 };
    }
    if (existingReceipt) {
      this.assertFresh(claims);
      return { value: this.acceptedAck(receipt, "duplicate"), replayed: true, httpStatus: 200 };
    }

    try {
      return await this.idempotent(claims, receipt.tenantId, `receipt.${objectType}`, receipt, 200, async (transaction) => {
        const ack = this.acceptedAck(receipt, "accepted");
        await transaction("sc_v02_receipt_inbox").insert({
          receiptId: receipt.receiptId,
          receiptType: objectType,
          generationTaskId: taskId ?? null,
          tenantId: receipt.tenantId,
          projectId: receipt.projectId,
          payloadDigest: receipt.payloadDigest,
          payloadJson: JSON.stringify(receipt),
          ackJson: JSON.stringify(ack),
          receivedAt: this.now().toISOString(),
        });
        return ack;
      });
    } catch (error) {
      if (error instanceof PilotV02ReceiverError && error.code === "IDEMPOTENCY_CONFLICT") {
        return { value: this.rejectedAck(receipt, "IDEMPOTENCY_CONFLICT"), replayed: false, httpStatus: 409 };
      }
      throw error;
    }
  }
}
