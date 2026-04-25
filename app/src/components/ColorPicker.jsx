import { Check } from 'lucide-react';
import { MEMBER_COLORS } from '../lib/members.js';

export default function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {MEMBER_COLORS.map((c) => {
        const on = value === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className="flex items-center justify-center rounded-full"
            style={{
              width: 32,
              height: 32,
              background: c,
              outline: on ? '2px solid var(--border-focus)' : '2px solid transparent',
              outlineOffset: 2,
              color: '#FFFFFF',
              transition: 'outline-color 160ms var(--ease-soft)',
            }}
            aria-label={c}
            aria-pressed={on}
          >
            {on && <Check size={14} strokeWidth={2.5} />}
          </button>
        );
      })}
    </div>
  );
}
