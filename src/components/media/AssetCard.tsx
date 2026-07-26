import { ClockCircleOutlined, FileTextOutlined, PlayCircleOutlined, SoundOutlined } from '@ant-design/icons';
import { Tag, Typography } from 'antd';
import type { Asset, AssetType } from '../../domain/types';
import { StatusTag } from '../common/StatusTag';
import { resolveAssetVisual } from './assetVisuals';

interface AssetCardProps {
  asset: Asset;
  selected: boolean;
  onSelect: (asset: Asset) => void;
}

function resolveAssetTypeLabel(type: AssetType): string {
  if (type === 'video') return '视频';
  if (type === 'image') return '图片';
  if (type === 'audio') return '音频';
  return '文本';
}

function resolveAssetIcon(type: AssetType): React.ReactElement {
  if (type === 'video') return <PlayCircleOutlined />;
  if (type === 'audio') return <SoundOutlined />;
  if (type === 'image') return <FileTextOutlined />;
  return <FileTextOutlined />;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '默认 3s';
  if (seconds < 60) return `${seconds}s`;
  const minute = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${minute}:${String(remain).padStart(2, '0')}`;
}

export function AssetCard({ asset, selected, onSelect }: AssetCardProps) {
  return (
    <button
      type="button"
      className={`media-asset-card ${selected ? 'is-active' : ''}`}
      onClick={() => onSelect(asset)}
      data-testid={`rough-cut-asset-card-${asset.id}`}
    >
      <div className="media-asset-thumb-wrap">
        <img
          className="media-asset-thumb"
          src={resolveAssetVisual(asset)}
          alt={`${asset.name} 缩略图`}
        />
        <span className="media-asset-duration">
          <ClockCircleOutlined />
          {formatDuration(asset.duration)}
        </span>
      </div>

      <div className="media-asset-body">
        <Typography.Text strong className="media-asset-title" ellipsis>
          {asset.name}
        </Typography.Text>

        <div className="media-asset-meta">
          <StatusTag kind="match" value={asset.status} />
          <Tag
            icon={resolveAssetIcon(asset.type)}
            className="media-asset-type"
          >
            {resolveAssetLabel(asset.type)}
          </Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>
            {asset.tags[0] || '无标签'}
          </Typography.Text>
        </div>
      </div>
    </button>
  );
}

function resolveAssetLabel(type: AssetType): string {
  return resolveAssetTypeLabel(type);
}
