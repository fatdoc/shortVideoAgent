import type { Asset } from '../../domain/types';
import diningVisual from './assets/rough-cut-dining.png';
import greensVisual from './assets/rough-cut-greens.png';
import hotpotVisual from './assets/rough-cut-hotpot.png';
import interiorVisual from './assets/rough-cut-interior.png';
import nightVisual from './assets/rough-cut-night.png';
import previewPortraitVisual from './assets/rough-cut-preview-portrait.png';
import roastVisual from './assets/rough-cut-roast.png';
import serviceVisual from './assets/rough-cut-service.png';
import storefrontVisual from './assets/rough-cut-storefront.png';

const ASSET_VISUALS: Record<string, string> = {
  'asset-storefront': roastVisual,
  'asset-welcome': storefrontVisual,
  'asset-hotpot': serviceVisual,
  'asset-tripe': interiorVisual,
  'asset-shrimp': greensVisual,
  'asset-dining': diningVisual,
  'asset-member': hotpotVisual,
  'asset-night': nightVisual,
};

export function resolveAssetVisual(asset: Pick<Asset, 'id' | 'thumbnail'>): string {
  return ASSET_VISUALS[asset.id] ?? asset.thumbnail;
}

export function resolveAssetPreviewVisual(asset: Pick<Asset, 'id' | 'thumbnail'>): string {
  if (asset.id === 'asset-storefront') {
    return previewPortraitVisual;
  }
  return resolveAssetVisual(asset);
}
