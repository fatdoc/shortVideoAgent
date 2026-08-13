import { create } from 'zustand';

export type CanvasInspectorTab = 'shot' | 'assets' | 'readiness';

interface CanvasV1ViewState {
  activeShotId: string | null;
  inspectorTab: CanvasInspectorTab;
  assetDockOpen: boolean;
  bindingAssetId: string | null;
  setActiveShot: (shotId: string) => void;
  setInspectorTab: (tab: CanvasInspectorTab) => void;
  toggleAssetDock: () => void;
  openAssetBinding: (assetId: string) => void;
  closeAssetBinding: () => void;
  resetView: () => void;
}

const initialView = {
  activeShotId: null,
  inspectorTab: 'shot' as const,
  assetDockOpen: true,
  bindingAssetId: null,
};

export const useCanvasV1ViewState = create<CanvasV1ViewState>((set) => ({
  ...initialView,
  setActiveShot: (activeShotId) => set({ activeShotId }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  toggleAssetDock: () => set((state) => ({ assetDockOpen: !state.assetDockOpen })),
  openAssetBinding: (bindingAssetId) => set({ bindingAssetId }),
  closeAssetBinding: () => set({ bindingAssetId: null }),
  resetView: () => set(initialView),
}));

