import type { ScriptApproval } from '../domain/controlPlane';
import { scriptApprovalSchema } from '../domain/controlPlaneSchemas';

let inMemoryScriptApproval: ScriptApproval | null = null;

export function loadDemoScriptApproval(): ScriptApproval | null {
  return inMemoryScriptApproval;
}

export function saveDemoScriptApproval(approval: ScriptApproval): void {
  inMemoryScriptApproval = scriptApprovalSchema.parse(approval);
}

export function clearDemoScriptApproval(): void {
  inMemoryScriptApproval = null;
}
