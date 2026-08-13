import { IconAlertCircle, IconCircleCheck } from '@tabler/icons-react';
import type { CanvasAssetView } from '../pages/CanvasV1Page';

interface AssetReadinessPanelProps {
  assets: CanvasAssetView[];
}

const categoryLabels: Record<CanvasAssetView['category'], string> = {
  human: '真人',
  virtual_character: '虚拟人物',
  store: '门店',
  product: '商品',
  brand: '品牌',
  prop: '道具',
  voice: '声音',
  image: '图片',
  video: '视频',
};

function checkAsset(asset: CanvasAssetView) {
  const issues: string[] = [];
  if (asset.rightsStatus !== 'authorized') issues.push(asset.category === 'human' ? '等待真人授权' : '使用权未授权');
  if (asset.approvalStatus !== 'approved') issues.push('素材尚未审批');
  if (asset.providerStatus !== 'active') issues.push(asset.providerStatus === 'processing' ? 'Provider 注册中' : 'Provider 不可用');
  if (asset.entityBindingStatus !== 'approved') issues.push('项目绑定未批准');
  return issues;
}

export function AssetReadinessPanel({ assets }: AssetReadinessPanelProps) {
  return (
    <section className="cv1-asset-readiness" aria-labelledby="cv1-asset-readiness-title">
      <div className="cv1-asset-readiness__heading">
        <div><span>ASSET READINESS</span><h2 id="cv1-asset-readiness-title">资产门禁</h2></div>
        <small>{assets.filter((asset) => checkAsset(asset).length === 0).length}/{assets.length} 就绪</small>
      </div>
      <ul>
        {assets.map((asset) => {
          const issues = checkAsset(asset);
          return (
            <li key={asset.assetId}>
              {issues.length ? <IconAlertCircle size={15} /> : <IconCircleCheck size={15} />}
              <span><strong>{asset.displayName}</strong><small>{categoryLabels[asset.category]} · {issues[0] ?? '权利、审批与绑定已通过'}</small></span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
