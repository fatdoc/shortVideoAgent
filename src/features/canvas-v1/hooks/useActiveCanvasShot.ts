import { useEffect } from 'react';
import { useCanvasV1ViewState } from '../model/viewState';
import type { CanvasShotView } from '../pages/CanvasV1Page';

export function useActiveCanvasShot(shots: CanvasShotView[]) {
  const activeShotId = useCanvasV1ViewState((state) => state.activeShotId);
  const setActiveShot = useCanvasV1ViewState((state) => state.setActiveShot);
  const activeShot = shots.find((shot) => shot.shotId === activeShotId) ?? shots[0] ?? null;

  useEffect(() => {
    if (activeShot && activeShot.shotId !== activeShotId) {
      setActiveShot(activeShot.shotId);
    }
  }, [activeShot, activeShotId, setActiveShot]);

  return { activeShot, activeShotId: activeShot?.shotId ?? null, setActiveShot };
}
