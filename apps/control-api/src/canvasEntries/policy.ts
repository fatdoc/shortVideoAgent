import { canvasEntryError } from './errors.js';
import type { CanvasEntryBinding } from './types.js';

/**
 * A Canvas Entry is immutable and non-transferable across any scope axis.
 * All mismatches intentionally collapse to one error to avoid scope discovery.
 */
export function assertCanvasEntryBinding(
  stored: CanvasEntryBinding,
  expected: CanvasEntryBinding,
): void {
  if (
    stored.tenantId !== expected.tenantId ||
    stored.projectId !== expected.projectId ||
    stored.packageId !== expected.packageId
  ) {
    throw canvasEntryError(
      'CANVAS_ENTRY_NOT_FOUND',
      'Canvas Entry tenant/project/package binding mismatch.',
    );
  }
}
