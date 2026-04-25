import { useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

// Pill search field per docs/search-field.html — grey fill becomes
// white surface with a brand focus ring on focus-within; clearable.

export default function SearchField({
  value,
  onChange,
  placeholder = '검색',
  className = '',
  style,
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  return (
    <div
      className={`inline-flex h-11 items-center gap-2.5 rounded-[14px] px-3.5 ${className}`}
      style={{
        background: focused ? 'var(--surface)' : 'var(--surface-layered)',
        boxShadow: focused ? '0 0 0 1.5px var(--accent-brand)' : 'none',
        transition: 'background 200ms var(--ease-soft), box-shadow 160ms var(--ease-soft)',
        ...style,
      }}
    >
      <Search size={16} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)' }} />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="h-full w-full min-w-0 flex-1 bg-transparent outline-none"
        style={{
          fontSize: 15,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          aria-label="검색 지우기"
          className="flex h-[18px] w-[18px] items-center justify-center rounded-full"
          style={{ background: 'var(--border-strong)', color: '#FFFFFF' }}
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
