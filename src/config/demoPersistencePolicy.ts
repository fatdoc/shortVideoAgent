import { pilotRuntime, type PilotRuntime } from './pilotRuntime';

export function isDemoBrowserPersistenceEnabled(runtime: PilotRuntime = pilotRuntime): boolean {
  return runtime.mode === 'demo';
}
