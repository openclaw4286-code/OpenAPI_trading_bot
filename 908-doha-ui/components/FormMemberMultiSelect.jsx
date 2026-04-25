import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';
import MemberAvatar from './MemberAvatar.jsx';

const PANEL_MARGIN = 6;
const VIEWPORT_PAD = 12;

export default function FormMemberMultiSelect({
  value = [],
  onChange,
  members = [],
  placeholder = '담당자 선택',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const selectedIds = new Set(value);
  const selectedMembers = value
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom - VIEWPORT_PAD;
      const above = r.top - VIEWPORT_PAD;
      const desired = Math.min(320, members.length * 44 + 8);
      const openUp = below < desired && above > below;
      setPanelStyle({
        position: 'fixed',
        left: r.left,
        width: r.width,
        maxHeight: Math.max(160, openUp ? above : below),
        ...(openUp
          ? { bottom: window.innerHeight - r.top + PANEL_MARGIN }
          : { top: r.bottom + PANEL_MARGIN }),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, members.length]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e) => {
      if (
        !panelRef.current?.contains(e.target) &&
        !triggerRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (id) => {
    if (selectedIds.has(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  const remove = (id, e) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== id));
  };

  const active = focused || open;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md border py-1.5 pl-2 pr-3 text-left outline-none"
        style={{
          minHeight: 44,
          background: 'var(--surface)',
          borderColor: active ? 'var(--border-focus)' : 'var(--border-default)',
          boxShadow: active ? '0 0 0 3px var(--accent-brand-soft)' : 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition:
            'border-color 160ms var(--ease-soft), box-shadow 160ms var(--ease-soft)',
        }}
      >
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {selectedMembers.length === 0 ? (
            <span
              className="px-1.5"
              style={{ fontSize: 15, lineHeight: '20px', color: 'var(--text-tertiary)' }}
            >
              {placeholder}
            </span>
          ) : (
            selectedMembers.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 t-caption"
                style={{
                  background: 'var(--surface-layered)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <MemberAvatar member={m} size={18} />
                {m.name}
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => remove(m.id, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') remove(m.id, e);
                  }}
                  className="flex h-4 w-4 items-center justify-center rounded-full"
                  style={{ color: 'var(--text-tertiary)', cursor: 'pointer' }}
                  aria-label={`${m.name} 제거`}
                >
                  <X size={12} strokeWidth={2} />
                </span>
              </span>
            ))
          )}
        </div>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          style={{
            color: 'var(--text-tertiary)',
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 200ms var(--ease-soft)',
          }}
        />
      </button>

      {open && panelStyle &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-multiselectable="true"
            className="z-[60] flex flex-col overflow-hidden rounded-xl"
            style={{
              ...panelStyle,
              background: 'var(--surface)',
              boxShadow: 'var(--elev-3)',
              border: '1px solid var(--border-subtle)',
              animation: 'dsSelectFade 200ms var(--ease-soft)',
            }}
          >
            {members.length === 0 ? (
              <div
                className="t-body2 px-4 py-5 text-center"
                style={{ color: 'var(--text-tertiary)' }}
              >
                등록된 멤버가 없습니다
              </div>
            ) : (
              <ul className="flex-1 overflow-auto py-1">
                {members.map((m) => {
                  const on = selectedIds.has(m.id);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={on}
                        onClick={() => toggle(m.id)}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left t-body2"
                        style={{
                          color: 'var(--text-primary)',
                          fontWeight: on ? 600 : 400,
                          background: 'transparent',
                          transition: 'background 160ms var(--ease-soft)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--surface-layered)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <Check
                          size={14}
                          strokeWidth={2.25}
                          style={{
                            color: on ? 'var(--accent-brand)' : 'transparent',
                            flexShrink: 0,
                          }}
                        />
                        <MemberAvatar member={m} size={22} />
                        <span className="flex-1 truncate">{m.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
