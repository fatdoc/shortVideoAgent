import crypto from "node:crypto";
import type { Knex } from "knex";

import {
  parseCanvasV1Contract,
  type CanvasCommandV01,
  type CanvasEventV01,
  type EntityBindingV01,
  type ProviderAssetBindingV01,
  type ShotReadinessV01,
} from "@/contracts/canvas-v1";
import type { CanvasProductionScope } from "../assets-v1";
import { CanvasDocumentStore } from "./documentStore";
import {
  CanvasCommandServiceError,
  toCanvasCommandServiceError,
  type CanvasPublicErrorCode,
} from "./errors";

export { CanvasCommandServiceError } from "./errors";

interface CommandRow {
  commandId: string;
  payloadDigest: string;
  resultEventJson: string | null;
}

const HIGH_COST_COMMANDS = new Set<CanvasCommandV01["commandType"]>([
  "CREATE_VIRTUAL_CHARACTER",
  "BIND_ASSET_TO_ENTITY",
  "GENERATE_SHOT",
  "SELECT_SHOT_OUTPUT",
  "EXPORT_PLAYLIST",
]);

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

function semanticDigest(command: CanvasCommandV01): string {
  return crypto.createHash("sha256").update(canonical({
    requestedByActorId: command.requestedByActorId,
    requestSource: command.requestSource,
    approvalId: command.approvalId,
    payload: command.payload,
  })).digest("hex");
}

function commandScope(command: CanvasCommandV01) {
  return {
    tenantId: command.tenantId,
    projectId: command.projectId,
    packageId: command.packageId,
    canvasSessionId: command.canvasSessionId,
    commandType: command.commandType,
  };
}

function failureForReadiness(readiness: ShotReadinessV01): CanvasPublicErrorCode {
  if (readiness.reasonCodes.some((code) => code.startsWith("RIGHTS_"))) return "CANVAS_RIGHTS_NOT_AUTHORIZED";
  if (readiness.reasonCodes.some((code) => code.startsWith("ASSET_APPROVAL_"))) return "CANVAS_ASSET_NOT_APPROVED";
  if (readiness.reasonCodes.some((code) => code.startsWith("PROVIDER_"))) return "CANVAS_PROVIDER_NOT_ACTIVE";
  if (readiness.reasonCodes.some((code) => code.startsWith("ENTITY_BINDING_"))) return "CANVAS_ENTITY_BINDING_NOT_APPROVED";
  if (readiness.reasonCodes.includes("CAPABILITY_UNAVAILABLE")) return "CANVAS_CAPABILITY_UNAVAILABLE";
  return "CANVAS_SHOT_NOT_READY";
}

export interface StartShotProductionInput {
  scope: CanvasProductionScope;
  commandId: string;
  shotId: string;
  prompt: string;
  referenceAssetIds: string[];
  referenceAssetUris: string[];
}

export interface CanvasCommandServiceOptions {
  database: Knex;
  resolveScope(command: CanvasCommandV01): Promise<CanvasProductionScope>;
  validateApproval(command: CanvasCommandV01, scope: CanvasProductionScope): Promise<boolean>;
  getReadiness(readinessId: string, scope: CanvasProductionScope): Promise<ShotReadinessV01 | null>;
  resolveProviderAssetUris(assetIds: string[], scope: CanvasProductionScope): Promise<string[]>;
  startShotProduction(input: StartShotProductionInput): Promise<{ taskId: string }>;
  syncProviderAsset?(assetId: string, scope: CanvasProductionScope): Promise<ProviderAssetBindingV01>;
  bindAssetToEntity?(assetId: string, entityId: string, scope: CanvasProductionScope): Promise<EntityBindingV01>;
  assertOutputAsset?(outputAssetId: string, scope: CanvasProductionScope): Promise<boolean>;
  documentStore?: CanvasDocumentStore;
  now?: () => Date;
  randomId?: () => string;
}

export class CanvasCommandService {
  private readonly now: () => Date;
  private readonly randomId: () => string;
  private readonly documents: CanvasDocumentStore;

  constructor(private readonly options: CanvasCommandServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.randomId = options.randomId ?? crypto.randomUUID;
    this.documents = options.documentStore ?? new CanvasDocumentStore({ database: options.database, now: this.now });
  }

  async execute(rawCommand: unknown): Promise<CanvasEventV01> {
    let command: CanvasCommandV01;
    try {
      const parsed = parseCanvasV1Contract(rawCommand);
      if (parsed.objectType !== "CanvasCommand") throw new CanvasCommandServiceError("CANVAS_SCHEMA_INVALID");
      command = parsed;
    } catch (error) {
      throw toCanvasCommandServiceError(error);
    }
    let scope: CanvasProductionScope;
    try {
      scope = await this.options.resolveScope(command);
    } catch (error) {
      throw toCanvasCommandServiceError(error);
    }
    if (scope.tenantId !== command.tenantId || scope.projectId !== command.projectId
      || scope.packageId !== command.packageId || scope.canvasSessionId !== command.canvasSessionId
      || scope.actorId !== command.requestedByActorId) {
      throw new CanvasCommandServiceError("CANVAS_SCOPE_MISMATCH");
    }

    const digest = semanticDigest(command);
    const existing = await this.options.database<CommandRow>("sc_canvas_v1_commands")
      .where(commandScope(command)).first();
    if (existing) {
      if (existing.commandId !== command.commandId || existing.payloadDigest !== digest) {
        throw new CanvasCommandServiceError("CANVAS_COMMAND_IDEMPOTENCY_CONFLICT");
      }
      if (!existing.resultEventJson) throw new CanvasCommandServiceError("CANVAS_PROVIDER_FAILED");
      const event = parseCanvasV1Contract(JSON.parse(existing.resultEventJson));
      if (event.objectType !== "CanvasEvent") throw new CanvasCommandServiceError("CANVAS_PROVIDER_FAILED");
      if (command.commandType === "GENERATE_SHOT" && event.status === "accepted") {
        return this.generate(command, scope, digest, event as CanvasEventV01);
      }
      return { ...event, replayed: true };
    }

    if (HIGH_COST_COMMANDS.has(command.commandType) && command.commandType !== "GENERATE_SHOT") {
      if (!command.approvalId) throw new CanvasCommandServiceError("CANVAS_APPROVAL_REQUIRED");
      if (!await this.options.validateApproval(command, scope)) throw new CanvasCommandServiceError("CANVAS_APPROVAL_INVALID");
    }

    if (command.commandType === "GENERATE_SHOT") {
      return this.generate(command, scope, digest);
    }
    return this.mutate(command, scope, digest);
  }

  private event(command: CanvasCommandV01, values: Partial<CanvasEventV01>): CanvasEventV01 {
    const occurredAt = this.now().toISOString();
    return parseCanvasV1Contract({
      objectType: "CanvasEvent",
      contractVersion: "0.1",
      tenantId: command.tenantId,
      projectId: command.projectId,
      packageId: command.packageId,
      canvasSessionId: command.canvasSessionId,
      eventId: this.randomId(),
      commandId: command.commandId,
      commandType: command.commandType,
      status: "accepted",
      providerSubmitted: false,
      taskCreated: false,
      outputRegistered: false,
      receiptRecorded: false,
      taskId: null,
      outputAssetId: null,
      receiptId: null,
      replayed: false,
      error: null,
      requestId: command.requestId,
      occurredAt,
      ...values,
    }) as CanvasEventV01;
  }

  private async persist(command: CanvasCommandV01, digest: string, event: CanvasEventV01): Promise<void> {
    const timestamp = this.now().toISOString();
    await this.options.database.transaction(async (transaction) => {
      const row = await transaction<CommandRow>("sc_canvas_v1_commands").where(commandScope(command)).first();
      if (row) {
        if (row.payloadDigest !== digest) throw new CanvasCommandServiceError("CANVAS_COMMAND_IDEMPOTENCY_CONFLICT");
        return;
      }
      await transaction("sc_canvas_v1_commands").insert({
        commandId: command.commandId,
        ...commandScope(command),
        payloadDigest: digest,
        commandJson: JSON.stringify(command),
        resultEventJson: JSON.stringify(event),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await transaction("sc_canvas_v1_events").insert({
        eventId: event.eventId,
        commandId: command.commandId,
        tenantId: command.tenantId,
        projectId: command.projectId,
        packageId: command.packageId,
        canvasSessionId: command.canvasSessionId,
        status: event.status,
        eventJson: JSON.stringify(event),
        createdAt: timestamp,
      });
    });
  }

  private async updateEvent(command: CanvasCommandV01, event: CanvasEventV01): Promise<void> {
    const timestamp = this.now().toISOString();
    await this.options.database.transaction(async (transaction) => {
      await transaction("sc_canvas_v1_commands").where({ commandId: command.commandId }).update({
        resultEventJson: JSON.stringify(event),
        updatedAt: timestamp,
      });
      await transaction("sc_canvas_v1_events").where({ eventId: event.eventId }).update({
        status: event.status,
        eventJson: JSON.stringify(event),
      });
    });
  }

  private async generate(
    command: CanvasCommandV01,
    scope: CanvasProductionScope,
    digest: string,
    recovering?: CanvasEventV01,
  ): Promise<CanvasEventV01> {
    const payload = command.payload as Extract<CanvasCommandV01["payload"], { readinessId: string }>;
    const readiness = await this.options.getReadiness(payload.readinessId, scope);
    if (!readiness || readiness.readinessId !== payload.readinessId || readiness.shotId !== payload.shotId || !readiness.ready) {
      throw new CanvasCommandServiceError(readiness ? failureForReadiness(readiness) : "CANVAS_SHOT_NOT_READY");
    }
    if (readiness.tenantId !== scope.tenantId || readiness.projectId !== scope.projectId
      || readiness.packageId !== scope.packageId || readiness.canvasSessionId !== scope.canvasSessionId) {
      throw new CanvasCommandServiceError("CANVAS_SCOPE_MISMATCH");
    }
    const referenceAssetUris = await this.options.resolveProviderAssetUris(payload.referenceAssetIds, scope);
    if (referenceAssetUris.length !== payload.referenceAssetIds.length
      || referenceAssetUris.some((uri) => !uri.startsWith("asset://"))) {
      throw new CanvasCommandServiceError("CANVAS_PROVIDER_NOT_ACTIVE");
    }
    if (!command.approvalId) throw new CanvasCommandServiceError("CANVAS_APPROVAL_REQUIRED");
    if (!await this.options.validateApproval(command, scope)) {
      throw new CanvasCommandServiceError("CANVAS_APPROVAL_INVALID");
    }

    const accepted = recovering ?? this.event(command, {});
    if (!recovering) await this.persist(command, digest, accepted);
    try {
      const started = await this.options.startShotProduction({
        scope,
        commandId: command.commandId,
        shotId: payload.shotId,
        prompt: payload.prompt,
        referenceAssetIds: payload.referenceAssetIds,
        referenceAssetUris,
      });
      const taskCreated = this.event(command, {
        eventId: accepted.eventId,
        status: "task_created",
        providerSubmitted: true,
        taskCreated: true,
        taskId: started.taskId,
        replayed: Boolean(recovering),
      });
      await this.updateEvent(command, taskCreated);
      return taskCreated;
    } catch {
      const error = new CanvasCommandServiceError("CANVAS_PROVIDER_FAILED");
      const failed = this.event(command, {
        eventId: accepted.eventId,
        status: "failed",
        error: { code: error.code, message: error.message, retryable: error.retryable },
      });
      await this.updateEvent(command, failed);
      throw error;
    }
  }

  private async mutate(command: CanvasCommandV01, scope: CanvasProductionScope, digest: string): Promise<CanvasEventV01> {
    const payload = command.payload as Record<string, unknown>;
    const event = this.event(command, {});
    await this.persist(command, digest, event);
    try {
      switch (command.commandType) {
        case "SYNC_PROVIDER_ASSET": {
          if (!this.options.syncProviderAsset) throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
          const binding = await this.options.syncProviderAsset(String(payload.assetId), scope);
          await this.options.database("sc_canvas_v1_provider_bindings")
            .insert({
              bindingId: binding.bindingId,
              assetId: binding.assetId,
              tenantId: binding.tenantId,
              projectId: binding.projectId,
              packageId: binding.packageId,
              authorityJson: JSON.stringify(binding),
              updatedAt: binding.updatedAt,
            }).onConflict(["tenantId", "projectId", "packageId", "assetId"]).merge();
          break;
        }
        case "BIND_ASSET_TO_ENTITY": {
          if (!this.options.bindAssetToEntity) throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
          const binding = await this.options.bindAssetToEntity(String(payload.assetId), String(payload.entityId), scope);
          await this.options.database("sc_canvas_v1_entity_bindings")
            .insert({
              bindingId: binding.bindingId,
              assetId: binding.assetId,
              entityId: binding.entityId,
              tenantId: binding.tenantId,
              projectId: binding.projectId,
              packageId: binding.packageId,
              projectionJson: JSON.stringify(binding),
              updatedAt: binding.updatedAt,
            }).onConflict(["tenantId", "projectId", "packageId", "entityId"]).merge();
          break;
        }
        case "SAVE_CANVAS_DOCUMENT":
          await this.documents.save({
            scope,
            documentId: String(payload.documentId),
            expectedVersion: Number(payload.expectedVersion),
            shots: payload.shots as never,
            playlist: payload.playlist as never,
          });
          break;
        case "SELECT_SHOT_OUTPUT": {
          if (this.options.assertOutputAsset && !await this.options.assertOutputAsset(String(payload.outputAssetId), scope)) {
            throw new CanvasCommandServiceError("CANVAS_OUTPUT_REGISTRATION_FAILED");
          }
          const document = await this.documents.read({ scope, documentId: String(payload.documentId) });
          if (!document) throw new CanvasCommandServiceError("CANVAS_DOCUMENT_VERSION_CONFLICT");
          const shots = document.shots.map((shot) => shot.shotId === payload.shotId
            ? { ...shot, selectedOutputAssetId: String(payload.outputAssetId), updatedAt: this.now().toISOString() }
            : shot);
          if (!shots.some((shot) => shot.shotId === payload.shotId)) throw new CanvasCommandServiceError("CANVAS_OUTPUT_REGISTRATION_FAILED");
          await this.documents.save({ scope, documentId: document.documentId, expectedVersion: Number(payload.expectedVersion), shots, playlist: document.playlist });
          break;
        }
        default:
          throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
      }
      return event;
    } catch (cause) {
      const error = toCanvasCommandServiceError(cause);
      const failed = this.event(command, {
        eventId: event.eventId,
        status: "failed",
        error: { code: error.code, message: error.message, retryable: error.retryable },
      });
      await this.updateEvent(command, failed);
      throw error;
    }
  }
}
