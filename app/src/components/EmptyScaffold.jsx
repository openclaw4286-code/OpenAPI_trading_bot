export default function EmptyScaffold({ title, subtitle, spec }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-5 py-16 text-center">
      <h2 className="t-title3">{title}</h2>
      <p className="t-body2" style={{ color: 'var(--text-secondary)' }}>
        {subtitle}
      </p>
      <span
        className="t-caption rounded-full px-2.5 py-0.5"
        style={{ background: 'var(--surface-sunken)', color: 'var(--text-tertiary)' }}
      >
        {spec}
      </span>
    </div>
  );
}
