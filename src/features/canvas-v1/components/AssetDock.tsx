import { AnimatePresence, motion } from 'framer-motion';
import { IconChevronDown, IconLink, IconPhoto } from '@tabler/icons-react';
import type { CanvasAssetView } from '../pages/CanvasV1Page';

interface AssetDockProps {
  assets: CanvasAssetView[];
  open: boolean;
  onToggle: () => void;
  onInspectBinding: (assetId: string) => void;
}

const statusCopy: Record<CanvasAssetView['entityBindingStatus'], string> = {
  approved: '已绑定',
  pending: '待审批',
  rejected: '绑定拒绝',
  revoked: '绑定撤销',
};

export function AssetDock({ assets, open, onToggle, onInspectBinding }: AssetDockProps) {
  return (
    <section className={`cv1-asset-dock ${open ? 'is-open' : ''}`} aria-label="Asset Dock">
      <button className="cv1-asset-dock__toggle" type="button" aria-expanded={open} onClick={onToggle}>
        <span>Asset Dock</span><small>{assets.length} 项目资产</small><IconChevronDown size={16} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div className="cv1-asset-dock__items" initial={{ height: 0, opacity: 0 }} animate={{ height: 74, opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .18 }}>
            {assets.map((asset) => (
              <article key={asset.assetId}>
                <div className="cv1-asset-dock__preview">
                  {asset.controlledPreviewUrl ? <img src={asset.controlledPreviewUrl} alt="" /> : <IconPhoto size={20} />}
                </div>
                <div><strong>{asset.displayName}</strong><small>{statusCopy[asset.entityBindingStatus]}</small></div>
                <button type="button" onClick={() => onInspectBinding(asset.assetId)} aria-label={`查看${asset.displayName}绑定`}><IconLink size={15} /></button>
              </article>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
