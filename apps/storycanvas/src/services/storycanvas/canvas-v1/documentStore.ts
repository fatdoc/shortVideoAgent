import type { Knex } from "knex";

import {
  parseCanvasV1Contract,
  type CanvasDocumentV01,
} from "@/contracts/canvas-v1";
import type { CanvasProductionScope } from "../assets-v1";
import { CanvasCommandServiceError } from "./errors";

interface DocumentRow {
  documentId: string;
  tenantId: string;
  projectId: string;
  packageId: string;
  currentCanvasSessionId: string;
  status: "active" | "archived";
  version: number;
  shotsJson: string;
  playlistJson: string;
  createdAt: string;
  updatedAt: string;
}

type DocumentContent = Pick<CanvasDocumentV01, "shots" | "playlist">;

export interface CanvasDocumentStoreOptions {
  database: Knex;
  now?: () => Date;
}

export interface CreateCanvasDocumentInput extends DocumentContent {
  scope: CanvasProductionScope;
  documentId: string;
}

export interface ReadCanvasDocumentInput {
  scope: CanvasProductionScope;
  documentId: string;
}

export interface SaveCanvasDocumentInput extends CreateCanvasDocumentInput {
  expectedVersion: number;
}

function rowScope(input: ReadCanvasDocumentInput) {
  return {
    tenantId: input.scope.tenantId,
    projectId: input.scope.projectId,
    packageId: input.scope.packageId,
    documentId: input.documentId,
  };
}

function documentFromRow(row: DocumentRow, canvasSessionId: string): CanvasDocumentV01 {
  const value: CanvasDocumentV01 = {
    objectType: "CanvasDocument",
    contractVersion: "0.1",
    tenantId: row.tenantId,
    projectId: row.projectId,
    packageId: row.packageId,
    canvasSessionId,
    documentId: row.documentId,
    status: row.status,
    version: Number(row.version),
    shots: JSON.parse(row.shotsJson) as CanvasDocumentV01["shots"],
    playlist: JSON.parse(row.playlistJson) as CanvasDocumentV01["playlist"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    occurredAt: row.updatedAt,
  };
  return parseCanvasV1Contract(value) as CanvasDocumentV01;
}

export class CanvasDocumentStore {
  private readonly now: () => Date;
  constructor(private readonly options: CanvasDocumentStoreOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async create(input: CreateCanvasDocumentInput): Promise<CanvasDocumentV01> {
    const existing = await this.options.database<DocumentRow>("sc_canvas_v1_documents")
      .where(rowScope(input)).first();
    if (existing) return documentFromRow(existing, input.scope.canvasSessionId);
    const timestamp = this.now().toISOString();
    const candidate: CanvasDocumentV01 = {
      objectType: "CanvasDocument",
      contractVersion: "0.1",
      tenantId: input.scope.tenantId,
      projectId: input.scope.projectId,
      packageId: input.scope.packageId,
      canvasSessionId: input.scope.canvasSessionId,
      documentId: input.documentId,
      status: "active",
      version: 1,
      shots: input.shots,
      playlist: input.playlist,
      createdAt: timestamp,
      updatedAt: timestamp,
      occurredAt: timestamp,
    };
    const parsed = parseCanvasV1Contract(candidate) as CanvasDocumentV01;
    await this.options.database("sc_canvas_v1_documents").insert({
      ...rowScope(input),
      currentCanvasSessionId: input.scope.canvasSessionId,
      status: parsed.status,
      version: parsed.version,
      shotsJson: JSON.stringify(parsed.shots),
      playlistJson: JSON.stringify(parsed.playlist),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return parsed;
  }

  async read(input: ReadCanvasDocumentInput): Promise<CanvasDocumentV01 | null> {
    const row = await this.options.database<DocumentRow>("sc_canvas_v1_documents")
      .where(rowScope(input)).first();
    if (!row) return null;
    if (row.currentCanvasSessionId !== input.scope.canvasSessionId) {
      await this.options.database("sc_canvas_v1_documents").where(rowScope(input)).update({
        currentCanvasSessionId: input.scope.canvasSessionId,
      });
    }
    return documentFromRow(row, input.scope.canvasSessionId);
  }

  async save(input: SaveCanvasDocumentInput): Promise<CanvasDocumentV01> {
    return this.options.database.transaction(async (transaction) => {
      const row = await transaction<DocumentRow>("sc_canvas_v1_documents").where(rowScope(input)).first();
      if (!row || Number(row.version) !== input.expectedVersion) {
        throw new CanvasCommandServiceError("CANVAS_DOCUMENT_VERSION_CONFLICT");
      }
      const timestamp = this.now().toISOString();
      const candidate: CanvasDocumentV01 = {
        ...documentFromRow(row, input.scope.canvasSessionId),
        canvasSessionId: input.scope.canvasSessionId,
        version: input.expectedVersion + 1,
        shots: input.shots,
        playlist: input.playlist,
        updatedAt: timestamp,
        occurredAt: timestamp,
      };
      const parsed = parseCanvasV1Contract(candidate) as CanvasDocumentV01;
      const changed = await transaction("sc_canvas_v1_documents")
        .where({ ...rowScope(input), version: input.expectedVersion })
        .update({
          currentCanvasSessionId: input.scope.canvasSessionId,
          version: parsed.version,
          shotsJson: JSON.stringify(parsed.shots),
          playlistJson: JSON.stringify(parsed.playlist),
          updatedAt: timestamp,
        });
      if (changed !== 1) throw new CanvasCommandServiceError("CANVAS_DOCUMENT_VERSION_CONFLICT");
      return parsed;
    });
  }
}
