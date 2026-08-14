import type { Request, Response } from "express";
import type { Knex } from "knex";

import {
  parseCanvasV1Contract,
  type AssetRecordV01,
  type CanvasBootstrapV01,
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
import {
  ControlCanvasAssetMaterializationClient,
  type CanvasAssetMaterializationPort,
} from "./controlAssetMaterializationClient";
import { CanvasV1AssetMaterializer } from "./assetMaterialization";
import getPath from "@/utils/getPath";
import { CanvasV1ControlledMediaService } from "./controlledMedia";

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
  assetMaterializationClient?: CanvasAssetMaterializationPort;
  projectsRoot?: string;
  controlledMedia?: Pick<CanvasV1ControlledMediaService, "open">;
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

function exactRefererOrigin(value: string | undefined, allowedOrigin: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.origin === allowedOrigin
      && ["http:", "https:"].includes(parsed.protocol)
      && !parsed.username
      && !parsed.password;
  } catch {
    return false;
  }
}

function hasTrustedBrowserProvenance(request: Request, allowedOrigin: string): boolean {
  const origin = request.header("origin");
  const formalBrowserRead = request.method === "GET"
    && (request.baseUrl.endsWith("/bootstrap") || request.baseUrl.endsWith("/workspace"));
  if (!formalBrowserRead) return origin === allowedOrigin;
  const fetchSite = request.header("sec-fetch-site");
  const fetchMode = request.header("sec-fetch-mode");
  const fetchDest = request.header("sec-fetch-dest");
  const referer = request.header("referer");
  if ((origin !== undefined && origin !== allowedOrigin)
    || (fetchSite !== undefined && fetchSite !== "same-origin")
    || (fetchMode !== undefined && fetchMode !== "cors")
    || (fetchDest !== undefined && fetchDest !== "empty")
    || (referer !== undefined && !exactRefererOrigin(referer, allowedOrigin))) {
    return false;
  }
  return fetchSite === "same-origin"
    && fetchMode === "cors"
    && fetchDest === "empty"
    && exactRefererOrigin(referer, allowedOrigin);
}

function formalPreparationKey(scope: CanvasProductionScope, authority: PilotCanvasServerAuthority): string {
  const productionPackage = authority.redemption.productionPackage;
  return [
    scope.tenantId,
    scope.projectId,
    scope.packageId,
    scope.canvasSessionId,
    scope.actorId,
    String(scope.localProjectId),
    authority.expiresAt,
    authority.redemption.handle,
    productionPackage.payloadDigest,
    String(productionPackage.packageVersion),
    productionPackage.scriptVersionId,
    productionPackage.storyboardVersionId,
  ].join("\u001f");
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
  const preparingBootstraps = new Map<string, Promise<CanvasBootstrapV01>>();
  const preparer = authorityClient ? new CanvasV1WorkspacePreparer({
    database: options.database,
    authorityClient,
    now: options.now,
    capabilityAvailable: options.capabilityAvailable ?? (() => isCanvasV1ShotProductionConfigured()),
  }) : null;
  const workspaceReader = new CanvasV1WorkspaceReader({ database: options.database, now: options.now });
  let assetMaterializationClient = options.assetMaterializationClient;
  if (!assetMaterializationClient) {
    try {
      assetMaterializationClient = new ControlCanvasAssetMaterializationClient({
        controlApiBaseUrl: process.env.CONTROL_API_BASE_URL?.trim() ?? "",
        internalToken: process.env.PRODUCTION_PLANE_INTERNAL_TOKEN?.trim() ?? "",
      });
    } catch {
      assetMaterializationClient = undefined;
    }
  }
  const materializer = assetMaterializationClient ? new CanvasV1AssetMaterializer({
    database: options.database,
    client: assetMaterializationClient,
    projectsRoot: options.projectsRoot ?? getPath("projects"),
    now: options.now,
  }) : null;
  const controlledMedia = options.controlledMedia
    ?? new CanvasV1ControlledMediaService({ database: options.database, now: options.now });

  const resolveRequestScope = async (
    request: Request,
    response?: Response,
  ): Promise<CanvasProductionScope> => {
    if (!hasTrustedBrowserProvenance(request, options.allowedOrigin)) {
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
        const preparationKey = formalPreparationKey(scope, authority);
        const existing = preparingBootstraps.get(preparationKey);
        if (existing) return existing;
        const preparing = (async () => {
          const prepared = await preparer.prepare({
            scope,
            approvedPackage: authority.redemption.productionPackage,
            requestId,
          });
          const primaryAssets = prepared.authority.assets.filter(({ category }) => category === "virtual_character");
          const primary = primaryAssets[0];
          if (materializer && primary && primary.rights.status === "authorized" && primary.approval.status === "approved") {
            try {
              await materializer.materialize({ scope, asset: primary, requestId });
            } catch {
              throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
            }
          }
          preparedAuthorities.set(scope.canvasSessionId, prepared.authority);
          return prepared.bootstrap;
        })();
        preparingBootstraps.set(preparationKey, preparing);
        try {
          return await preparing;
        } finally {
          if (preparingBootstraps.get(preparationKey) === preparing) {
            preparingBootstraps.delete(preparationKey);
          }
        }
      },
    },
    workspace: {
      read: async (scope, requestId) => {
        const authority = options.readAuthority(scope.canvasSessionId);
        const workspaceAuthority = preparedAuthorities.get(scope.canvasSessionId);
        if (!authority || !workspaceAuthority) throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
        await commandService.resumePendingGenerations(scope);
        return workspaceReader.read({
          scope,
          approvedPackage: authority.redemption.productionPackage,
          authority: workspaceAuthority,
          requestId,
        });
      },
    },
    media: { media: controlledMedia },
  });
}
