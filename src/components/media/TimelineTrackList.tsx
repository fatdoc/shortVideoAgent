import { useMemo } from 'react';
import type { TimelineClip, TimelineTrack } from '../../domain/types';

interface TimelineTrackListProps {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  duration: number;
  playhead: number;
  selectedClipId: string | null;
  onSelectClip: (clipId: string) => void;
}

function formatTime(value: number): string {
  const total = Math.max(0, Math.floor(value));
  const second = String(total % 60).padStart(2, '0');
  const minute = Math.floor(total / 60);
  return `${minute}:${second}`;
}

function resolveTrackColor(track: TimelineTrack): string {
  if (track.type === 'video') return '#1677FF';
  if (track.name.includes('BGM')) return '#722ED1';
  if (track.name.includes('口播')) return '#13C2C2';
  if (track.type === 'subtitle') return '#13C2C2';
  if (track.type === 'overlay') return '#FA8C16';
  return '#595959';
}

function resolveTrackId(track: TimelineTrack, index: number): string {
  return `timeline-track-${track.id}-${index}`;
}

export function TimelineTrackList({
  tracks,
  clips,
  duration,
  playhead,
  selectedClipId,
  onSelectClip,
}: TimelineTrackListProps) {
  const maxDuration = Math.max(duration, 0.0001);

  const clipsByTrack = useMemo(() => {
    const map = new Map<string, TimelineClip[]>();
    for (const clip of clips) {
      const bucket = map.get(clip.trackId) ?? [];
      bucket.push(clip);
      map.set(clip.trackId, bucket);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => a.start - b.start);
    }
    return map;
  }, [clips]);

  return (
    <div className="media-track-list">
      {tracks.map((track, index) => {
        const trackClips = clipsByTrack.get(track.id) ?? [];
        const markerLeft = `${Math.min(1, Math.max(0, playhead / maxDuration)) * 100}%`;
        return (
          <div className="media-track-row" key={track.id}>
            <div className="media-track-name">{track.name}</div>
            <div className="media-track-row-body">
              <div className="media-track-strip-wrap">
                <div className="media-track-strip">
                  <div className="media-playhead-marker" style={{ left: markerLeft }} />
                  {trackClips.length === 0 ? (
                    <div className="media-track-empty" key={resolveTrackId(track, index)}>
                      暂无片段
                    </div>
                  ) : null}
                  {trackClips.map((clip) => {
                    const left = `${Math.min(1, Math.max(0, clip.start / maxDuration)) * 100}%`;
                    const width = `${Math.max(4, ((clip.end - clip.start) / maxDuration) * 100)}%`;
                    const isSelected = selectedClipId === clip.id;
                    const color = resolveTrackColor(track);
                    return (
                      <button
                        type="button"
                        key={clip.id}
                        data-testid={`rough-cut-clip-${clip.id}`}
                        className={`media-track-clip ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => onSelectClip(clip.id)}
                        style={{ left, width, background: color }}
                        title={`${track.name}：${clip.label}（${formatTime(clip.start)} - ${formatTime(clip.end)}）`}
                      >
                        <span className="media-track-clip-label" title={clip.label}>
                          {clip.label}
                        </span>
                        <span className="media-track-clip-time">{formatTime(clip.start)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
