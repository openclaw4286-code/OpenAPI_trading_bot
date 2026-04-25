import { Calendar, User } from 'lucide-react';
import { PRIORITY_LABELS } from '../lib/tasks.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useViewport } from '../contexts/ViewportContext.jsx';
import MemberAvatar from './MemberAvatar.jsx';

const PRIORITY_EDGE = {
  high: 'var(--state-negative)',
  mid: 'var(--state-warning)',
  low: 'transparent',
};

const AVATAR_STACK_LIMIT = 3;

export default function TaskCard({ task, onOpen, onDragStart, onDragEnd, dragging }) {
  const due = dueMeta(task.dueDate, task.status);
  const { members } = useAuth();
  const { canDragTasks } = useViewport();
  const assigneeMembers = (task.assignees ?? [])
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean);
  const hasLegacyAssignee = !assigneeMembers.length && !!task.assignee;
  const author = members.find((m) => m.id === (task.createdBy ?? task.updatedBy));

  return (
    <article
      draggable={canDragTasks}
      onDragStart={
        canDragTasks
          ? (e) => {
              e.dataTransfer.setData('text/plain', task.id);
              e.dataTransfer.effectAllowed = 'move';
              onDragStart?.(task.id);
            }
          : undefined
      }
      onDragEnd={() => onDragEnd?.()}
      onClick={() => onOpen?.(task)}
      className="group cursor-pointer select-none rounded-lg border p-3 text-left"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border-subtle)',
        borderLeftWidth: task.priority === 'low' ? 1 : 3,
        borderLeftColor: PRIORITY_EDGE[task.priority],
        boxShadow: 'var(--elev-1)',
        opacity: dragging ? 0.4 : 1,
        transition: 'box-shadow 160ms var(--ease-soft), transform 160ms var(--ease-soft), opacity 160ms var(--ease-soft)',
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.985)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = '';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="t-body2 min-w-0 flex-1"
          style={{ color: 'var(--text-primary)', fontWeight: 500, lineHeight: '20px' }}
        >
          {task.title}
        </div>
        {assigneeMembers.length > 0 ? (
          <AvatarStack members={assigneeMembers} />
        ) : (
          author && <MemberAvatar member={author} size={18} />
        )}
      </div>
      {task.description && (
        <div
          className="t-caption mt-1 line-clamp-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          {task.description}
        </div>
      )}
      {(hasLegacyAssignee || task.dueDate || task.priority === 'high') && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {hasLegacyAssignee && (
            <Meta icon={User}>
              <span>{task.assignee}</span>
            </Meta>
          )}
          {task.dueDate && (
            <Meta icon={Calendar} tone={due.tone}>
              <span>{due.label}</span>
            </Meta>
          )}
          {task.priority === 'high' && (
            <span
              className="t-caption rounded-full px-1.5 py-0.5"
              style={{ background: 'var(--state-negative-soft)', color: 'var(--state-negative)' }}
            >
              {PRIORITY_LABELS.high}
            </span>
          )}
        </div>
      )}
    </article>
  );
}

function AvatarStack({ members }) {
  const visible = members.slice(0, AVATAR_STACK_LIMIT);
  const extra = members.length - visible.length;
  return (
    <div className="flex items-center">
      {visible.map((m, i) => (
        <span
          key={m.id}
          title={m.name}
          style={{
            marginLeft: i === 0 ? 0 : -6,
            boxShadow: '0 0 0 2px var(--surface)',
            borderRadius: '999px',
            display: 'inline-flex',
          }}
        >
          <MemberAvatar member={m} size={18} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full t-caption"
          style={{
            marginLeft: -6,
            width: 18,
            height: 18,
            background: 'var(--surface-layered)',
            color: 'var(--text-secondary)',
            boxShadow: '0 0 0 2px var(--surface)',
            fontSize: 10,
            fontWeight: 600,
          }}
          title={members.slice(AVATAR_STACK_LIMIT).map((m) => m.name).join(', ')}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

function Meta({ icon: Icon, tone, children }) {
  const color =
    tone === 'negative'
      ? 'var(--state-negative)'
      : tone === 'warning'
      ? 'var(--state-warning)'
      : 'var(--text-secondary)';
  return (
    <span className="t-caption inline-flex items-center gap-1" style={{ color }}>
      <Icon size={12} strokeWidth={1.75} />
      {children}
    </span>
  );
}

function dueMeta(iso, status) {
  if (!iso) return { label: '', tone: 'neutral' };
  const [y, m, d] = iso.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due - today) / 86_400_000);
  const label = `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
  if (status === 'done') return { label, tone: 'neutral' };
  if (diff < 0) return { label: `${label} · 지연`, tone: 'negative' };
  if (diff === 0) return { label: `${label} · 오늘`, tone: 'warning' };
  if (diff <= 2) return { label: `${label} · D-${diff}`, tone: 'warning' };
  return { label, tone: 'neutral' };
}
