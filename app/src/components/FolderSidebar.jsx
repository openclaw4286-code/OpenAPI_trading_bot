import { useEffect, useRef, useState } from 'react';
import { FolderClosed, Inbox, NotebookPen, Pencil, Pin, Plus, StickyNote, Trash2 } from 'lucide-react';
import IconButton from './IconButton.jsx';
import { useNotes } from '../contexts/NotesContext.jsx';
import { useViewport } from '../contexts/ViewportContext.jsx';

// Secondary sidebar for the Notes tab. Sits flush against the primary
// sidebar so the two read as one continuous left chrome.

const SPECIALS = [
  { id: 'all', label: '모든 노트', icon: StickyNote },
  { id: 'pinned', label: '고정됨', icon: Pin },
  { id: 'unfiled', label: '분류 없음', icon: Inbox },
];

export default function FolderSidebar() {
  const {
    notes,
    folders,
    selected,
    setSelected,
    addFolder,
    renameFolder,
    removeFolder,
    setOpenNote,
  } = useNotes();
  const { canMutateNotes } = useViewport();
  const readOnly = !canMutateNotes;

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (creating || editingId) inputRef.current?.focus();
  }, [creating, editingId]);

  const countFor = (id) => {
    if (id === 'all') return notes.length;
    if (id === 'pinned') return notes.filter((n) => n.pinned).length;
    if (id === 'unfiled') return notes.filter((n) => !n.folderId).length;
    return notes.filter((n) => n.folderId === id).length;
  };

  const pick = (id) => {
    setSelected(id);
    setOpenNote(null);
  };

  const submitCreate = async () => {
    const value = draft.trim();
    setCreating(false);
    setDraft('');
    if (!value) return;
    await addFolder(value);
  };

  const submitRename = async () => {
    const value = editingText.trim();
    const id = editingId;
    setEditingId(null);
    if (!value || !id) return;
    await renameFolder(id, value);
  };

  return (
    <aside
      className="flex w-56 shrink-0 flex-col border-r px-3 py-4"
      style={{
        borderColor: 'var(--border-subtle)',
        background: 'var(--surface-layered)',
      }}
    >
      <div className="flex items-center gap-2 px-2 pb-3">
        <NotebookPen size={14} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)' }} />
        <span className="t-label" style={{ color: 'var(--text-secondary)' }}>
          Notes
        </span>
      </div>

      <nav className="flex flex-col gap-0.5">
        {SPECIALS.map(({ id, label, icon: Icon }) => (
          <Row
            key={id}
            active={selected === id}
            onClick={() => pick(id)}
            icon={<Icon size={14} strokeWidth={1.75} />}
            label={label}
            count={countFor(id)}
          />
        ))}
      </nav>

      <div className="my-3 border-t" style={{ borderColor: 'var(--border-subtle)' }} />

      <div className="flex items-center justify-between px-2 pb-1">
        <span className="t-caption" style={{ color: 'var(--text-tertiary)' }}>
          폴더
        </span>
        {!readOnly && (
          <IconButton
            icon={Plus}
            size="sm"
            variant="clear"
            ariaLabel="폴더 추가"
            onClick={() => setCreating(true)}
          />
        )}
      </div>

      <nav className="flex flex-col gap-0.5">
        {folders.map((f) =>
          editingId === f.id ? (
            <div
              key={f.id}
              className="flex h-9 items-center gap-2 rounded-md px-2"
              style={{ background: 'var(--surface)' }}
            >
              <FolderClosed size={14} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)' }} />
              <input
                ref={inputRef}
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitRename();
                  else if (e.key === 'Escape') setEditingId(null);
                }}
                onBlur={submitRename}
                className="flex-1 bg-transparent outline-none t-label"
                style={{ color: 'var(--text-primary)' }}
                maxLength={40}
              />
            </div>
          ) : (
            <Row
              key={f.id}
              active={selected === f.id}
              onClick={() => pick(f.id)}
              icon={<FolderClosed size={14} strokeWidth={1.75} />}
              label={f.name}
              count={countFor(f.id)}
              actions={
                readOnly ? null : (
                  <>
                    <IconButton
                      icon={Pencil}
                      size="sm"
                      variant="clear"
                      ariaLabel={`${f.name} 이름 변경`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(f.id);
                        setEditingText(f.name);
                      }}
                    />
                    <IconButton
                      icon={Trash2}
                      size="sm"
                      variant="danger"
                      ariaLabel={`${f.name} 삭제`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          confirm(
                            `"${f.name}" 폴더를 삭제할까요? 안의 노트는 '분류 없음'으로 이동합니다.`,
                          )
                        ) {
                          removeFolder(f.id);
                        }
                      }}
                    />
                  </>
                )
              }
            />
          ),
        )}

        {creating && (
          <div
            className="flex h-9 items-center gap-2 rounded-md px-2"
            style={{ background: 'var(--surface)' }}
          >
            <FolderClosed size={14} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)' }} />
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitCreate();
                else if (e.key === 'Escape') {
                  setCreating(false);
                  setDraft('');
                }
              }}
              onBlur={submitCreate}
              placeholder="폴더 이름"
              className="flex-1 bg-transparent outline-none t-label"
              style={{ color: 'var(--text-primary)' }}
              maxLength={40}
            />
          </div>
        )}
      </nav>
    </aside>
  );
}

function Row({ active, onClick, icon, label, count, actions }) {
  return (
    <button
      onClick={onClick}
      className="group flex h-9 items-center gap-2 rounded-md px-2 t-label"
      style={{
        background: active ? 'var(--accent-brand-soft)' : 'transparent',
        color: active ? 'var(--text-brand)' : 'var(--text-secondary)',
        transition: 'background 160ms var(--ease-soft), color 160ms var(--ease-soft)',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--surface)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      <span style={{ color: active ? 'var(--text-brand)' : 'var(--text-tertiary)' }}>
        {icon}
      </span>
      <span className="flex-1 truncate text-left">{label}</span>
      {actions ? (
        <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {actions}
        </span>
      ) : (
        <span className="t-caption tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
          {count || ''}
        </span>
      )}
    </button>
  );
}
