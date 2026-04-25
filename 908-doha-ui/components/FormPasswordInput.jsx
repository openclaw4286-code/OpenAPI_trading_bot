import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Password field with a reveal toggle. Matches docs/textfield.html
// sizing and focus behavior; paired with a trailing reveal button.

export default function FormPasswordInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  name,
  autoComplete,
  readOnly,
  trailing,
}) {
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);

  return (
    <div
      className="flex w-full items-center gap-1 rounded-md border pl-3.5 pr-1.5"
      style={{
        height: 44,
        background: 'var(--surface)',
        borderColor: focused ? 'var(--border-focus)' : 'var(--border-default)',
        boxShadow: focused ? '0 0 0 3px var(--accent-brand-soft)' : 'none',
        transition:
          'border-color 160ms var(--ease-soft), box-shadow 160ms var(--ease-soft)',
      }}
    >
      <input
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        name={name}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        readOnly={readOnly}
        className="min-w-0 flex-1 bg-transparent outline-none"
        style={{
          fontSize: 15,
          lineHeight: '20px',
          color: 'var(--text-primary)',
          fontFamily: shown && value ? 'var(--font-mono)' : 'var(--font-sans)',
        }}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{ color: 'var(--text-tertiary)' }}
        aria-label={shown ? '비밀번호 숨기기' : '비밀번호 보기'}
      >
        {shown ? (
          <EyeOff size={14} strokeWidth={1.75} />
        ) : (
          <Eye size={14} strokeWidth={1.75} />
        )}
      </button>
      {trailing}
    </div>
  );
}
