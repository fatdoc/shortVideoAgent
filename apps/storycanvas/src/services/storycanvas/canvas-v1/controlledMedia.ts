import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { Knex } from "knex";

import { parseCanvasV1Contract, type CanvasCommandV01, type CanvasEventV01 } from "@/contracts/canvas-v1";
import type { CanvasProductionScope } from "../assets-v1";
import {
  createSignedTosGetUrl,
  getBytePlusTosUploadTarget,
  type BytePlusTosTarget,
} from "../byteplusTos";
import { buildRemoteOutputKey } from "../remoteOutputStorage";
import { resolveProjectMediaPath, sha256File } from "../projectMedia";
import getPath from "@/utils/getPath";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const RANGE = /^bytes=(?:\d+-\d*|\d*-\d+)$/;

export class CanvasV1ControlledMediaError extends Error {
  readonly status = 404;
  readonly retryable = false;
  constructor(public readonly code: "CANVAS_MEDIA_NOT_FOUND") {
    super("Controlled Canvas media was not found.");
    this.name = "CanvasV1ControlledMediaError";
  }
}

export interface CanvasV1ControlledMediaOpenInput {
  scope: CanvasProductionScope;
  assetId: string;
  range?: string;
}

export interface CanvasV1ControlledMediaOutput {
  status: 200 | 206;
  contentType: string;
  contentLength?: number;
  contentRange?: string;
  acceptRanges: "bytes";
  body: ReadableStream<Uint8Array>;
}

export interface CanvasV1ControlledMediaServiceOptions {
  database: Knex;
  projectsRoot?: string;
  resolveTarget?: () => Promise<BytePlusTosTarget>;
  signGet?: (key: string, target: BytePlusTosTarget, date?: Date, expiresSeconds?: number) => string;
  fetch?: typeof fetch;
  now?: () => Date;
}

function fail(): never { throw new CanvasV1ControlledMediaError("CANVAS_MEDIA_NOT_FOUND"); }

function hasExactAuthority(
  value: Pick<CanvasCommandV01 | CanvasEventV01, "tenantId" | "projectId" | "packageId" | "canvasSessionId">,
  scope: CanvasProductionScope,
): boolean {
  return value.tenantId === scope.tenantId
    && value.projectId === scope.projectId
    && value.packageId === scope.packageId
    && value.canvasSessionId === scope.canvasSessionId;
}

function safeJson(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

function parseLocalRange(value: string | undefined, size: number): { start: number; end: number } | null {
  if (!value) return null;
  const expression = value.slice("bytes=".length);
  const [rawStart, rawEnd] = expression.split("-", 2);
  if (rawStart === "") {
    const suffix = Number(rawEnd);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) fail();
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(rawStart);
  const requestedEnd = rawEnd === "" ? size - 1 : Number(rawEnd);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd)
    || start < 0 || start >= size || requestedEnd < start) fail();
  return { start, end: Math.min(requestedEnd, size - 1) };
}

export class CanvasV1ControlledMediaService {
  private readonly resolveTarget: () => Promise<BytePlusTosTarget>;
  private readonly signGet: NonNullable<CanvasV1ControlledMediaServiceOptions["signGet"]>;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(private readonly options: CanvasV1ControlledMediaServiceOptions) {
    this.resolveTarget = options.resolveTarget ?? getBytePlusTosUploadTarget;
    this.signGet = options.signGet ?? createSignedTosGetUrl;
    this.fetchImpl = options.fetch ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  async open(input: CanvasV1ControlledMediaOpenInput): Promise<CanvasV1ControlledMediaOutput> {
    if (!UUID.test(input.assetId) || (input.range && (input.range.length > 100 || !RANGE.test(input.range)))) fail();
    const mediaRows = await this.options.database("sc_media_assets")
      .where({ id: input.assetId, projectId: input.scope.localProjectId, source: "generated" }).limit(2);
    if (mediaRows.length !== 1 || !["image", "video"].includes(String(mediaRows[0].type))) fail();
    const media = mediaRows[0];
    const metadata = safeJson(media.metadataJson);
    const taskId = typeof metadata?.taskId === "string" ? metadata.taskId : null;
    const storage = metadata?.storage && typeof metadata.storage === "object" && !Array.isArray(metadata.storage)
      ? metadata.storage as Record<string, unknown> : null;
    if (!taskId || !UUID.test(taskId) || !storage
      || !["byteplus-tos", "storycanvas-local"].includes(String(storage.provider))) fail();
    const taskRows = await this.options.database("sc_tasks")
      .where({ id: taskId, projectId: input.scope.localProjectId, status: "succeeded" }).limit(2);
    if (taskRows.length !== 1 || safeJson(taskRows[0].outputJson)?.outputAssetId !== input.assetId) fail();

    const eventRows = await this.options.database("sc_canvas_v1_events")
      .where({ tenantId: input.scope.tenantId, projectId: input.scope.projectId, packageId: input.scope.packageId,
        canvasSessionId: input.scope.canvasSessionId }).limit(1_001);
    const matchingEvents: CanvasEventV01[] = [];
    for (const row of eventRows) {
      try {
        const event = parseCanvasV1Contract(JSON.parse(String(row.eventJson)));
        if (event.objectType !== "CanvasEvent"
          || !hasExactAuthority(event, input.scope)
          || event.eventId !== String(row.eventId)
          || event.commandId !== String(row.commandId)
          || event.status !== String(row.status)) fail();
        if (event.commandType === "GENERATE_SHOT"
          && event.taskId === taskId
          && (event.outputAssetId === null || event.outputAssetId === input.assetId)) matchingEvents.push(event);
      } catch { fail(); }
    }
    if (matchingEvents.length !== 1) fail();
    const event = matchingEvents[0];
    const commandRows = await this.options.database("sc_canvas_v1_commands")
      .where({ commandId: event.commandId, tenantId: input.scope.tenantId, projectId: input.scope.projectId,
        packageId: input.scope.packageId, canvasSessionId: input.scope.canvasSessionId, commandType: "GENERATE_SHOT" }).limit(2);
    if (commandRows.length !== 1) fail();
    let command: CanvasCommandV01;
    try {
      const parsed = parseCanvasV1Contract(JSON.parse(String(commandRows[0].commandJson)));
      if (parsed.objectType !== "CanvasCommand"
        || !hasExactAuthority(parsed, input.scope)
        || parsed.requestedByActorId !== input.scope.actorId
        || parsed.commandId !== String(commandRows[0].commandId)
        || parsed.commandId !== event.commandId
        || parsed.commandType !== String(commandRows[0].commandType)
        || parsed.commandType !== event.commandType
        || parsed.commandType !== "GENERATE_SHOT") fail();
      command = parsed;
    } catch { fail(); }
    if (!(command.payload as { shotId?: unknown }).shotId) fail();

    if (storage.provider === "storycanvas-local") {
      const projectsRoot = this.options.projectsRoot ?? getPath("projects");
      let expectedPath: string;
      try {
        expectedPath = resolveProjectMediaPath(
          input.scope.localProjectId,
          "videos",
          input.assetId,
          "mp4",
          projectsRoot,
        );
      } catch { fail(); }
      if (media.localPath !== expectedPath || media.mimeType !== "video/mp4"
        || !Number.isSafeInteger(Number(media.byteSize)) || Number(media.byteSize) < 1
        || typeof media.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(media.sha256)) fail();
      let file;
      try { file = await lstat(expectedPath); } catch { fail(); }
      if (!file.isFile() || file.isSymbolicLink() || file.size !== Number(media.byteSize)) fail();
      try {
        if (await sha256File(expectedPath) !== media.sha256) fail();
      } catch { fail(); }
      const range = parseLocalRange(input.range, file.size);
      const start = range?.start ?? 0;
      const end = range?.end ?? file.size - 1;
      return {
        status: range ? 206 : 200,
        contentType: "video/mp4",
        contentLength: end - start + 1,
        contentRange: range ? `bytes ${start}-${end}/${file.size}` : undefined,
        acceptRanges: "bytes",
        body: Readable.toWeb(createReadStream(expectedPath, range ? { start, end } : undefined)) as ReadableStream<Uint8Array>,
      };
    }

    let target: BytePlusTosTarget;
    try { target = await this.resolveTarget(); } catch { fail(); }
    let expectedKey: string;
    try {
      expectedKey = buildRemoteOutputKey(
        { projectId: input.scope.localProjectId, taskId, assetId: input.assetId },
        String(media.mimeType),
        target.prefix,
      );
    } catch { fail(); }
    if (storage?.bucket !== target.bucket || storage?.key !== expectedKey
      || media.localPath !== `tos://${target.bucket}/${expectedKey}`) fail();
    const signedUrl = this.signGet(expectedKey, target, this.now(), 60);
    let response: Response;
    try {
      response = await this.fetchImpl(signedUrl, {
        method: "GET",
        headers: input.range ? { range: input.range } : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(120_000),
      });
    } catch { fail(); }
    if ((response.status !== 200 && response.status !== 206) || !response.body
      || response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== String(media.mimeType).toLowerCase()
      || (input.range && response.status !== 206)) fail();
    const contentLengthValue = response.headers.get("content-length");
    const contentLength = contentLengthValue && /^\d{1,20}$/.test(contentLengthValue) ? Number(contentLengthValue) : undefined;
    if (contentLength !== undefined && !Number.isSafeInteger(contentLength)) fail();
    const contentRange = response.status === 206 ? response.headers.get("content-range") ?? undefined : undefined;
    if (response.status === 206 && (!contentRange || !/^bytes \d+-\d+\/\d+$/.test(contentRange))) fail();
    return {
      status: response.status,
      contentType: String(media.mimeType),
      contentLength,
      contentRange,
      acceptRanges: "bytes",
      body: response.body,
    };
  }
}
