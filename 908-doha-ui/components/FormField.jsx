export default function FormField({ label, hint, tone, children }) {
  const hintColor =
    tone === 'negative' ? 'var(--state-negative)' : 'var(--text-tertiary)';
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="t-label" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
        {hint && (
          <span className="t-caption" style={{ color: hintColor }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </label>
  );
}
