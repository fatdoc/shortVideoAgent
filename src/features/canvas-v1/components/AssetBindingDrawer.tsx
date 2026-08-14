import { AnimatePresence, motion } from 'framer-motion';
import { IconCircleCheck, IconX } from '@tabler/icons-react';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { CanvasAssetView } from '../pages/CanvasV1Page';
import { controlledMediaSrc } from './controlledMedia';

interface AssetBindingDrawerProps {
  asset: CanvasAssetView | null;
  approvalAvailable: boolean;
  creationPrompt: string;
  onClose: () => void;
  onBind: (asset: CanvasAssetView) => void;
  onCreateVirtual: (asset: CanvasAssetView, prompt: string) => void;
}

export function AssetBindingDrawer({ asset, approvalAvailable, creationPrompt, onClose, onBind, onCreateVirtual }: AssetBindingDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const previewSrc = controlledMediaSrc(asset?.controlledPreviewUrl);
  const assetReady = Boolean(asset?.targetEntityId) && asset?.rightsStatus === 'authorized' && asset.approvalStatus === 'approved' && asset.providerStatus === 'active';
  const canCreateVirtual = Boolean(asset?.targetEntityId) && asset?.category === 'virtual_character' && asset.rightsStatus === 'authorized' && asset.approvalStatus === 'approved' && asset.providerStatus !== 'active' && creationPrompt.trim().length > 0;

  useEffect(() => {
    if (!asset) return undefined;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [asset]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !drawerRef.current) return;
    const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <AnimatePresence>
      {asset ? (
        <motion.div className="cv1-drawer-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="cv1-drawer-scrim" type="button" aria-label="关闭资产绑定" onClick={onClose} />
          <motion.aside ref={drawerRef} className="cv1-drawer" role="dialog" aria-modal="true" aria-labelledby="cv1-drawer-title" initial={{ x: 30 }} animate={{ x: 0 }} exit={{ x: 30 }} transition={{ duration: .18 }} onKeyDown={handleKeyDown}>
            <header><div><span>资产绑定</span><h2 id="cv1-drawer-title">{asset.displayName}</h2></div><button ref={closeRef} type="button" aria-label="关闭" onClick={onClose}><IconX size={18} /></button></header>
            <div className="cv1-drawer__preview">{previewSrc ? <img src={previewSrc} alt={`${asset.displayName}预览`} /> : <span>暂无受控预览</span>}</div>
            <dl>
              <div><dt>使用权</dt><dd>{asset.rightsStatus === 'authorized' ? '已授权' : '未授权'}</dd></div>
              <div><dt>素材审批</dt><dd>{asset.approvalStatus === 'approved' ? '已批准' : '待处理'}</dd></div>
              <div><dt>Provider</dt><dd>{asset.providerStatus === 'active' ? 'Active' : asset.providerStatus}</dd></div>
              <div><dt>项目绑定</dt><dd>{asset.entityBindingStatus === 'approved' ? '已批准' : '未批准'}</dd></div>
            </dl>
            {asset.entityBindingStatus === 'approved' ? <p className="cv1-drawer__notice"><IconCircleCheck size={16} />资产已绑定到当前项目实体。</p> : null}
            {asset.category === 'virtual_character' && asset.providerStatus !== 'active' ? <button className="cv1-secondary-action" type="button" disabled={!canCreateVirtual || !approvalAvailable} onClick={() => onCreateVirtual(asset, creationPrompt.trim())}>创建虚拟人物</button> : null}
            <button className="cv1-secondary-action" type="button" disabled={!assetReady || !approvalAvailable} onClick={() => onBind(asset)}>绑定到当前镜头</button>
            {!asset.targetEntityId ? <small className="cv1-drawer__explain">当前镜头没有可绑定的实体目标。</small> : null}
            {!approvalAvailable ? <small className="cv1-drawer__explain">操作确认服务当前不可用。</small> : null}
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
