import { CanvasAssetDomainError } from './errors.js';
import { parseAssetRecordProjection } from './parser.js';
import { ASSET_CATEGORIES, type AssetAuthorityRecord, type AssetRecordProjection } from './types.js';
import { CanvasWorkspaceAuthorityError, workspaceAuthorityError } from './workspaceAuthorityErrors.js';
import {
  CanvasWorkspaceAuthorityLookupError,
  type CanvasWorkspaceAuthorityDependencies,
  type CanvasWorkspaceAuthorityRequest,
  type CanvasWorkspaceAuthorityResponse,
} from './workspaceAuthorityTypes.js';
import {
  parseCanvasWorkspaceAuthorityRequest,
  parseCanvasWorkspaceAuthorityResponse,
} from './workspaceAuthorityParser.js';

function clockValue(clock: () => Date): Date {
  const value = clock();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw workspaceAuthorityError('CANVAS_WORKSPACE_AUTHORITY_DEPENDENCY_UNAVAILABLE');
  }
  return new Date(value.getTime());
}

function iso(value: Date | null): string | null {
  if (value === null) return null;
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw workspaceAuthorityError('CANVAS_WORKSPACE_AUTHORITY_ASSETS_INCOMPLETE');
  }
  return value.toISOString();
}

function effectiveRights(record: AssetAuthorityRecord, occurredAt: Date) {
  if (
    record.rightsStatus === 'authorized' &&
    record.rightsValidUntil &&
    record.rightsValidUntil.getTime() <= occurredAt.getTime()
  ) {
    return 'expired' as const;
  }
  return record.rightsStatus;
}

function projectAsset(
  record: AssetAuthorityRecord,
  request: CanvasWorkspaceAuthorityRequest,
  occurredAt: Date,
): AssetRecordProjection {
  return parseAssetRecordProjection({
    objectType: 'AssetRecord',
    contractVersion: '0.1',
    tenantId: request.tenantId,
    projectId: request.projectId,
    packageId: request.packageId,
    canvasSessionId: request.canvasSessionId,
    assetId: record.assetId,
    category: record.category,
    displayName: record.displayName,
    provenance: {
      kind: record.provenanceKind,
      sourceAssetId: record.sourceAssetId,
      declaredByActorId: record.declaredByActorId,
      declaredAt: iso(record.declaredAt),
    },
    rights: {
      status: effectiveRights(record, occurredAt),
      basis: record.rightsBasis,
      validFrom: iso(record.rightsValidFrom),
      validUntil: iso(record.rightsValidUntil),
      reviewedAt: iso(record.rightsReviewedAt),
    },
    approval: {
      status: record.approvalStatus,
      reviewedByActorId: record.approvalReviewedByActorId,
      reviewedAt: iso(record.approvalReviewedAt),
    },
    controlledPreviewUrl: record.controlledPreviewUrl,
    createdAt: iso(record.createdAt),
    updatedAt: iso(record.updatedAt),
    occurredAt: occurredAt.toISOString(),
  });
}

function mapLookupError(error: CanvasWorkspaceAuthorityLookupError): CanvasWorkspaceAuthorityError {
  switch (error.kind) {
    case 'package':
      return workspaceAuthorityError('CANVAS_WORKSPACE_AUTHORITY_PACKAGE_NOT_FOUND');
    case 'project':
      return workspaceAuthorityError('CANVAS_WORKSPACE_AUTHORITY_PROJECT_UNAVAILABLE');
    case 'script':
      return workspaceAuthorityError('CANVAS_WORKSPACE_AUTHORITY_SCRIPT_UNAVAILABLE');
    case 'storyboard':
      return workspaceAuthorityError('CANVAS_WORKSPACE_AUTHORITY_STORYBOARD_UNAVAILABLE');
    case 'dependency':
      return workspaceAuthorityError('CANVAS_WORKSPACE_AUTHORITY_DEPENDENCY_UNAVAILABLE');
  }
}

export class CanvasWorkspaceAuthorityService {
  private readonly now: () => Date;

  constructor(private readonly dependencies: CanvasWorkspaceAuthorityDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async read(inputValue: unknown): Promise<CanvasWorkspaceAuthorityResponse> {
    const input = parseCanvasWorkspaceAuthorityRequest(inputValue);
    const now = clockValue(this.now);

    try {
      await this.dependencies.sessionAuthority.assertActiveSession({
        tenantId: input.tenantId,
        projectId: input.projectId,
        packageId: input.packageId,
        canvasSessionId: input.canvasSessionId,
        actorId: input.actorId,
      });
    } catch (error) {
      if (error instanceof CanvasAssetDomainError && error.code === 'CANVAS_SESSION_INVALID') {
        throw workspaceAuthorityError('CANVAS_WORKSPACE_AUTHORITY_SESSION_INVALID');
      }
      throw workspaceAuthorityError('CANVAS_WORKSPACE_AUTHORITY_DEPENDENCY_UNAVAILABLE');
    }

    let authority;
    try {
      authority = await this.dependencies.productionAuthority.readExact({
        tenantId: input.tenantId,
        projectId: input.projectId,
        packageId: input.packageId,
        now,
      });
    } catch (error) {
      if (error instanceof CanvasWorkspaceAuthorityLookupError) throw mapLookupError(error);
      throw workspaceAuthorityError('CANVAS_WORKSPACE_AUTHORITY_DEPENDENCY_UNAVAILABLE');
    }

    let records: AssetAuthorityRecord[];
    try {
      records = await this.dependencies.assets.listAssets({
        tenantId: input.tenantId,
        projectId: input.projectId,
      });
    } catch {
      throw workspaceAuthorityError('CANVAS_WORKSPACE_AUTHORITY_ASSETS_INCOMPLETE');
    }

    try {
      const scopedRecords = records.filter((record) => record.packageId === input.packageId);
      if (
        scopedRecords.length > 1000 ||
        scopedRecords.some(
          (record) =>
            record.tenantId !== input.tenantId || record.projectId !== input.projectId,
        )
      ) {
        throw workspaceAuthorityError('CANVAS_WORKSPACE_AUTHORITY_ASSETS_INCOMPLETE');
      }
      const assets = scopedRecords.map((record) => projectAsset(record, input, now));
      const categoryRank = new Map(ASSET_CATEGORIES.map((category, index) => [category, index]));
      assets.sort((left, right) => {
        const rank = categoryRank.get(left.category)! - categoryRank.get(right.category)!;
        if (rank) return rank;
        const leftId = left.assetId.toLowerCase();
        const rightId = right.assetId.toLowerCase();
        return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
      });

      const virtualCharacters = assets.filter(({ category }) => category === 'virtual_character');
      if (virtualCharacters.length === 0) {
        throw workspaceAuthorityError('PRIMARY_VIRTUAL_CHARACTER_MISSING');
      }
      if (virtualCharacters.length > 1) {
        throw workspaceAuthorityError('PRIMARY_VIRTUAL_CHARACTER_AMBIGUOUS');
      }

      return parseCanvasWorkspaceAuthorityResponse({
        objectType: 'CanvasWorkspaceAuthority',
        contractVersion: '0.1',
        tenantId: input.tenantId,
        projectId: input.projectId,
        packageId: input.packageId,
        canvasSessionId: input.canvasSessionId,
        project: { projectName: authority.projectName },
        approvedScript: {
          scriptId: authority.scriptId,
          version: authority.scriptVersion,
        },
        approvedStoryboard: {
          storyboardId: authority.storyboardId,
          version: authority.storyboardVersion,
        },
        assets,
        completeness: {
          project: true,
          approvedScript: true,
          approvedStoryboard: true,
          assets: true,
        },
        requestId: input.requestId,
        occurredAt: now.toISOString(),
      });
    } catch (error) {
      if (
        error instanceof CanvasWorkspaceAuthorityError &&
        (error.code === 'PRIMARY_VIRTUAL_CHARACTER_MISSING' ||
          error.code === 'PRIMARY_VIRTUAL_CHARACTER_AMBIGUOUS' ||
          error.code === 'CANVAS_WORKSPACE_AUTHORITY_ASSETS_INCOMPLETE')
      ) {
        throw error;
      }
      throw workspaceAuthorityError('CANVAS_WORKSPACE_AUTHORITY_ASSETS_INCOMPLETE');
    }
  }
}
