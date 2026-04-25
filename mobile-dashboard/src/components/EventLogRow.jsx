// Single-line event-log entry. Kind badge controls color so the eye can
// scan the column for ENTRY (green) / LLM_REJECT (warning) / etc. without
// reading the text.

const KIND_LABEL = {
  ENTRY:      { text: 'ENTRY',     color: 'var(--state-positive)' },
  EXIT:       { text: 'EXIT',      color: 'var(--state-info)' },
  STOP_OUT:   { text: 'STOP-OUT',  color: 'var(--state-negative)' },
  LLM_REJECT: { text: 'LLM REJECT', color: 'var(--state-warning)' },
  CHART:      { text: 'CHART',     color: 'var(--text-secondary)' },
  UNIVERSE:   { text: 'UNIVERSE',  color: 'var(--text-secondary)' },
};

export default function EventLogRow({ event }) {
  const kind = KIND_LABEL[event.kind] ?? {
    text: event.kind,
    color: 'var(--text-secondary)',
  };
  return (
    <div className="flex items-center gap-2.5 py-2">
      <span
        className="t-caption num-mono w-12 shrink-0"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {event.ts}
      </span>
      <span
        className="t-caption shrink-0"
        style={{
          fontWeight: 600,
          color: kind.color,
          minWidth: 76,
        }}
      >
        {kind.text}
      </span>
      <span
        className="t-caption num-mono shrink-0"
        style={{ color: 'var(--text-primary)' }}
      >
        {event.symbol}
      </span>
      <span
        className="t-caption truncate"
        style={{ color: 'var(--text-secondary)' }}
      >
        {event.detail}
      </span>
    </div>
  );
}
