import crypto from "node:crypto";

import {
  CANVAS_V1_REASON_CODES,
  parseCanvasV1Contract,
  type AssetRecordV01,
  type CanvasV1Scope,
  type EntityBindingV01,
  type ProviderAssetBindingV01,
  type ShotAssetRequirementV01,
  type ShotReadinessV01,
} from "@/contracts/canvas-v1";

export type NormalizedProviderStatus = ProviderAssetBindingV01["providerStatus"];
export type CanvasReadinessReason = ShotReadinessV01["reasonCodes"][number];

const PROVIDER_STATUS: Record<string, NormalizedProviderStatus> = {
  active: "active",
  processing: "processing",
  pending: "processing",
  queued: "processing",
  rejected: "rejected",
  failed: "failed",
  error: "failed",
  unavailable: "unavailable",
};

export function normalizeProviderAssetStatus(value: unknown): NormalizedProviderStatus {
  if (typeof value !== "string") return "unavailable";
  return PROVIDER_STATUS[value.trim().toLowerCase()] ?? "unavailable";
}

function sameScope(expected: CanvasV1Scope, value: CanvasV1Scope | null): boolean {
  return Boolean(value
    && expected.tenantId === value.tenantId
    && expected.projectId === value.projectId
    && expected.packageId === value.packageId
    && expected.canvasSessionId === value.canvasSessionId);
}

function presentScopeMatches(expected: CanvasV1Scope, value: CanvasV1Scope | null): boolean {
  return value === null || sameScope(expected, value);
}

function requirementReasons(input: {
  scope: CanvasV1Scope;
  requirement: ShotAssetRequirementV01;
  asset: AssetRecordV01 | null;
  providerBinding: ProviderAssetBindingV01 | null;
  entityBinding: EntityBindingV01 | null;
  availableCapabilities: ReadonlySet<string>;
}): CanvasReadinessReason[] {
  const reasons = new Set<CanvasReadinessReason>();
  const { scope, requirement, asset, providerBinding, entityBinding } = input;
  const scopeMatched = sameScope(scope, requirement)
    && presentScopeMatches(scope, asset)
    && presentScopeMatches(scope, providerBinding)
    && presentScopeMatches(scope, entityBinding);
  if (!scopeMatched) reasons.add("SCOPE_MISMATCH");
  if (!asset) reasons.add("REQUIRED_ASSET_MISSING");

  const rights = asset?.rights.status ?? "pending";
  if (rights !== "authorized") reasons.add(`RIGHTS_${rights.toUpperCase()}` as CanvasReadinessReason);
  const approval = asset?.approval.status ?? "pending";
  if (approval !== "approved") reasons.add(`ASSET_APPROVAL_${approval.toUpperCase()}` as CanvasReadinessReason);
  const providerStatus = providerBinding?.providerStatus ?? "unavailable";
  if (providerStatus !== "active") reasons.add(`PROVIDER_${providerStatus.toUpperCase()}` as CanvasReadinessReason);
  if (!entityBinding) {
    reasons.add("ENTITY_BINDING_MISSING");
  } else if (entityBinding.status !== "approved") {
    reasons.add(`ENTITY_BINDING_${entityBinding.status.toUpperCase()}` as CanvasReadinessReason);
  }
  if (requirement.requiredCapabilities.some((capability) => !input.availableCapabilities.has(capability))) {
    reasons.add("CAPABILITY_UNAVAILABLE");
  }
  return CANVAS_V1_REASON_CODES.filter((code): code is CanvasReadinessReason => reasons.has(code));
}

export interface EvaluateShotReadinessInput {
  scope: CanvasV1Scope;
  requirement: ShotAssetRequirementV01;
  asset: AssetRecordV01 | null;
  providerBinding: ProviderAssetBindingV01 | null;
  entityBinding: EntityBindingV01 | null;
  availableCapabilities: ReadonlySet<string>;
  approvedScript: { scriptId: string; version: number };
  approvedStoryboard: { storyboardId: string; version: number };
  readinessId?: string;
  evaluatedAt?: string;
}

export function evaluateShotReadiness(input: EvaluateShotReadinessInput): ShotReadinessV01 {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const reasonCodes = requirementReasons(input);
  const scriptCurrent = input.requirement.source.scriptId === input.approvedScript.scriptId
    && input.requirement.source.scriptVersion === input.approvedScript.version;
  const storyboardCurrent = input.requirement.source.storyboardId === input.approvedStoryboard.storyboardId
    && input.requirement.source.storyboardVersion === input.approvedStoryboard.version;
  if (!scriptCurrent) reasonCodes.push("SCRIPT_NOT_CURRENT");
  if (!storyboardCurrent) reasonCodes.push("STORYBOARD_NOT_CURRENT");
  const orderedReasons = CANVAS_V1_REASON_CODES.filter((code): code is CanvasReadinessReason => reasonCodes.includes(code));
  const scopeMatched = sameScope(input.scope, input.requirement)
    && presentScopeMatches(input.scope, input.asset)
    && presentScopeMatches(input.scope, input.providerBinding)
    && presentScopeMatches(input.scope, input.entityBinding);
  const requirementReasonsOnly = requirementReasons(input);
  const result: ShotReadinessV01 = {
    objectType: "ShotReadiness",
    contractVersion: "0.1",
    ...input.scope,
    readinessId: input.readinessId ?? crypto.randomUUID(),
    shotId: input.requirement.shotId,
    ready: orderedReasons.length === 0,
    reasonCodes: orderedReasons,
    script: {
      scriptId: input.requirement.source.scriptId,
      version: input.requirement.source.scriptVersion,
      current: scriptCurrent,
    },
    storyboard: {
      storyboardId: input.requirement.source.storyboardId,
      version: input.requirement.source.storyboardVersion,
      current: storyboardCurrent,
    },
    requirements: [{
      requirementId: input.requirement.requirementId,
      assetId: input.asset?.assetId ?? null,
      scopeMatched,
      rightsStatus: input.asset?.rights.status ?? "pending",
      approvalStatus: input.asset?.approval.status ?? "pending",
      providerStatus: input.providerBinding?.providerStatus ?? "unavailable",
      // CV0 accepted REQ-T0CV1-CV2-002: null is the additive contract value
      // for a missing binding. Keep the fact exact while the CV1 amendment is
      // landing; the strict parser remains the serializer gate.
      entityBindingStatus: (input.entityBinding?.status ?? null) as unknown as EntityBindingV01["status"],
      capabilityAvailable: !requirementReasonsOnly.includes("CAPABILITY_UNAVAILABLE"),
      ready: requirementReasonsOnly.length === 0,
      reasonCodes: requirementReasonsOnly,
    }],
    evaluatedAt,
    occurredAt: evaluatedAt,
  };
  return parseCanvasV1Contract(result) as ShotReadinessV01;
}
