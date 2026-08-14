import crypto from "node:crypto";
import { open, mkdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import type { Knex } from "knex";

import type { AssetRecordV01 } from "@/contracts/canvas-v1";
import {
  assertCanvasAssetMaterializationMatchesRequest,
  parseCanvasAssetMaterializationRequestV01,
  parseCanvasAssetMaterializationV01,
} from "@/contracts/canvas-v1/workspaceMaterialization";
import type { CanvasProductionScope } from "../assets-v1";
import {
  ensureProjectMediaDirectories,
  resolveProjectMediaPath,
  sha256File,
} from "../projectMedia";
import type { CanvasAssetMaterializationPort } from "./controlAssetMaterializationClient";

const NAMESPACE = "0f88cfb6-eef3-5961-8e78-c6f5aa24af6c";

export class CanvasV1AssetMaterializationError extends Error {
  constructor(public readonly code:
    | "CANVAS_MATERIALIZATION_SCOPE_MISMATCH"
    | "CANVAS_MATERIALIZATION_ASSET_INVALID"
    | "CANVAS_MATERIALIZATION_CONFLICT"
    | "CANVAS_MATERIALIZATION_PERSISTENCE_FAILED") {
    super("Canvas asset materialization could not be persisted.");
    this.name = "CanvasV1AssetMaterializationError";
  }
}

export interface CanvasV1AssetMaterializerOptions {
  database: Knex;
  client: CanvasAssetMaterializationPort;
  projectsRoot: string;
  now?: () => Date;
  randomId?: () => string;
}

export interface CanvasV1AssetMaterializeInput {
  scope: CanvasProductionScope;
  asset: AssetRecordV01;
  requestId: string;
  materializationAttemptId?: string;
}

export interface CanvasV1AssetMaterializeResult {
  assetId: string;
  localMediaId: string;
  localPath: string;
  replayed: boolean;
}

function uuidV5(name: string): string {
  const bytes = crypto.createHash("sha1")
    .update(Buffer.from(NAMESPACE.replaceAll("-", ""), "hex"))
    .update(name, "utf8").digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function extension(mimeType: "image/jpeg" | "image/png" | "image/webp") {
  return mimeType === "image/jpeg" ? "jpg" : mimeType.slice(6);
}

function sha256(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function exactAssetScope(asset: AssetRecordV01, scope: CanvasProductionScope): boolean {
  return asset.tenantId === scope.tenantId && asset.projectId === scope.projectId
    && asset.packageId === scope.packageId && asset.canvasSessionId === scope.canvasSessionId;
}

async function exists(filePath: string): Promise<boolean> {
  try { await stat(filePath); return true; } catch { return false; }
}

async function publishAtomic(filePath: string, bytes: Buffer, attemptId: string, expectedHash: string): Promise<boolean> {
  await mkdir(path.dirname(filePath), { recursive: true });
  if (await exists(filePath)) {
    if (await sha256File(filePath) !== expectedHash) throw new CanvasV1AssetMaterializationError("CANVAS_MATERIALIZATION_CONFLICT");
    return false;
  }
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${attemptId}.tmp`);
  let temp;
  try {
    temp = await open(tempPath, "wx", 0o600);
    await temp.writeFile(bytes);
    await temp.sync();
  } catch {
    await temp?.close().catch(() => undefined);
    await unlink(tempPath).catch(() => undefined);
    throw new CanvasV1AssetMaterializationError("CANVAS_MATERIALIZATION_PERSISTENCE_FAILED");
  }
  await temp.close();
  try {
    const reservation = await open(filePath, "wx", 0o600);
    await reservation.close();
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    if (await exists(filePath) && await sha256File(filePath) === expectedHash) return false;
    throw new CanvasV1AssetMaterializationError("CANVAS_MATERIALIZATION_CONFLICT");
  }
  try {
    await rename(tempPath, filePath);
    const directory = await open(path.dirname(filePath), "r");
    await directory.sync();
    await directory.close();
    return true;
  } catch {
    await unlink(tempPath).catch(() => undefined);
    await unlink(filePath).catch(() => undefined);
    throw new CanvasV1AssetMaterializationError("CANVAS_MATERIALIZATION_PERSISTENCE_FAILED");
  }
}

export class CanvasV1AssetMaterializer {
  private readonly now: () => Date;
  private readonly randomId: () => string;

  constructor(private readonly options: CanvasV1AssetMaterializerOptions) {
    this.now = options.now ?? (() => new Date());
    this.randomId = options.randomId ?? crypto.randomUUID;
  }

  async materialize(input: CanvasV1AssetMaterializeInput): Promise<CanvasV1AssetMaterializeResult> {
    if (!exactAssetScope(input.asset, input.scope)) {
      throw new CanvasV1AssetMaterializationError("CANVAS_MATERIALIZATION_SCOPE_MISMATCH");
    }
    if (input.asset.category !== "virtual_character" || input.asset.rights.status !== "authorized"
      || input.asset.approval.status !== "approved") {
      throw new CanvasV1AssetMaterializationError("CANVAS_MATERIALIZATION_ASSET_INVALID");
    }
    const occurredAt = this.now().toISOString();
    const request = parseCanvasAssetMaterializationRequestV01({
      objectType: "CanvasAssetMaterializationRequest",
      contractVersion: "0.1",
      tenantId: input.scope.tenantId,
      projectId: input.scope.projectId,
      packageId: input.scope.packageId,
      canvasSessionId: input.scope.canvasSessionId,
      assetId: input.asset.assetId,
      actorId: input.scope.actorId,
      materializationAttemptId: input.materializationAttemptId ?? this.randomId(),
      requestId: input.requestId,
      occurredAt,
    });
    const response = parseCanvasAssetMaterializationV01(await this.options.client.materialize(request));
    assertCanvasAssetMaterializationMatchesRequest(response, request);
    const bytes = Buffer.from(response.contentBase64, "base64");
    const digest = sha256(bytes);
    if (bytes.byteLength !== response.byteSize || `sha256:${digest}` !== response.checksum) {
      throw new CanvasV1AssetMaterializationError("CANVAS_MATERIALIZATION_ASSET_INVALID");
    }
    const localMediaId = uuidV5(
      `materialized-media|tenant=${input.scope.tenantId}|project=${input.scope.projectId}`
      + `|package=${input.scope.packageId}|asset=${input.asset.assetId}`,
    );
    const mappingId = uuidV5(`external-mapping|entityType=canvas-v1-asset|externalId=${input.asset.assetId}`);
    await ensureProjectMediaDirectories(input.scope.localProjectId, this.options.projectsRoot);
    const localPath = resolveProjectMediaPath(
      input.scope.localProjectId,
      "images",
      localMediaId,
      extension(response.mimeType),
      this.options.projectsRoot,
    );

    const existingMappings = await this.options.database("sc_external_mappings")
      .where({ system: "saas-control-plane", entityType: "canvas-v1-asset", externalId: input.asset.assetId }).limit(2);
    if (existingMappings.length > 1 || (existingMappings[0] && existingMappings[0].localId !== localMediaId)) {
      throw new CanvasV1AssetMaterializationError("CANVAS_MATERIALIZATION_CONFLICT");
    }
    const createdFile = await publishAtomic(localPath, bytes, request.materializationAttemptId, digest);
    try {
      const replayed = await this.options.database.transaction(async (transaction) => {
        const mappings = await transaction("sc_external_mappings")
          .where({ system: "saas-control-plane", entityType: "canvas-v1-asset", externalId: input.asset.assetId }).limit(2);
        if (mappings.length > 1 || (mappings[0] && mappings[0].localId !== localMediaId)) {
          throw new CanvasV1AssetMaterializationError("CANVAS_MATERIALIZATION_CONFLICT");
        }
        const media = await transaction("sc_media_assets").where({ id: localMediaId }).first();
        if (media) {
          if (Number(media.projectId) !== input.scope.localProjectId || media.type !== "character"
            || media.mimeType !== response.mimeType || Number(media.byteSize) !== response.byteSize
            || media.sha256 !== digest || media.localPath !== localPath) {
            throw new CanvasV1AssetMaterializationError("CANVAS_MATERIALIZATION_CONFLICT");
          }
        } else {
          await transaction("sc_media_assets").insert({
            id: localMediaId,
            projectId: input.scope.localProjectId,
            type: "character",
            source: "upload",
            originalName: `${input.asset.assetId}.${extension(response.mimeType)}`,
            mimeType: response.mimeType,
            byteSize: response.byteSize,
            localPath,
            remoteUrl: null,
            provider: "saas-control-plane",
            sha256: digest,
            rightsNote: "Control-authorized Canvas V1 asset materialization",
            metadataJson: JSON.stringify({
              tenantId: input.scope.tenantId,
              projectId: input.scope.projectId,
              packageId: input.scope.packageId,
              controlAssetId: input.asset.assetId,
              materializationId: response.materializationId,
            }),
            createdAt: occurredAt,
          });
        }
        if (!mappings[0]) {
          await transaction("sc_external_mappings").insert({
            id: mappingId,
            system: "saas-control-plane",
            entityType: "canvas-v1-asset",
            externalId: input.asset.assetId,
            localId: localMediaId,
            metadataJson: JSON.stringify({
              tenantId: input.scope.tenantId,
              projectId: input.scope.projectId,
              packageId: input.scope.packageId,
              checksum: response.checksum,
            }),
            createdAt: occurredAt,
          });
        }
        return Boolean(media && mappings[0]);
      });
      return { assetId: input.asset.assetId, localMediaId, localPath, replayed: replayed || !createdFile || response.replayed };
    } catch (error) {
      if (error instanceof CanvasV1AssetMaterializationError) throw error;
      throw new CanvasV1AssetMaterializationError("CANVAS_MATERIALIZATION_CONFLICT");
    }
  }
}
