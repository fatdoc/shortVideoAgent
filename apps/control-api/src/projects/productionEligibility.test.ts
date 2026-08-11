import { describe, expect, it } from 'vitest';
import { evaluateProductionEligibility } from './productionEligibility.js';
import {
  PRODUCTION_ELIGIBILITY_REASON_CODES,
  type ProductionEligibilityEvaluationInput,
  type ProductionScriptApprovalAuthority,
  type ProductionStoryboardApprovalAuthority,
} from './types.js';

const IDS = {
  projectId: '10000000-0000-4000-8000-000000000001',
  otherProjectId: '10000000-0000-4000-8000-000000000002',
  scriptV1: '10000000-0000-4000-8000-000000000003',
  scriptV2: '10000000-0000-4000-8000-000000000004',
  storyboardV1: '10000000-0000-4000-8000-000000000005',
  storyboardV2: '10000000-0000-4000-8000-000000000006',
  scriptApprovalV1: '10000000-0000-4000-8000-000000000007',
  scriptApprovalV2: '10000000-0000-4000-8000-000000000008',
  storyboardApprovalV1: '10000000-0000-4000-8000-000000000009',
  storyboardApprovalV2: '10000000-0000-4000-8000-00000000000a',
  actorId: '10000000-0000-4000-8000-00000000000b',
} as const;

const DIGESTS = {
  scriptV1: `sha256:${'1'.repeat(64)}`,
  scriptV2: `sha256:${'2'.repeat(64)}`,
  storyboardV1: `sha256:${'3'.repeat(64)}`,
  storyboardV2: `sha256:${'4'.repeat(64)}`,
} as const;

function scriptApproval(
  overrides: Partial<ProductionScriptApprovalAuthority> = {},
): ProductionScriptApprovalAuthority {
  return {
    id: IDS.scriptApprovalV2,
    projectId: IDS.projectId,
    scriptVersionId: IDS.scriptV2,
    sequence: '2',
    status: 'approved',
    factRiskStatus: 'cleared',
    reason: null,
    actedBy: IDS.actorId,
    actedAt: '2026-08-11T00:01:00.000Z',
    ...overrides,
  };
}

function storyboardApproval(
  overrides: Partial<ProductionStoryboardApprovalAuthority> = {},
): ProductionStoryboardApprovalAuthority {
  return {
    id: IDS.storyboardApprovalV2,
    projectId: IDS.projectId,
    storyboardVersionId: IDS.storyboardV2,
    sequence: '2',
    status: 'approved',
    factRiskStatus: 'cleared',
    reason: null,
    actedBy: IDS.actorId,
    actedAt: '2026-08-11T00:03:00.000Z',
    ...overrides,
  };
}

function eligibleInput(): ProductionEligibilityEvaluationInput {
  return {
    projectId: IDS.projectId,
    scripts: [
      {
        id: IDS.scriptV1,
        projectId: IDS.projectId,
        version: 1,
        status: 'approved',
        payloadDigest: DIGESTS.scriptV1,
      },
      {
        id: IDS.scriptV2,
        projectId: IDS.projectId,
        version: 2,
        status: 'approved',
        payloadDigest: DIGESTS.scriptV2,
      },
    ],
    scriptApprovals: [
      scriptApproval({
        id: IDS.scriptApprovalV1,
        scriptVersionId: IDS.scriptV1,
        sequence: '1',
        actedAt: '2026-08-11T00:00:00.000Z',
      }),
      scriptApproval(),
    ],
    storyboards: [
      {
        id: IDS.storyboardV1,
        projectId: IDS.projectId,
        scriptVersionId: IDS.scriptV1,
        scriptPayloadDigest: DIGESTS.scriptV1,
        payloadDigest: DIGESTS.storyboardV1,
        version: 1,
        status: 'approved',
      },
      {
        id: IDS.storyboardV2,
        projectId: IDS.projectId,
        scriptVersionId: IDS.scriptV2,
        scriptPayloadDigest: DIGESTS.scriptV2,
        payloadDigest: DIGESTS.storyboardV2,
        version: 2,
        status: 'approved',
      },
    ],
    storyboardApprovals: [
      storyboardApproval({
        id: IDS.storyboardApprovalV1,
        storyboardVersionId: IDS.storyboardV1,
        sequence: '1',
        actedAt: '2026-08-11T00:02:00.000Z',
      }),
      storyboardApproval(),
    ],
  };
}

function withLatestScriptApproval(
  input: ProductionEligibilityEvaluationInput,
  approval: ProductionScriptApprovalAuthority | null,
): ProductionEligibilityEvaluationInput {
  return {
    ...input,
    scriptApprovals: approval === null ? [] : [approval],
  };
}

function withLatestStoryboardApproval(
  input: ProductionEligibilityEvaluationInput,
  approval: ProductionStoryboardApprovalAuthority | null,
): ProductionEligibilityEvaluationInput {
  return {
    ...input,
    storyboardApprovals: approval === null ? [] : [approval],
  };
}

describe('dual-authority production eligibility', () => {
  it('returns SCRIPT_STORYBOARD_BINDING_MISMATCH when the latest approved storyboard is bound to an older approved script', () => {
    const input = eligibleInput();
    const latestStoryboard = input.storyboards[1];
    if (!latestStoryboard) throw new Error('latest storyboard fixture missing');

    const result = evaluateProductionEligibility({
      ...input,
      storyboards: [
        input.storyboards[0]!,
        {
          ...latestStoryboard,
          scriptVersionId: IDS.scriptV1,
          scriptPayloadDigest: DIGESTS.scriptV1,
        },
      ],
    });

    expect(result.reasonCode).toBe('SCRIPT_STORYBOARD_BINDING_MISMATCH');
    expect(result.eligible).toBe(false);
  });

  it('freezes the exact reason set and exact nine-key browser DTO', () => {
    expect(PRODUCTION_ELIGIBILITY_REASON_CODES).toEqual([
      'ELIGIBLE',
      'NO_SCRIPT_VERSION',
      'SCRIPT_NOT_APPROVED',
      'SCRIPT_APPROVAL_REVOKED',
      'SCRIPT_BLOCKED',
      'SCRIPT_FACT_RISK_UNRESOLVED',
      'NO_STORYBOARD_VERSION',
      'STORYBOARD_NOT_APPROVED',
      'STORYBOARD_APPROVAL_REVOKED',
      'STORYBOARD_BLOCKED',
      'STORYBOARD_FACT_RISK_UNRESOLVED',
      'SCRIPT_STORYBOARD_BINDING_MISMATCH',
    ]);

    const result = evaluateProductionEligibility(eligibleInput());

    expect(Object.keys(result)).toEqual([
      'projectId',
      'eligible',
      'scriptVersionId',
      'scriptVersion',
      'storyboardVersionId',
      'storyboardVersion',
      'reasonCode',
      'scriptApproval',
      'storyboardApproval',
    ]);
    expect(Object.keys(result.scriptApproval ?? {})).toEqual([
      'id',
      'projectId',
      'scriptVersionId',
      'status',
      'factRiskStatus',
      'reason',
      'actedBy',
      'actedAt',
    ]);
    expect(Object.keys(result.storyboardApproval ?? {})).toEqual([
      'id',
      'projectId',
      'storyboardVersionId',
      'status',
      'factRiskStatus',
      'reason',
      'actedBy',
      'actedAt',
    ]);
    expect(result).toMatchObject({
      eligible: true,
      reasonCode: 'ELIGIBLE',
      scriptVersionId: IDS.scriptV2,
      storyboardVersionId: IDS.storyboardV2,
    });
  });

  it('selects the latest versions and never falls back to an older approved storyboard', () => {
    const input = eligibleInput();
    const latestStoryboard = input.storyboards[1];
    if (!latestStoryboard) throw new Error('latest storyboard fixture missing');

    const result = evaluateProductionEligibility({
      ...input,
      storyboards: [input.storyboards[0]!, { ...latestStoryboard, status: 'draft' }],
      storyboardApprovals: [],
    });

    expect(result).toMatchObject({
      eligible: false,
      storyboardVersionId: IDS.storyboardV2,
      storyboardVersion: 2,
      reasonCode: 'STORYBOARD_NOT_APPROVED',
      storyboardApproval: null,
    });
  });

  it('uses the latest append-only approval sequence rather than array order', () => {
    const input = eligibleInput();
    const result = evaluateProductionEligibility({
      ...input,
      scriptApprovals: [
        scriptApproval({ sequence: '10', status: 'revoked', reason: 'Latest revoke.' }),
        scriptApproval({ sequence: '9', status: 'approved' }),
      ],
    });

    expect(result).toMatchObject({
      eligible: false,
      reasonCode: 'SCRIPT_APPROVAL_REVOKED',
      scriptApproval: { status: 'revoked', reason: 'Latest revoke.' },
    });
    expect(result.scriptApproval).not.toHaveProperty('sequence');
  });

  it.each([
    {
      name: 'revoked before blocked/not-approved/fact risk',
      approval: scriptApproval({ status: 'revoked', factRiskStatus: 'unresolved' }),
      status: 'approved' as const,
      reason: 'SCRIPT_APPROVAL_REVOKED',
    },
    {
      name: 'blocked before not-approved/fact risk',
      approval: scriptApproval({ status: 'blocked', factRiskStatus: 'unresolved' }),
      status: 'approved' as const,
      reason: 'SCRIPT_BLOCKED',
    },
    {
      name: 'projected version status before fact risk',
      approval: scriptApproval({ status: 'approved', factRiskStatus: 'unresolved' }),
      status: 'draft' as const,
      reason: 'SCRIPT_NOT_APPROVED',
    },
    {
      name: 'unresolved only after approved state',
      approval: scriptApproval({ status: 'approved', factRiskStatus: 'unresolved' }),
      status: 'approved' as const,
      reason: 'SCRIPT_FACT_RISK_UNRESOLVED',
    },
  ])('freezes Script precedence: $name', ({ approval, status, reason }) => {
    const input = eligibleInput();
    const latestScript = input.scripts[1];
    if (!latestScript) throw new Error('latest script fixture missing');

    const result = evaluateProductionEligibility(
      withLatestScriptApproval(
        { ...input, scripts: [input.scripts[0]!, { ...latestScript, status }] },
        approval,
      ),
    );

    expect(result.reasonCode).toBe(reason);
    expect(result.eligible).toBe(false);
  });

  it('returns SCRIPT_NOT_APPROVED when the latest Script has no approval', () => {
    const result = evaluateProductionEligibility(withLatestScriptApproval(eligibleInput(), null));
    expect(result.reasonCode).toBe('SCRIPT_NOT_APPROVED');
  });

  it('fails closed instead of falling back when Script version or approval ordering is invalid', () => {
    const input = eligibleInput();
    const latestScript = input.scripts[1];
    if (!latestScript) throw new Error('latest script fixture missing');

    expect(
      evaluateProductionEligibility({
        ...input,
        scripts: [input.scripts[0]!, { ...latestScript, version: Number.NaN }],
      }).reasonCode,
    ).toBe('NO_SCRIPT_VERSION');

    expect(
      evaluateProductionEligibility({
        ...input,
        scriptApprovals: [scriptApproval({ sequence: 'invalid' })],
      }).reasonCode,
    ).toBe('SCRIPT_NOT_APPROVED');
  });

  it('evaluates Script failures before the missing Storyboard state', () => {
    const result = evaluateProductionEligibility({
      ...withLatestScriptApproval(
        eligibleInput(),
        scriptApproval({ status: 'revoked', factRiskStatus: 'unresolved' }),
      ),
      storyboards: [],
      storyboardApprovals: [],
    });

    expect(result.reasonCode).toBe('SCRIPT_APPROVAL_REVOKED');
  });

  it('returns NO_STORYBOARD_VERSION only after Script authority is approved and cleared', () => {
    const result = evaluateProductionEligibility({
      ...eligibleInput(),
      storyboards: [],
      storyboardApprovals: [],
    });

    expect(result).toMatchObject({
      eligible: false,
      reasonCode: 'NO_STORYBOARD_VERSION',
      storyboardVersionId: null,
      storyboardVersion: null,
      storyboardApproval: null,
    });
  });

  it.each([
    {
      name: 'revoked before blocked/not-approved/fact risk',
      approval: storyboardApproval({ status: 'revoked', factRiskStatus: 'unresolved' }),
      status: 'approved' as const,
      reason: 'STORYBOARD_APPROVAL_REVOKED',
    },
    {
      name: 'blocked before not-approved/fact risk',
      approval: storyboardApproval({ status: 'blocked', factRiskStatus: 'unresolved' }),
      status: 'approved' as const,
      reason: 'STORYBOARD_BLOCKED',
    },
    {
      name: 'projected version status before fact risk',
      approval: storyboardApproval({ status: 'approved', factRiskStatus: 'unresolved' }),
      status: 'draft' as const,
      reason: 'STORYBOARD_NOT_APPROVED',
    },
    {
      name: 'unresolved only after approved state',
      approval: storyboardApproval({ status: 'approved', factRiskStatus: 'unresolved' }),
      status: 'approved' as const,
      reason: 'STORYBOARD_FACT_RISK_UNRESOLVED',
    },
  ])('freezes Storyboard precedence: $name', ({ approval, status, reason }) => {
    const input = eligibleInput();
    const latestStoryboard = input.storyboards[1];
    if (!latestStoryboard) throw new Error('latest storyboard fixture missing');

    const result = evaluateProductionEligibility(
      withLatestStoryboardApproval(
        { ...input, storyboards: [input.storyboards[0]!, { ...latestStoryboard, status }] },
        approval,
      ),
    );

    expect(result.reasonCode).toBe(reason);
    expect(result.eligible).toBe(false);
  });

  it('returns STORYBOARD_NOT_APPROVED when the latest Storyboard has no approval', () => {
    const result = evaluateProductionEligibility(
      withLatestStoryboardApproval(eligibleInput(), null),
    );
    expect(result.reasonCode).toBe('STORYBOARD_NOT_APPROVED');
  });

  it('checks Script/Storyboard binding before exposing Storyboard approval state', () => {
    const input = eligibleInput();
    const latestStoryboard = input.storyboards[1];
    if (!latestStoryboard) throw new Error('latest storyboard fixture missing');

    const result = evaluateProductionEligibility({
      ...input,
      storyboards: [input.storyboards[0]!, { ...latestStoryboard, scriptVersionId: IDS.scriptV1 }],
      storyboardApprovals: [storyboardApproval({ status: 'revoked' })],
    });

    expect(result.reasonCode).toBe('SCRIPT_STORYBOARD_BINDING_MISMATCH');
  });

  it('requires both Script ID and canonical digest binding', () => {
    const input = eligibleInput();
    const latestScript = input.scripts[1];
    const latestStoryboard = input.storyboards[1];
    if (!latestScript || !latestStoryboard) throw new Error('authority fixture missing');

    expect(
      evaluateProductionEligibility({
        ...input,
        scripts: [
          input.scripts[0]!,
          { ...latestScript, payloadDigest: DIGESTS.scriptV2.slice('sha256:'.length) },
        ],
      }).reasonCode,
    ).toBe('ELIGIBLE');

    expect(
      evaluateProductionEligibility({
        ...input,
        storyboards: [
          input.storyboards[0]!,
          { ...latestStoryboard, scriptVersionId: IDS.scriptV1 },
        ],
      }).reasonCode,
    ).toBe('SCRIPT_STORYBOARD_BINDING_MISMATCH');

    expect(
      evaluateProductionEligibility({
        ...input,
        storyboards: [
          input.storyboards[0]!,
          { ...latestStoryboard, scriptPayloadDigest: DIGESTS.scriptV1 },
        ],
      }).reasonCode,
    ).toBe('SCRIPT_STORYBOARD_BINDING_MISMATCH');

    expect(
      evaluateProductionEligibility({
        ...input,
        storyboards: [
          input.storyboards[0]!,
          { ...latestStoryboard, scriptPayloadDigest: 'not-a-digest' },
        ],
      }).reasonCode,
    ).toBe('SCRIPT_STORYBOARD_BINDING_MISMATCH');
  });

  it('returns NO_SCRIPT_VERSION and ignores out-of-project authority candidates', () => {
    const input = eligibleInput();
    const result = evaluateProductionEligibility({
      ...input,
      scripts: input.scripts.map((script) => ({ ...script, projectId: IDS.otherProjectId })),
      scriptApprovals: [],
    });

    expect(result).toMatchObject({
      eligible: false,
      scriptVersionId: null,
      scriptVersion: null,
      reasonCode: 'NO_SCRIPT_VERSION',
      scriptApproval: null,
    });
  });
});
