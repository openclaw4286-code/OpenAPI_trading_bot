import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Pin, Trash2, X } from 'lucide-react';
import AutoTextarea from './AutoTextarea.jsx';
import IconButton from './IconButton.jsx';
import Button from './Button.jsx';
import FormSelect from './FormSelect.jsx';
import SlashMenu from './SlashMenu.jsx';
import { emptyBlock, isTextLike } from '../lib/notes.js';
import { useViewport } from '../contexts/ViewportContext.jsx';

const TITLE_MAX = 100;

// Markdown shortcuts. Triggered when user presses space at the end of
// the leading marker. Returns the patch to apply to the block.
const MD_SHORTCUTS = [
  { match: '#', patch: { type: 'h1' } },
  { match: '##', patch: { type: 'h2' } },
  { match: '###', patch: { type: 'h3' } },
  { match: '-', patch: { type: 'bullet' } },
  { match: '*', patch: { type: 'bullet' } },
  { match: '1.', patch: { type: 'numbered' } },
  { match: '[]', patch: { type: 'check', checked: false } },
  { match: '[ ]', patch: { type: 'check', checked: false } },
  { match: '>', patch: { type: 'quote' } },
];

function detectMarkdown(text) {
  for (const it of MD_SHORTCUTS) if (text === it.match) return it.patch;
  return null;
}

export default function NotePage({
  note,
  folders,
  folderLabel,
  onBack,
  onSave,
  onDelete,
}) {
  const [draft, setDraft] = useState(note);
  const [dirty, setDirty] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [slash, setSlash] = useState(null); // { blockId, query, anchorRect }
  const [focusReq, setFocusReq] = useState(null); // { blockId, offset }
  const blockRefs = useRef({});
  const dirtyRef = useRef(false);
  const draftRef = useRef(note);
  const { canMutateNotes } = useViewport();
  const readOnly = !canMutateNotes;

  useEffect(() => {
    setDraft(note);
    setDirty(false);
    setTagInput('');
    setSlash(null);
    dirtyRef.current = false;
    draftRef.current = note;
  }, [note?.id]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  // Apply a pending focus request after re-render.
  useEffect(() => {
    if (!focusReq) return;
    const el = blockRefs.current[focusReq.blockId];
    if (!el) return;
    el.focus();
    const offset = focusReq.offset ?? el.value.length;
    try {
      el.setSelectionRange(offset, offset);
    } catch {
      /* divider blocks have no selection */
    }
    setFocusReq(null);
  }, [focusReq, draft.blocks]);

  const mutate = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  const setBlocks = (updater) => {
    setDraft((d) => ({
      ...d,
      blocks: typeof updater === 'function' ? updater(d.blocks) : updater,
    }));
    setDirty(true);
  };

  const updateBlock = (id, patch) =>
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const insertAfter = (afterId, newBlock) => {
    setBlocks((bs) => {
      const idx = bs.findIndex((b) => b.id === afterId);
      if (idx < 0) return [...bs, newBlock];
      return [...bs.slice(0, idx + 1), newBlock, ...bs.slice(idx + 1)];
    });
    setFocusReq({ blockId: newBlock.id, offset: 0 });
  };

  const removeAndMergeUp = (id) => {
    setBlocks((bs) => {
      const idx = bs.findIndex((b) => b.id === id);
      if (idx <= 0) return bs;
      const current = bs[idx];
      const prev = bs[idx - 1];
      if (prev.type === 'divider') {
        // remove the divider above us instead
        setFocusReq({ blockId: id, offset: 0 });
        return [...bs.slice(0, idx - 1), ...bs.slice(idx)];
      }
      const merged = { ...prev, text: (prev.text ?? '') + (current.text ?? '') };
      setFocusReq({ blockId: prev.id, offset: (prev.text ?? '').length });
      return [...bs.slice(0, idx - 1), merged, ...bs.slice(idx + 1)];
    });
  };

  const removeBlock = (id) => {
    setBlocks((bs) => {
      if (bs.length <= 1) return bs;
      const idx = bs.findIndex((b) => b.id === id);
      if (idx < 0) return bs;
      const focusTarget = bs[idx - 1] ?? bs[idx + 1];
      if (focusTarget) setFocusReq({ blockId: focusTarget.id });
      return bs.filter((b) => b.id !== id);
    });
  };

  // ---- slash menu ----
  const openSlashAt = useCallback((blockId, query) => {
    const el = blockRefs.current[blockId];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSlash({ blockId, query, anchorRect: rect });
  }, []);

  const closeSlash = () => setSlash(null);

  const applySlashPick = (item) => {
    if (!slash) return;
    const id = slash.blockId;
    const blocks = draftRef.current.blocks;
    const target = blocks.find((b) => b.id === id);
    if (!target) {
      closeSlash();
      return;
    }
    if (item.type === 'divider') {
      // turn current into divider, append empty text after for cursor
      const next = emptyBlock('text');
      setBlocks((bs) =>
        bs.flatMap((b) =>
          b.id === id ? [{ ...b, type: 'divider', text: '' }, next] : [b],
        ),
      );
      setFocusReq({ blockId: next.id, offset: 0 });
    } else {
      const patch = { type: item.type, text: '' };
      if (item.type === 'check') patch.checked = false;
      updateBlock(id, patch);
      setFocusReq({ blockId: id, offset: 0 });
    }
    closeSlash();
  };

  // ---- tags / title / pin ----
  const addTag = () => {
    const raw = tagInput.trim().replace(/^#/, '');
    if (!raw) return;
    const current = draft.tags ?? [];
    if (current.includes(raw)) {
      setTagInput('');
      return;
    }
    mutate({ tags: [...current, raw] });
    setTagInput('');
  };
  const removeTag = (t) =>
    mutate({ tags: (draft.tags ?? []).filter((x) => x !== t) });

  // ---- save / back / delete ----
  const hasContent = (n) =>
    (n.title ?? '').trim() ||
    (n.blocks ?? []).some(
      (b) => b.type === 'divider' || (b.text ?? '').trim().length > 0,
    );

  const saveIfNeeded = async () => {
    if (readOnly) return;
    const current = draftRef.current;
    if (!dirtyRef.current) return;
    if (!hasContent(current)) return;
    await onSave({ ...current, title: (current.title ?? '').trim() });
  };

  useEffect(() => {
    return () => {
      saveIfNeeded();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBack = async () => {
    await saveIfNeeded();
    onBack();
  };

  const handleDelete = () => {
    if (!confirm('이 노트를 삭제할까요?')) return;
    dirtyRef.current = false;
    onDelete?.(draft);
  };

  // ---- per-block keydown ----
  const handleBlockKeyDown = (block, e) => {
    const el = e.target;
    const cursor = el.selectionStart ?? 0;
    const cursorEnd = el.selectionEnd ?? 0;
    const value = block.text ?? '';

    // Slash trigger: typing "/" at empty position with no current text.
    // Slash menu typing is forwarded to its own keydown handler.

    if (slash && slash.blockId === block.id) {
      // Let SlashMenu handle Enter/Tab/Escape/Arrow via its own listener.
      // But Escape closes locally too.
      if (e.key === 'Backspace' && value === '/') {
        // erasing the slash closes the menu
        closeSlash();
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !e.nativeEvent?.isComposing) {
      e.preventDefault();
      handleEnter(block, cursor);
      return;
    }

    if (
      e.key === 'Backspace' &&
      cursor === 0 &&
      cursorEnd === 0
    ) {
      // empty list-like -> demote to text instead of deleting
      if (value === '' && block.type !== 'text' && block.type !== 'divider') {
        e.preventDefault();
        const patch = { type: 'text' };
        if (block.type === 'check') patch.checked = undefined;
        updateBlock(block.id, patch);
        return;
      }
      // first block && empty -> nothing
      const idx = draftRef.current.blocks.findIndex((b) => b.id === block.id);
      if (idx === 0) return;
      e.preventDefault();
      removeAndMergeUp(block.id);
      return;
    }

    if (e.key === ' ') {
      const patch = detectMarkdown(value);
      if (patch && block.type === 'text' && cursor === value.length) {
        e.preventDefault();
        updateBlock(block.id, { ...patch, text: '' });
      }
    }
  };

  const handleEnter = (block, cursor) => {
    const value = block.text ?? '';
    // typed "---" + Enter on a text block → divider
    if (block.type === 'text' && value.trim() === '---') {
      const next = emptyBlock('text');
      setBlocks((bs) =>
        bs.flatMap((b) => (b.id === block.id ? [{ ...b, type: 'divider', text: '' }, next] : [b])),
      );
      setFocusReq({ blockId: next.id, offset: 0 });
      return;
    }

    // empty list-like → demote to text (don't create new block)
    if (
      !value &&
      ['bullet', 'numbered', 'check', 'quote'].includes(block.type)
    ) {
      const patch = { type: 'text' };
      if (block.type === 'check') patch.checked = undefined;
      updateBlock(block.id, patch);
      return;
    }

    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    const carryType = ['bullet', 'numbered', 'quote'].includes(block.type)
      ? block.type
      : block.type === 'check'
      ? 'check'
      : 'text';
    const newBlock = emptyBlock(carryType);
    newBlock.text = after;

    setBlocks((bs) =>
      bs.flatMap((b) => (b.id === block.id ? [{ ...b, text: before }, newBlock] : [b])),
    );
    setFocusReq({ blockId: newBlock.id, offset: 0 });
  };

  // ---- text change w/ slash menu detection ----
  const handleTextChange = (block, newValue) => {
    // open slash if user just typed `/` at the start of a text block
    if (
      block.type === 'text' &&
      newValue.startsWith('/') &&
      !(block.text ?? '').startsWith('/')
    ) {
      openSlashAt(block.id, newValue.slice(1));
    } else if (slash && slash.blockId === block.id) {
      if (!newValue.startsWith('/')) {
        closeSlash();
      } else {
        setSlash((s) => ({ ...s, query: newValue.slice(1) }));
      }
    }
    updateBlock(block.id, { text: newValue });
  };

  const folderOptions = useMemo(
    () => [
      { value: '', label: '분류 없음' },
      ...folders.map((f) => ({ value: f.id, label: f.name })),
    ],
    [folders],
  );

  // numbered list numbering — count consecutive `numbered` runs
  const numberByBlock = useMemo(() => {
    const map = {};
    let n = 0;
    let prevType = null;
    for (const b of draft.blocks ?? []) {
      if (b.type === 'numbered') {
        n = prevType === 'numbered' ? n + 1 : 1;
        map[b.id] = n;
      } else {
        n = 0;
      }
      prevType = b.type;
    }
    return map;
  }, [draft.blocks]);

  return (
    <div
      className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-6"
      style={{ animation: 'dsPageIn 260ms var(--ease-emphasis)' }}
    >
      <div className="flex items-center gap-2">
        <IconButton icon={ArrowLeft} size="md" variant="clear" ariaLabel="뒤로" onClick={handleBack} />
        <div className="t-caption flex-1 truncate" style={{ color: 'var(--text-tertiary)' }}>
          Notes / {folderLabel}
        </div>
        {!readOnly && (
          <>
            <IconButton
              icon={Pin}
              size="md"
              variant={draft.pinned ? 'brand' : 'clear'}
              ariaLabel={draft.pinned ? '고정 해제' : '고정'}
              onClick={() => mutate({ pinned: !draft.pinned })}
            />
            <IconButton
              icon={Trash2}
              size="md"
              variant="danger"
              ariaLabel="노트 삭제"
              onClick={handleDelete}
            />
          </>
        )}
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <div style={{ minWidth: 220 }}>
            <FormSelect
              value={draft.folderId ?? ''}
              onChange={(v) => mutate({ folderId: v || null })}
              options={folderOptions}
              placeholder="분류 없음"
            />
          </div>
          <TagEditor
            tags={draft.tags ?? []}
            value={tagInput}
            onInput={setTagInput}
            onAdd={addTag}
            onRemove={removeTag}
          />
        </div>
      )}

      {readOnly && (draft.tags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {draft.tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded-full px-2 py-0.5 t-caption"
              style={{
                background: 'var(--surface-layered)',
                color: 'var(--text-secondary)',
              }}
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      <AutoTextarea
        value={draft.title}
        onChange={(e) => mutate({ title: e.target.value.slice(0, TITLE_MAX) })}
        placeholder="제목"
        minRows={1}
        readOnly={readOnly}
        style={{
          fontSize: 32,
          lineHeight: '42px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
        }}
      />

      <div
        className="flex flex-col gap-0.5 border-t pt-4"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        {(draft.blocks ?? []).map((b) => (
          <BlockRow
            key={b.id}
            block={b}
            number={numberByBlock[b.id]}
            readOnly={readOnly}
            registerRef={(el) => {
              if (el) blockRefs.current[b.id] = el;
              else delete blockRefs.current[b.id];
            }}
            onTextChange={(v) => handleTextChange(b, v)}
            onCheckedChange={(c) => updateBlock(b.id, { checked: c })}
            onKeyDown={(e) => handleBlockKeyDown(b, e)}
            onRemove={() => removeBlock(b.id)}
            disableRemove={(draft.blocks ?? []).length <= 1}
          />
        ))}

        {!readOnly && (
          <div
            className="mt-3 t-caption px-1"
            style={{ color: 'var(--text-tertiary)' }}
          >
            빈 블록에서 <kbd style={kbdStyle}>/</kbd>로 블록 추가 ·{' '}
            <kbd style={kbdStyle}>#</kbd> <kbd style={kbdStyle}>-</kbd>{' '}
            <kbd style={kbdStyle}>[]</kbd> <kbd style={kbdStyle}>{'>'}</kbd>{' '}
            + Space로 변환
          </div>
        )}
      </div>

      {slash && (
        <SlashMenu
          anchorRect={slash.anchorRect}
          query={slash.query}
          onSelect={applySlashPick}
          onClose={closeSlash}
        />
      )}
    </div>
  );
}

const kbdStyle = {
  background: 'var(--surface-layered)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 4,
  padding: '0 4px',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
};

function BlockRow({
  block,
  number,
  readOnly,
  registerRef,
  onTextChange,
  onCheckedChange,
  onKeyDown,
  onRemove,
  disableRemove,
}) {
  if (block.type === 'divider') {
    return (
      <DividerRow onRemove={onRemove} disableRemove={disableRemove} readOnly={readOnly} />
    );
  }

  const sharedProps = {
    ref: registerRef,
    value: block.text,
    onChange: (e) => onTextChange(e.target.value),
    onKeyDown: readOnly ? undefined : onKeyDown,
    minRows: 1,
    readOnly,
  };

  if (block.type === 'h1' || block.type === 'h2' || block.type === 'h3') {
    const sizes = {
      h1: { fontSize: 28, lineHeight: '36px', fontWeight: 700 },
      h2: { fontSize: 22, lineHeight: '30px', fontWeight: 600 },
      h3: { fontSize: 18, lineHeight: '26px', fontWeight: 600 },
    };
    return (
      <RowShell onRemove={onRemove} disableRemove={disableRemove} readOnly={readOnly}>
        <AutoTextarea
          {...sharedProps}
          placeholder={
            block.type === 'h1' ? '큰 제목' : block.type === 'h2' ? '중간 제목' : '작은 제목'
          }
          style={{
            ...sizes[block.type],
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
          }}
        />
      </RowShell>
    );
  }

  if (block.type === 'check') {
    return (
      <RowShell onRemove={onRemove} disableRemove={disableRemove} readOnly={readOnly} align="start">
        <label className="mt-1.5 flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={!!block.checked}
            onChange={(e) => onCheckedChange(e.target.checked)}
            disabled={readOnly}
            className="h-4 w-4"
            style={{ accentColor: 'var(--accent-brand)' }}
          />
        </label>
        <AutoTextarea
          {...sharedProps}
          placeholder="할 일"
          style={{
            fontSize: 16,
            lineHeight: '26px',
            color: block.checked ? 'var(--text-tertiary)' : 'var(--text-primary)',
            textDecoration: block.checked ? 'line-through' : 'none',
          }}
        />
      </RowShell>
    );
  }

  if (block.type === 'bullet') {
    return (
      <RowShell onRemove={onRemove} disableRemove={disableRemove} readOnly={readOnly} align="start">
        <span
          className="select-none"
          style={{
            color: 'var(--text-secondary)',
            fontSize: 18,
            lineHeight: '26px',
            paddingTop: 0,
            width: 16,
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          •
        </span>
        <AutoTextarea
          {...sharedProps}
          placeholder=""
          style={{
            fontSize: 16,
            lineHeight: '26px',
            color: 'var(--text-primary)',
          }}
        />
      </RowShell>
    );
  }

  if (block.type === 'numbered') {
    return (
      <RowShell onRemove={onRemove} disableRemove={disableRemove} readOnly={readOnly} align="start">
        <span
          className="select-none"
          style={{
            color: 'var(--text-secondary)',
            fontSize: 16,
            lineHeight: '26px',
            paddingTop: 0,
            minWidth: 20,
            textAlign: 'right',
            flexShrink: 0,
          }}
        >
          {number ?? 1}.
        </span>
        <AutoTextarea
          {...sharedProps}
          placeholder=""
          style={{
            fontSize: 16,
            lineHeight: '26px',
            color: 'var(--text-primary)',
          }}
        />
      </RowShell>
    );
  }

  if (block.type === 'quote') {
    return (
      <RowShell onRemove={onRemove} disableRemove={disableRemove} readOnly={readOnly}>
        <div
          className="pl-3"
          style={{
            borderLeft: '3px solid var(--border-strong)',
            width: '100%',
          }}
        >
          <AutoTextarea
            {...sharedProps}
            placeholder="인용"
            style={{
              fontSize: 15,
              lineHeight: '26px',
              color: 'var(--text-secondary)',
              fontStyle: 'italic',
            }}
          />
        </div>
      </RowShell>
    );
  }

  // text (default)
  return (
    <RowShell onRemove={onRemove} disableRemove={disableRemove} readOnly={readOnly}>
      <AutoTextarea
        {...sharedProps}
        placeholder={readOnly ? '' : '내용 또는 / 입력'}
        style={{
          fontSize: 16,
          lineHeight: '26px',
          color: 'var(--text-primary)',
        }}
      />
    </RowShell>
  );
}

function DividerRow({ onRemove, disableRemove, readOnly }) {
  return (
    <div
      className="group flex items-center gap-2 rounded-md px-1 py-2"
      style={{ transition: 'background 160ms var(--ease-soft)' }}
      onMouseEnter={(e) => {
        if (!readOnly) e.currentTarget.style.background = 'var(--surface-layered)';
      }}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div
        className="flex-1"
        style={{ borderTop: '1px solid var(--border-default)' }}
      />
      {!readOnly && (
        <button
          onClick={onRemove}
          disabled={disableRemove}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: 'var(--text-tertiary)' }}
          aria-label="구분선 삭제"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

function RowShell({ children, onRemove, disableRemove, readOnly, align = 'center' }) {
  return (
    <div
      className="group flex gap-2 rounded-md px-1 py-1"
      style={{
        alignItems: align === 'start' ? 'flex-start' : 'center',
        transition: 'background 160ms var(--ease-soft)',
      }}
      onMouseEnter={(e) => {
        if (!readOnly) e.currentTarget.style.background = 'var(--surface-layered)';
      }}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">{children}</div>
      {!readOnly && (
        <button
          onClick={onRemove}
          disabled={disableRemove}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
          style={{
            color: 'var(--text-tertiary)',
            cursor: disableRemove ? 'not-allowed' : 'pointer',
          }}
          aria-label="블록 삭제"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

function TagEditor({ tags, value, onInput, onAdd, onRemove }) {
  return (
    <div
      className="flex flex-1 flex-wrap items-center gap-1.5 rounded-md px-2 py-1.5"
      style={{ background: 'var(--surface-layered)' }}
    >
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full py-0.5 pl-2 pr-1 t-caption"
          style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
        >
          #{t}
          <button
            onClick={() => onRemove(t)}
            className="flex h-3.5 w-3.5 items-center justify-center rounded-full"
            style={{ color: 'var(--text-tertiary)' }}
            aria-label={`${t} 태그 제거`}
          >
            <X size={10} strokeWidth={2} />
          </button>
        </span>
      ))}
      <input
        value={value}
        onChange={(e) => onInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            onAdd();
          } else if (e.key === 'Backspace' && !value && tags.length) {
            onRemove(tags[tags.length - 1]);
          }
        }}
        placeholder={tags.length ? '태그 추가' : '#태그를 입력하고 Enter'}
        className="min-w-[120px] flex-1 bg-transparent outline-none t-caption"
        style={{ color: 'var(--text-primary)' }}
      />
    </div>
  );
}
