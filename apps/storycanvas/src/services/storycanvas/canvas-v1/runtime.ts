import type { Request, Response } from "express";
import type { Knex } from "knex";

import {
  parseCanvasV1Contract,
  type AssetRecordV01,
  type CanvasCommandV01,
  type ProviderAssetBindingV01,
  type ShotReadinessV01,
} from "@/contracts/canvas-v1";
import { createCanvasV1ProductionRouter } from "@/routes/production/pilot/canvas/commands";
import type {
  PilotCanvasSessionContext,
  PilotCanvasServerAuthority,
} from "../pilotCanvasCapability";
import type { CanvasProductionScope } from "../assets-v1";
import { CanvasCommandService } from "./canvasCommandService";
import { CanvasDocumentStore } from "./documentStore";
import { CanvasCommandServiceError } from "./errors";
import { acceptCanvasV1RuntimeAuthority } from "./runtimeAuthorityAcceptance";
import {
  createCanvasV1AssetRuntimeAdapters,
  createCanvasV1OutputAssetAssertion,
} from "./runtimeAssetAdapters";
import type { BytePlusAssetItem } from "../byteplusAssets";
import { ControlCanvasWorkspaceAuthorityClient } from "./controlWorkspaceAuthorityClient";
import {
  CanvasV1WorkspacePreparer,
  type CanvasWorkspaceAuthorityPort,
} from "./workspacePrepare";
import { CanvasV1WorkspaceReader } from "./workspaceProjection";
import type { CanvasWorkspaceAuthorityV01 } from "@/contracts/canvas-v1/workspaceMaterialization";
import { isCanvasV1ShotProductionConfigured } from "./shotProductionAdapter";

interface ProjectionRow {
  projectionJson: string;
}

interface ProviderProjectionRow {
  authorityJson: string;
}

export interface CanvasV1RuntimeRouterOptions {
  database: Knex;
  allowedOrigin: string;
  verifySession(cookie: string): Promise<PilotCanvasSessionContext | null>;
  readAuthority(canvasSessionId: string): PilotCanvasServerAuthority | null;
  acceptAuthority?(
    database: Knex,
    approvedPackage: PilotCanvasServerAuthority["redemption"]["productionPackage"],
  ): Promise<number>;
  validateApproval?(command: CanvasCommandV01, scope: CanvasProductionScope): Promise<boolean>;
  startShotProduction?: ConstructorParameters<typeof CanvasCommandService>[0]["startShotProduction"];
  queryProviderAsset?(providerAssetId: string): Promise<BytePlusAssetItem>;
  workspaceAuthorityClient?: CanvasWorkspaceAuthorityPort;
  now?: () => Date;
  capabilityAvailable?: () => boolean;
}

function sessionId(request: Request): string {
  const candidate = request.method === "GET" || request.method === "HEAD"
    ? request.header("x-canvas-session-id")
    : (request.body as { canvasSessionId?: unknown } | null)?.canvasSessionId;
  if (typeof candidate !== "string" || !/^pcs_[A-Za-z0-9_-]{24,128}$/.test(candidate)) {
    throw new CanvasCommandServiceError("CANVAS_SESSION_INVALID");
  }
  return candidate;
}

async function serverScope(
  options: CanvasV1RuntimeRouterOptions,
  canvasSessionId: string,
): Promise<CanvasProductionScope> {
  const authority = options.readAuthority(canvasSessionId);
  if (!authority || Date.parse(authority.expiresAt) <= Date.now()) {
    throw new CanvasCommandServiceError("CANVAS_SESSION_INVALID");
  }
  const redemption = authority.redemption;
  return {
    tenantId: redemption.tenantId,
    projectId: redemption.projectId,
    packageId: redemption.packageId,
    canvasSessionId,
    actorId: authority.actorId,
    localProjectId: await (options.acceptAuthority ?? acceptCanvasV1RuntimeAuthority)(
      options.database,
      redemption.productionPackage,
    ),
  };
}

function exactOrigin(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.origin === value && ["http:", "https:"].includes(parsed.protocol)
      && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function parseProjection<T extends AssetRecordV01 | ShotReadinessV01>(value: string): T {
  const parsed = parseCanvasV1Contract(JSON.parse(value));
  return parsed as T;
}

export function createCanvasV1RuntimeRouter(options: CanvasV1RuntimeRouterOptions) {
  if (!exactOrigin(options.allowedOrigin)) {
    throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
  }
  const documents = new CanvasDocumentStore({ database: options.database });
  const assetAdapters = createCanvasV1AssetRuntimeAdapters({
    database: options.database,
    queryProviderAsset: options.queryProviderAsset,
  });
  let authorityClient = options.workspaceAuthorityClient;
  if (!authorityClient) {
    try {
      authorityClient = new ControlCanvasWorkspaceAuthorityClient({
        controlApiBaseUrl: process.env.CONTROL_API_BASE_URL?.trim() ?? "",
        internalToken: process.env.PRODUCTION_PLANE_INTERNAL_TOKEN?.trim() ?? "",
      });
    } catch {
      authorityClient = undefined;
    }
  }
  const preparedAuthorities = new Map<string, CanvasWorkspaceAuthorityV01>();
  const preparer = authorityClient ? new CanvasV1WorkspacePreparer({
    database: options.database,
    authorityClient,
    now: options.now,
    capabilityAvailable: options.capabilityAvailable ?? (() => isCanvasV1ShotProductionConfigured()),
  }) : null;
  const workspaceReader = new CanvasV1WorkspaceReader({ database: options.database, now: options.now });

  const resolveRequestScope = async (
    request: Request,
    response?: Response,
  ): Promise<CanvasProductionScope> => {
    if (request.header("origin") !== options.allowedOrigin) {
      throw new CanvasCommandServiceError("CANVAS_SESSION_INVALID");
    }
    const session = await options.verifySession(request.header("cookie") ?? "");
    if (!session) throw new CanvasCommandServiceError("CANVAS_SESSION_INVALID");
    if (session.setCookie && response) response.setHeader("set-cookie", session.setCookie);
    const scope = await serverScope(options, sessionId(request));
    if (session.tenantId !== scope.tenantId || session.actorId !== scope.actorId) {
      throw new CanvasCommandServiceError("CANVAS_SCOPE_MISMATCH");
    }
    return scope;
  };

  const commandService = new CanvasCommandService({
    database: options.database,
    resolveScope: async (command) => serverScope(options, command.canvasSessionId),
    validateApproval: options.validateApproval ?? (async () => false),
    getReadiness: async (readinessId, scope) => {
      const row = await options.database<ProjectionRow>("sc_canvas_v1_readiness")
        .where({
          readinessId,
          tenantId: scope.tenantId,
          projectId: scope.projectId,
          packageId: scope.packageId,
        })
        .first();
      return row ? parseProjection<ShotReadinessV01>(row.projectionJson) : null;
    },
    resolveProviderAssetUris: async (assetIds, scope) => {
      const rows = await options.database<ProviderProjectionRow>("sc_canvas_v1_provider_bindings")
        .where({ tenantId: scope.tenantId, projectId: scope.projectId, packageId: scope.packageId })
        .whereIn("assetId", assetIds);
      const byAsset = new Map(rows.map((row) => {
        const parsed = parseCanvasV1Contract(JSON.parse(row.authorityJson));
        if (parsed.objectType !== "ProviderAssetBinding") return ["", null] as const;
        const binding = parsed as ProviderAssetBindingV01;
        return [binding.assetId, binding.providerStatus === "active" ? binding.assetUri : null] as const;
      }));
      return assetIds.map((assetId) => byAsset.get(assetId)).filter((value): value is string => Boolean(value));
    },
    startShotProduction: options.startShotProduction ?? (async () => {
      throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
    }),
    syncProviderAsset: assetAdapters.syncProviderAsset,
    bindAssetToEntity: assetAdapters.bindAssetToEntity,
    assertOutputAsset: createCanvasV1OutputAssetAssertion(options.database),
    documentStore: documents,
  });

  return createCanvasV1ProductionRouter({
    resolveRequestScope,
    commandService,
    assets: {
      list: async (scope) => {
        const rows = await options.database<ProjectionRow>("sc_canvas_v1_asset_records")
          .where({ tenantId: scope.tenantId, projectId: scope.projectId, packageId: scope.packageId })
          .orderBy("updatedAt", "desc");
        return rows.map((row) => parseProjection<AssetRecordV01>(row.projectionJson));
      },
      getReadiness: async (shotId, scope) => {
        const row = await options.database<ProjectionRow>("sc_canvas_v1_readiness")
          .where({ shotId, tenantId: scope.tenantId, projectId: scope.projectId, packageId: scope.packageId })
          .orderBy("evaluatedAt", "desc")
          .first();
        return row ? parseProjection<ShotReadinessV01>(row.projectionJson) : null;
      },
    },
    documents,
    formalBootstrap: {
      prepare: async (scope, requestId) => {
        if (!preparer) throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
        const authority = options.readAuthority(scope.canvasSessionId);
        if (!authority) throw new CanvasCommandServiceError("CANVAS_SESSION_INVALID");
        const prepared = await preparer.prepare({
          scope,
          approvedPackage: authority.redemption.productionPackage,
          requestId,
        });
        preparedAuthorities.set(scope.canvasSessionId, prepared.authority);
        return prepared.bootstrap;
      },
    },
    workspace: {
      read: async (scope, requestId) => {
        const authority = options.readAuthority(scope.canvasSessionId);
        const workspaceAuthority = preparedAuthorities.get(scope.canvasSessionId);
        if (!authority || !workspaceAuthority) throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
        return workspaceReader.read({
          scope,
          approvedPackage: authority.redemption.productionPackage,
          authority: workspaceAuthority,
          requestId,
        });
      },
    },
  });
}
