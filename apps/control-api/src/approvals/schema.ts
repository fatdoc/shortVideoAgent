import { z } from 'zod';

export const approvalSchema = z
  .object({
    status: z.enum(['approved', 'revoked', 'blocked']),
    factRiskStatus: z.enum(['cleared', 'unresolved']),
    reason: z.string().trim().min(1).max(2_000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === 'approved' && value.factRiskStatus !== 'cleared') {
      context.addIssue({
        code: 'custom',
        path: ['factRiskStatus'],
        message: 'approved scripts require cleared fact risk',
      });
    }
    if (value.status !== 'approved' && !value.reason) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'revoked or blocked approvals require a reason',
      });
    }
  });
