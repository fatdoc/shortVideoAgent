import type { ScriptApproval } from '../domain/controlPlane';
import { scriptApprovalSchema } from '../domain/controlPlaneSchemas';

const SCRIPT_APPROVAL_STORAGE_KEY =
  'videoagent:control-plane:demo-script-approval:v1';

export function loadDemoScriptApproval(): ScriptApproval | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SCRIPT_APPROVAL_STORAGE_KEY);
    if (!raw) return null;
    return scriptApprovalSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveDemoScriptApproval(approval: ScriptApproval): void {
  scriptApprovalSchema.parse(approval);
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    SCRIPT_APPROVAL_STORAGE_KEY,
    JSON.stringify(approval),
  );
}

export function clearDemoScriptApproval(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SCRIPT_APPROVAL_STORAGE_KEY);
}
