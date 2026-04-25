import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
} from 'lucide-react';

export const SLASH_ITEMS = [
  { type: 'text', label: '단락', desc: '본문 텍스트', icon: Pilcrow, keywords: ['text', 'paragraph', '단락', '텍스트', 'p'] },
  { type: 'h1', label: '헤딩 1', desc: '큰 제목', icon: Heading1, keywords: ['heading1', 'h1', '큰', '제목'] },
  { type: 'h2', label: '헤딩 2', desc: '중간 제목', icon: Heading2, keywords: ['heading2', 'h2', '중간', '제목'] },
  { type: 'h3', label: '헤딩 3', desc: '작은 제목', icon: Heading3, keywords: ['heading3', 'h3', '작은', '제목'] },
  { type: 'bullet', label: '글머리 목록', desc: '· 항목', icon: List, keywords: ['bullet', 'list', '글머리', '리스트'] },
  { type: 'numbered', label: '번호 목록', desc: '1. 항목', icon: ListOrdered, keywords: ['numbered', 'ordered', '번호'] },
  { type: 'check', label: '할 일 목록', desc: '☐ 체크리스트', icon: ListChecks, keywords: ['todo', 'check', 'task', '할일', '체크'] },
  { type: 'quote', label: '인용', desc: '인용문', icon: Quote, keywords: ['quote', '인용'] },
  { type: 'divider', label: '구분선', desc: '─────', icon: Minus, keywords: ['divider', 'separator', 'hr', '구분', '선'] },
];

export function filterSlashItems(query) {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter((it) => {
    if (it.label.toLowerCase().includes(q)) return true;
    if (it.type.toLowerCase().includes(q)) return true;
    return it.keywords.some((k) => k.toLowerCase().includes(q));
  });
}

export default function SlashMenu({ anchorRect, query, onSelect, onClose }) {
  const items = useMemo(() => filterSlashItems(query), [query]);
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const [position, setPosition] = useState(null);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!items.length) return;
    const onKey = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => Math.min(items.length - 1, a + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (items[active]) onSelect(items[active]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [items, active, onSelect, onClose]);

  useLayoutEffect(() => {
    if (!anchorRect) return;
    const PANEL_W = 320;
    const PANEL_H = Math.min(360, items.length * 44 + 16);
    const margin = 6;
    let left = anchorRect.left;
    if (left + PANEL_W > window.innerWidth - 12) {
      left = window.innerWidth - PANEL_W - 12;
    }
    let top = anchorRect.bottom + margin;
    if (top + PANEL_H > window.innerHeight - 12) {
      top = anchorRect.top - PANEL_H - margin;
    }
    setPosition({ top, left });
  }, [anchorRect, items.length]);

  useEffect(() => {
    if (!ref.current) return;
    const list = ref.current;
    const item = list.querySelector(`[data-idx="${active}"]`);
    if (item) item.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!position) return null;

  return createPortal(
    <div
      ref={ref}
      role="listbox"
      className="z-[80] flex flex-col overflow-hidden rounded-xl"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: 320,
        maxHeight: 360,
        background: 'var(--surface)',
        boxShadow: 'var(--elev-3)',
        border: '1px solid var(--border-subtle)',
        animation: 'dsSelectFade 200ms var(--ease-soft)',
      }}
    >
      {items.length === 0 ? (
        <div
          className="t-body2 px-4 py-5 text-center"
          style={{ color: 'var(--text-tertiary)' }}
        >
          일치하는 블록이 없어요
        </div>
      ) : (
        <ul className="flex-1 overflow-auto py-1">
          {items.map((it, i) => {
            const Icon = it.icon;
            const isActive = i === active;
            return (
              <li key={it.type} data-idx={i}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(it);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left"
                  style={{
                    background: isActive ? 'var(--surface-layered)' : 'transparent',
                  }}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: 'var(--surface-layered)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Icon size={16} strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <div
                      className="t-body2 truncate"
                      style={{ color: 'var(--text-primary)', fontWeight: 500 }}
                    >
                      {it.label}
                    </div>
                    <div
                      className="t-caption truncate"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {it.desc}
                    </div>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>,
    document.body,
  );
}
