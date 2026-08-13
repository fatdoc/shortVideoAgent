import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconGripVertical } from '@tabler/icons-react';
import type { CanvasShotView } from '../pages/CanvasV1Page';

interface PlaylistStripProps {
  shots: CanvasShotView[];
  orderedShotIds: string[];
  onReorder: (shotIds: string[]) => void;
}

function SortableShot({ shot }: { shot: CanvasShotView }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: shot.shotId });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? 'is-dragging' : ''}>
      <button type="button" aria-label={`拖动镜头 ${shot.sequence}`} {...attributes} {...listeners}><IconGripVertical size={14} /></button>
      <span>{String(shot.sequence).padStart(2, '0')}</span>
      <div>{shot.thumbnailUrl ? <img src={shot.thumbnailUrl} alt="" /> : null}</div>
      <strong>{shot.title}</strong>
      <small>{shot.durationSeconds}s</small>
    </li>
  );
}

export function PlaylistStrip({ shots, orderedShotIds, onReorder }: PlaylistStripProps) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const orderedShots = orderedShotIds.flatMap((shotId) => {
    const shot = shots.find((candidate) => candidate.shotId === shotId);
    return shot ? [shot] : [];
  });

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = orderedShotIds.indexOf(String(active.id));
    const newIndex = orderedShotIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(orderedShotIds, oldIndex, newIndex));
  };

  return (
    <section className="cv1-playlist" aria-label="Playlist 镜头顺序">
      <header><div><span>PLAYLIST</span><strong>成片顺序</strong></div><small>{orderedShots.reduce((total, shot) => total + shot.durationSeconds, 0)} 秒</small></header>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedShotIds} strategy={horizontalListSortingStrategy}>
          <ol>{orderedShots.map((shot) => <SortableShot key={shot.shotId} shot={shot} />)}</ol>
        </SortableContext>
      </DndContext>
    </section>
  );
}
