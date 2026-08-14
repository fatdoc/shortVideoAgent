import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { IconChevronDown, IconLink, IconPhoto } from '@tabler/icons-react';
import type { CanvasAssetView } from '../pages/CanvasV1Page';
import { controlledMediaSrc } from './controlledMedia';

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
  const reduceMotion = useReducedMotion();
  return (
    <section className={`cv1-asset-dock ${open ? 'is-open' : ''}`} aria-label="项目资产 Dock">
      <button className="cv1-asset-dock__toggle" type="button" aria-expanded={open} onClick={onToggle}>
        <span>项目资产</span><small>{assets.length} 项 · 权利与绑定事实</small><IconChevronDown size={16} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div className="cv1-asset-dock__items" initial={reduceMotion ? false : { height: 0, opacity: 0 }} animate={{ height: 78, opacity: 1 }} exit={reduceMotion ? undefined : { height: 0, opacity: 0 }} transition={{ duration: .18 }}>
            {assets.length ? assets.map((asset) => {
              const previewSrc = controlledMediaSrc(asset.controlledPreviewUrl);
              return <article key={asset.assetId}>
                <div className="cv1-asset-dock__preview">
                  {previewSrc ? <img src={previewSrc} alt="" /> : <IconPhoto size={20} />}
                </div>
                <div><strong>{asset.displayName}</strong><small>{statusCopy[asset.entityBindingStatus]}</small></div>
                <button type="button" onClick={() => onInspectBinding(asset.assetId)} aria-label={`查看${asset.displayName}绑定`}><IconLink size={15} /></button>
              </article>;
            }) : <p className="cv1-asset-dock__empty">当前项目还没有可用资产。</p>}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
