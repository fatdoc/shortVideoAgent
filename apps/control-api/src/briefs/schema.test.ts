import { describe, expect, it } from 'vitest';
import { briefVersionSchema } from './schema.js';

const safePayload = {
  objective: '为门店带来可核销到店线索',
  audience: ['周边三公里咖啡消费者'],
  platforms: ['douyin'],
  brandFacts: [
    {
      text: '门店每日供应手冲咖啡',
      sourceReference: '门店菜单 2026-08-14',
    },
  ],
  prohibitedTerms: ['全网最低价'],
  requiredDisclosures: ['实际供应以门店当日菜单为准'],
  factsConfirmed: true,
} as const;

describe('browser-safe Brief input', () => {
  it('accepts only the explicit confirmed production Brief fields', () => {
    expect(briefVersionSchema.parse({ payload: safePayload })).toEqual({ payload: safePayload });
  });

  it.each([
    { payload: { merchantName: 'legacy flat', city: '郑州', brandFacts: [] } },
    { payload: { ...safePayload, factsConfirmed: false } },
    { payload: { ...safePayload, sourceDigest: `sha256:${'a'.repeat(64)}` } },
    {
      payload: {
        ...safePayload,
        brandPolicySnapshot: {
          facts: [],
          sourceDigest: `sha256:${'a'.repeat(64)}`,
        },
      },
    },
  ])('rejects legacy or authority-bearing browser input %#', (input) => {
    expect(briefVersionSchema.safeParse(input).success).toBe(false);
  });
});
