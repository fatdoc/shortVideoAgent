import { ClockCircleOutlined, FileTextOutlined, PlayCircleOutlined, SoundOutlined } from '@ant-design/icons';
import { Tag, Typography } from 'antd';
import type { Asset, AssetType } from '../../domain/types';
import { StatusTag } from '../common/StatusTag';

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
      <img
        className="media-asset-thumb"
        src={asset.thumbnail}
        alt={`${asset.name} 缩略图`}
      />

      <div className="media-asset-body">
        <Typography.Text strong className="media-asset-title" ellipsis>
          {asset.name}
        </Typography.Text>

        <div className="media-asset-meta">
          <StatusTag kind="match" value={asset.status} />
          <Tag
            icon={resolveAssetIcon(asset.type)}
            style={{ borderRadius: 10 }}
          >
            {resolveAssetLabel(asset.type)}
          </Tag>
        </div>

        <div className="media-asset-meta">
          <Tag icon={<ClockCircleOutlined />} color="default">
            {formatDuration(asset.duration)}
          </Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>
            {asset.tags.join(' / ') || '无标签'}
          </Typography.Text>
        </div>
      </div>
    </button>
  );
}

function resolveAssetLabel(type: AssetType): string {
  return resolveAssetTypeLabel(type);
}
