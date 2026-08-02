import { DEMO_PROJECT_ID } from '../../domain/constants';
import type { DemoProjectGrant } from '../../domain/controlPlane';
import { demoProjectGrantSchema } from '../../domain/controlPlaneSchemas';

export const STORYCANVAS_PACKAGE_ID = 'package-demo-local-001-v1';

const REQUIRED_SCOPES = [
  'production.package.read',
  'production.receipt.write',
] as const satisfies readonly DemoProjectGrant['scopes'][number][];

export interface StoryCanvasAppProps {
  grant?: DemoProjectGrant | null;
}

export type StoryCanvasGrantRejectionCode =
  | 'EXPLICIT_GRANT_REQUIRED'
  | 'GRANT_CONTRACT_INVALID'
  | 'GRANT_PROJECT_SCOPE_MISMATCH'
  | 'GRANT_PACKAGE_SCOPE_MISMATCH'
  | 'GRANT_SCOPE_MISMATCH'
  | 'GRANT_NOT_YET_VALID'
  | 'GRANT_EXPIRED';

export type StoryCanvasGrantValidation =
  | { ok: true; grant: DemoProjectGrant }
  | {
      ok: false;
      error: {
        code: StoryCanvasGrantRejectionCode;
        message: string;
      };
    };

function reject(
  code: StoryCanvasGrantRejectionCode,
  message: string,
): StoryCanvasGrantValidation {
  return { ok: false, error: { code, message: `${code}：${message}` } };
}

export function validateEmbeddedStoryCanvasGrant(
  value: unknown,
  now: Date = new Date(),
): StoryCanvasGrantValidation {
  if (value === null || value === undefined) {
    return reject('EXPLICIT_GRANT_REQUIRED', '画布必须接收当前项目的内存 Grant');
  }

  let grant: DemoProjectGrant;
  try {
    grant = demoProjectGrantSchema.parse(value);
  } catch {
    return reject('GRANT_CONTRACT_INVALID', 'Grant 不符合 DemoProjectGrant 合同');
  }

  if (grant.projectId !== DEMO_PROJECT_ID) {
    return reject(
      'GRANT_PROJECT_SCOPE_MISMATCH',
      `拒绝非 canonical Project ${grant.projectId}`,
    );
  }

  if (grant.packageId !== STORYCANVAS_PACKAGE_ID || grant.packageVersion !== 1) {
    return reject(
      'GRANT_PACKAGE_SCOPE_MISMATCH',
      `拒绝 Package ${grant.packageId} v${grant.packageVersion}`,
    );
  }

  const missingScopes = REQUIRED_SCOPES.filter(
    (scope) => !grant.scopes.includes(scope),
  );
  if (missingScopes.length > 0) {
    return reject(
      'GRANT_SCOPE_MISMATCH',
      `缺少 Scope ${missingScopes.join(', ')}`,
    );
  }

  const nowMs = now.getTime();
  const issuedAtMs = Date.parse(grant.issuedAt);
  const expiresAtMs = Date.parse(grant.expiresAt);
  if (!Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs)) {
    return reject('GRANT_CONTRACT_INVALID', 'Grant 时间字段不可解析');
  }
  if (issuedAtMs > nowMs) {
    return reject('GRANT_NOT_YET_VALID', 'Grant 尚未生效');
  }
  if (expiresAtMs <= nowMs) {
    return reject('GRANT_EXPIRED', 'Grant 已过期，请控制平面重新签发');
  }

  return { ok: true, grant };
}
