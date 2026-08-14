import type { CanvasCommandV01 } from '@/contracts/canvas-v1';
import type { CanvasProductionScope } from '../assets-v1';
import type { PilotCanvasServerAuthority } from '../pilotCanvasCapability';

export type CanvasV1ApprovalValidatorOptions = {
  readAuthority(canvasSessionId: string): PilotCanvasServerAuthority | null;
  shotProductionConfigured(): boolean;
  consume(command: CanvasCommandV01, scope: CanvasProductionScope): Promise<boolean>;
};

function exactAuthorityScope(
  authority: PilotCanvasServerAuthority | null,
  scope: CanvasProductionScope,
): authority is PilotCanvasServerAuthority {
  return Boolean(
    authority &&
      Date.parse(authority.expiresAt) > Date.now() &&
      authority.actorId === scope.actorId &&
      authority.redemption.tenantId === scope.tenantId &&
      authority.redemption.projectId === scope.projectId &&
      authority.redemption.packageId === scope.packageId,
  );
}

export function createCanvasV1ApprovalValidator(options: CanvasV1ApprovalValidatorOptions) {
  return async (command: CanvasCommandV01, scope: CanvasProductionScope): Promise<boolean> => {
    const authority = options.readAuthority(scope.canvasSessionId);
    if (!exactAuthorityScope(authority, scope)) return false;
    if (command.commandType === 'GENERATE_SHOT') {
      const payload = command.payload as { shotId?: unknown };
      const productionPackage = authority.redemption.productionPackage;
      if (
        !options.shotProductionConfigured() ||
        !['16:9', '9:16'].includes(productionPackage.target.aspectRatio) ||
        !productionPackage.capabilityRequirements.includes('video.generate') ||
        typeof payload.shotId !== 'string' ||
        !productionPackage.storyboard.some((shot) => shot.shotId === payload.shotId)
      ) return false;
    }
    return options.consume(command, scope);
  };
}
