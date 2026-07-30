import type { DemoExperienceResetResult } from '../services/demoExperienceReset';
import { resetDemoExperienceTransaction } from '../services/demoExperienceReset';
import { useControlPlaneStore } from './controlPlaneStore';
import { useProjectStore } from './projectStore';

export async function resetDemoExperience(): Promise<DemoExperienceResetResult> {
  useProjectStore.getState().setResetPending();
  useControlPlaneStore.getState().setResetPending();

  const result = await resetDemoExperienceTransaction();
  if (result.ok) {
    useProjectStore.getState().applyResetSnapshot(result.workspace);
    useControlPlaneStore.getState().applyResetSnapshot(result.controlPlane);
  } else {
    useProjectStore.getState().applyResetFailure(result.workspace, result.error);
    useControlPlaneStore
      .getState()
      .applyResetFailure(result.controlPlane, result.error);
  }
  return result;
}
