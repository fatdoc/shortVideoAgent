import { AnimatePresence, motion } from 'framer-motion';
import { IconCircleCheck, IconX } from '@tabler/icons-react';
import type { CanvasAssetView } from '../pages/CanvasV1Page';
import { controlledMediaSrc } from './controlledMedia';

interface AssetBindingDrawerProps {
  asset: CanvasAssetView | null;
  approvalGranted: boolean;
  onClose: () => void;
  onBind: (asset: CanvasAssetView) => void;
}

export function AssetBindingDrawer({ asset, approvalGranted, onClose, onBind }: AssetBindingDrawerProps) {
  const previewSrc = controlledMediaSrc(asset?.controlledPreviewUrl);
  const assetReady = Boolean(asset?.targetEntityId) && asset?.rightsStatus === 'authorized' && asset.approvalStatus === 'approved' && asset.providerStatus === 'active';

  return (
    <AnimatePresence>
      {asset ? (
        <motion.div className="cv1-drawer-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="cv1-drawer-scrim" type="button" aria-label="关闭资产绑定" onClick={onClose} />
          <motion.aside className="cv1-drawer" role="dialog" aria-modal="true" aria-labelledby="cv1-drawer-title" initial={{ x: 30 }} animate={{ x: 0 }} exit={{ x: 30 }} transition={{ duration: .18 }}>
            <header><div><span>ASSET BINDING</span><h2 id="cv1-drawer-title">{asset.displayName}</h2></div><button type="button" aria-label="关闭" onClick={onClose}><IconX size={18} /></button></header>
            <div className="cv1-drawer__preview">{previewSrc ? <img src={previewSrc} alt={`${asset.displayName}预览`} /> : <span>暂无受控预览</span>}</div>
            <dl>
              <div><dt>使用权</dt><dd>{asset.rightsStatus === 'authorized' ? '已授权' : '未授权'}</dd></div>
              <div><dt>素材审批</dt><dd>{asset.approvalStatus === 'approved' ? '已批准' : '待处理'}</dd></div>
              <div><dt>Provider</dt><dd>{asset.providerStatus === 'active' ? 'Active' : asset.providerStatus}</dd></div>
              <div><dt>项目绑定</dt><dd>{asset.entityBindingStatus === 'approved' ? '已批准' : '未批准'}</dd></div>
            </dl>
            {asset.entityBindingStatus === 'approved' ? <p className="cv1-drawer__notice"><IconCircleCheck size={16} />资产已绑定到当前项目实体。</p> : null}
            <button className="cv1-secondary-action" type="button" disabled={!assetReady || !approvalGranted} onClick={() => onBind(asset)}>绑定到当前镜头</button>
            {!asset.targetEntityId ? <small className="cv1-drawer__explain">当前镜头没有可绑定的实体目标。</small> : null}
            {!approvalGranted ? <small className="cv1-drawer__explain">绑定审批尚未确认。</small> : null}
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
