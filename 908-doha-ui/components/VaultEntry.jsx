import { Copy, ExternalLink, KeyRound, User } from 'lucide-react';
import IconButton from './IconButton.jsx';

// Vault list row. Mirrors the docs/list-row.html shape — square
// accent leading, title + subtitle, trailing copy/open actions.

export default function VaultEntry({ entry, onOpen, onCopyPassword, onCopyUsername }) {
  const initial = (entry.title || entry.url || '?').trim()[0]?.toUpperCase() ?? '?';

  const open = (e) => {
    e.stopPropagation();
    if (!entry.url) return;
    const url = /^https?:\/\//i.test(entry.url) ? entry.url : `https://${entry.url}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <article
      onClick={() => onOpen(entry)}
      className="group flex cursor-pointer items-center gap-3 rounded-xl border p-3"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border-subtle)',
        transition: 'background 160ms var(--ease-soft), box-shadow 160ms var(--ease-soft)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface-layered)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--surface)';
      }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: 'var(--accent-brand-soft)',
          color: 'var(--accent-brand)',
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        {initial}
      </div>

      <div className="min-w-0 flex-1">
        <div
          className="t-body2 truncate"
          style={{ fontWeight: 600, color: 'var(--text-primary)' }}
        >
          {entry.title || '(제목 없음)'}
        </div>
        <div
          className="mt-0.5 flex items-center gap-1.5 t-caption"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {entry.username ? (
            <>
              <User size={11} strokeWidth={1.75} />
              <span className="truncate">{entry.username}</span>
            </>
          ) : (
            <>
              <KeyRound size={11} strokeWidth={1.75} />
              <span>자격 증명</span>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {entry.username && (
          <IconButton
            icon={User}
            size="sm"
            variant="clear"
            ariaLabel="아이디 복사"
            onClick={(e) => {
              e.stopPropagation();
              onCopyUsername(entry);
            }}
          />
        )}
        <IconButton
          icon={Copy}
          size="sm"
          variant="clear"
          ariaLabel="비밀번호 복사"
          onClick={(e) => {
            e.stopPropagation();
            onCopyPassword(entry);
          }}
        />
        {entry.url && (
          <IconButton
            icon={ExternalLink}
            size="sm"
            variant="clear"
            ariaLabel="URL 열기"
            onClick={open}
          />
        )}
      </div>
    </article>
  );
}
