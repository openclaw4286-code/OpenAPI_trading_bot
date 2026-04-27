import { useState } from 'react';
import { Plus } from 'lucide-react';
import TaskCard from './TaskCard.jsx';
import { useViewport } from '../contexts/ViewportContext.jsx';

export default function KanbanColumn({
  status,
  label,
  tasks,
  draggingId,
  onDropTask,
  onDragStart,
  onDragEnd,
  onOpen,
  onQuickAdd,
}) {
  const [hover, setHover] = useState(false);
  const { canMutateTasks, canDragTasks } = useViewport();

  return (
    <section
      onDragOver={
        canDragTasks
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (!hover) setHover(true);
            }
          : undefined
      }
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setHover(false);
      }}
      onDrop={
        canDragTasks
          ? (e) => {
              e.preventDefault();
              setHover(false);
              const id = e.dataTransfer.getData('text/plain');
              if (id) onDropTask?.(id, status);
            }
          : undefined
      }
      className="flex min-h-[400px] w-[280px] shrink-0 flex-col gap-2 rounded-xl p-3"
      style={{
        background: hover ? 'var(--accent-brand-soft)' : 'var(--surface-layered)',
        outline: hover ? '1px dashed var(--border-focus)' : 'none',
        transition: 'background 160ms var(--ease-soft), outline-color 160ms var(--ease-soft)',
      }}
    >
      <header className="flex items-baseline justify-between px-1">
        <div className="t-label" style={{ color: 'var(--text-primary)' }}>
          {label}
        </div>
        <span
          className="t-caption rounded-full px-2 py-0.5"
          style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
        >
          {tasks.length}
        </span>
      </header>

      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            dragging={draggingId === t.id}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onOpen={onOpen}
          />
        ))}
      </div>

      {canMutateTasks && (
        <button
          onClick={() => onQuickAdd?.(status)}
          className="mt-1 flex h-9 items-center justify-center gap-1.5 rounded-md t-label"
          style={{
            color: 'var(--text-secondary)',
            border: '1px dashed var(--border-default)',
            background: 'transparent',
            transition: 'background 160ms var(--ease-soft), color 160ms var(--ease-soft)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <Plus size={14} strokeWidth={1.75} />
          작업 추가
        </button>
      )}
    </section>
  );
}
