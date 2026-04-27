import { AlertTriangle, Check, Info, X } from 'lucide-react';

const TONE_DOT = {
  success: 'var(--state-positive)',
  error: 'var(--state-negative)',
  warning: 'var(--state-warning)',
  info: 'var(--accent-brand)',
  neutral: 'var(--text-secondary)',
};

const TONE_ICON = {
  success: Check,
  error: X,
  warning: AlertTriangle,
  info: Info,
  neutral: null,
};

export default function Toast({ tone = 'success', message, leaving = false, onDismiss }) {
  const Icon = TONE_ICON[tone];
  return (
    <div
      role="status"
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      onClick={onDismiss}
      className="pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-full border pl-2.5 pr-4 py-2.5 t-label"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--text-primary)',
        boxShadow: '0 10px 28px rgba(15,20,30,.14), 0 1px 3px rgba(15,20,30,.08)',
        animation: leaving
          ? 'dsToastOut 280ms var(--ease-soft) forwards'
          : 'dsToastIn 340ms var(--ease-spring) forwards',
        cursor: onDismiss ? 'pointer' : 'default',
      }}
    >
      {Icon && (
        <span
          aria-hidden="true"
          className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
          style={{ background: TONE_DOT[tone], color: '#FFFFFF' }}
        >
          <Icon size={11} strokeWidth={3} />
        </span>
      )}
      <span className="truncate">{message}</span>
    </div>
  );
}
