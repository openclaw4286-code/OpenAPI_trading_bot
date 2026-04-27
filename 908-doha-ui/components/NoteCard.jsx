import { Pin } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import MemberAvatar from './MemberAvatar.jsx';
import { snippet } from '../lib/notes.js';

export default function NoteCard({ note, onOpen }) {
  const { members } = useAuth();
  const author = members.find((m) => m.id === (note.updatedBy ?? note.createdBy));
  const preview = snippet(note);
  const when = new Date(note.updatedAt ?? note.createdAt);
  const dateLabel = `${when.getMonth() + 1}/${when.getDate()}`;

  return (
    <article
      onClick={() => onOpen?.(note)}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border p-4 text-left"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border-subtle)',
        boxShadow: 'var(--elev-1)',
        transition: 'box-shadow 160ms var(--ease-soft), transform 160ms var(--ease-soft)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--elev-2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--elev-1)';
      }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div
            className="t-body1 truncate"
            style={{ fontWeight: 600, color: 'var(--text-primary)' }}
          >
            {note.title || '제목 없음'}
          </div>
        </div>
        {note.pinned && (
          <Pin
            size={14}
            strokeWidth={1.75}
            fill="var(--accent-brand)"
            style={{ color: 'var(--accent-brand)', flexShrink: 0, marginTop: 3 }}
          />
        )}
      </div>

      {preview && (
        <p
          className="t-body2 mt-1.5 line-clamp-4 whitespace-pre-wrap"
          style={{ color: 'var(--text-secondary)' }}
        >
          {preview}
        </p>
      )}

      {note.tags?.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {note.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="t-caption rounded-full px-2 py-0.5"
              style={{
                background: 'var(--surface-layered)',
                color: 'var(--text-secondary)',
              }}
            >
              #{t}
            </span>
          ))}
          {note.tags.length > 4 && (
            <span className="t-caption" style={{ color: 'var(--text-tertiary)' }}>
              +{note.tags.length - 4}
            </span>
          )}
        </div>
      )}

      <div
        className="mt-3 flex items-center justify-between t-caption"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <span>{dateLabel}</span>
        {author && <MemberAvatar member={author} size={16} />}
      </div>
    </article>
  );
}
