import type {
  ApprovalEvent,
  ProductionEligibilityDecision,
  ProductionEligibilityEvaluationInput,
  ProductionEligibilityReason,
  ProductionScriptApprovalAuthority,
  ProductionScriptAuthority,
  ProductionStoryboardApproval,
  ProductionStoryboardApprovalAuthority,
  ProductionStoryboardAuthority,
} from './types.js';

const SHA256_PATTERN = /^(?:sha256:)?([a-f0-9]{64})$/;

function canonicalDigest(value: string): `sha256:${string}` | null {
  const match = SHA256_PATTERN.exec(value);
  return match?.[1] ? `sha256:${match[1]}` : null;
}

function latestVersion<T extends { id: string; projectId: string; version: number }>(
  projectId: string,
  versions: readonly T[],
): T | null {
  let latest: T | null = null;
  for (const version of versions) {
    if (version.projectId !== projectId) continue;
    if (!Number.isSafeInteger(version.version) || version.version <= 0) return null;
    if (latest === null || version.version > latest.version) latest = version;
    else if (version.version === latest.version && version.id !== latest.id) return null;
  }
  return latest;
}

function sequence(value: string): bigint | null {
  if (!/^[1-9][0-9]*$/.test(value)) return null;
  return BigInt(value);
}

function latestApproval<T extends { id: string; projectId: string; sequence: string }>(
  projectId: string,
  approvals: readonly T[],
  belongsToVersion: (approval: T) => boolean,
): T | null {
  let latest: T | null = null;
  let latestSequence: bigint | null = null;
  for (const approval of approvals) {
    if (approval.projectId !== projectId || !belongsToVersion(approval)) continue;
    const candidateSequence = sequence(approval.sequence);
    if (candidateSequence === null) return null;
    if (latestSequence === null || candidateSequence > latestSequence) {
      latest = approval;
      latestSequence = candidateSequence;
    } else if (candidateSequence === latestSequence && approval.id !== latest?.id) return null;
  }
  return latest;
}

function scriptApprovalDto(
  approval: ProductionScriptApprovalAuthority | null,
): ApprovalEvent | null {
  if (approval === null) return null;
  return {
    id: approval.id,
    projectId: approval.projectId,
    scriptVersionId: approval.scriptVersionId,
    status: approval.status,
    factRiskStatus: approval.factRiskStatus,
    reason: approval.reason,
    actedBy: approval.actedBy,
    actedAt: approval.actedAt,
  };
}

function storyboardApprovalDto(
  approval: ProductionStoryboardApprovalAuthority | null,
): ProductionStoryboardApproval | null {
  if (approval === null) return null;
  return {
    id: approval.id,
    projectId: approval.projectId,
    storyboardVersionId: approval.storyboardVersionId,
    status: approval.status,
    factRiskStatus: approval.factRiskStatus,
    reason: approval.reason,
    actedBy: approval.actedBy,
    actedAt: approval.actedAt,
  };
}

function scriptReason(
  script: ProductionScriptAuthority,
  approval: ProductionScriptApprovalAuthority | null,
): ProductionEligibilityReason | null {
  if (script.status === 'revoked' || approval?.status === 'revoked') {
    return 'SCRIPT_APPROVAL_REVOKED';
  }
  if (approval?.status === 'blocked') return 'SCRIPT_BLOCKED';
  if (script.status !== 'approved' || approval?.status !== 'approved') {
    return 'SCRIPT_NOT_APPROVED';
  }
  if (approval.factRiskStatus !== 'cleared') return 'SCRIPT_FACT_RISK_UNRESOLVED';
  return null;
}

function storyboardReason(
  storyboard: ProductionStoryboardAuthority,
  approval: ProductionStoryboardApprovalAuthority | null,
): ProductionEligibilityReason | null {
  if (storyboard.status === 'revoked' || approval?.status === 'revoked') {
    return 'STORYBOARD_APPROVAL_REVOKED';
  }
  if (approval?.status === 'blocked') return 'STORYBOARD_BLOCKED';
  if (storyboard.status !== 'approved' || approval?.status !== 'approved') {
    return 'STORYBOARD_NOT_APPROVED';
  }
  if (approval.factRiskStatus !== 'cleared') return 'STORYBOARD_FACT_RISK_UNRESOLVED';
  return null;
}

function bindingMatches(
  script: ProductionScriptAuthority,
  storyboard: ProductionStoryboardAuthority,
): boolean {
  const scriptDigest = canonicalDigest(script.payloadDigest);
  const boundDigest = canonicalDigest(storyboard.scriptPayloadDigest);
  return (
    storyboard.scriptVersionId === script.id &&
    scriptDigest !== null &&
    boundDigest !== null &&
    boundDigest === scriptDigest
  );
}

export function evaluateProductionEligibility(
  input: ProductionEligibilityEvaluationInput,
): ProductionEligibilityDecision {
  const script = latestVersion(input.projectId, input.scripts);
  const storyboard = latestVersion(input.projectId, input.storyboards);
  const scriptApproval = script
    ? latestApproval(
        input.projectId,
        input.scriptApprovals,
        (approval) => approval.scriptVersionId === script.id,
      )
    : null;
  const storyboardApproval = storyboard
    ? latestApproval(
        input.projectId,
        input.storyboardApprovals,
        (approval) => approval.storyboardVersionId === storyboard.id,
      )
    : null;

  let reasonCode: ProductionEligibilityReason;
  if (script === null) reasonCode = 'NO_SCRIPT_VERSION';
  else {
    const scriptFailure = scriptReason(script, scriptApproval);
    if (scriptFailure !== null) reasonCode = scriptFailure;
    else if (storyboard === null) reasonCode = 'NO_STORYBOARD_VERSION';
    else if (!bindingMatches(script, storyboard)) {
      reasonCode = 'SCRIPT_STORYBOARD_BINDING_MISMATCH';
    } else {
      reasonCode = storyboardReason(storyboard, storyboardApproval) ?? 'ELIGIBLE';
    }
  }

  return {
    projectId: input.projectId,
    eligible: reasonCode === 'ELIGIBLE',
    scriptVersionId: script?.id ?? null,
    scriptVersion: script?.version ?? null,
    storyboardVersionId: storyboard?.id ?? null,
    storyboardVersion: storyboard?.version ?? null,
    reasonCode,
    scriptApproval: scriptApprovalDto(scriptApproval),
    storyboardApproval: storyboardApprovalDto(storyboardApproval),
  };
}
