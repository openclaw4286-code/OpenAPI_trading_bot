import { formatAgo } from '../data/format.js';

// Compact status pill bar — Toss-style: a small bold chip on the left
// that doubles as the status word, secondary meta on the right. Single
// row so it stops competing with the P&L hero for vertical real
// estate. State color rendered as a chip FILL (not just a dot) so it
// reads at a glance.

const STATE_STYLE = {
  RUNNING: { color: 'var(--state-positive)', label: 'RUNNING', pulse: false },
  PAUSED:  { color: 'var(--state-warning)',  label: 'PAUSED',  pulse: false },
  ERROR:   { color: 'var(--state-negative)', label: 'ERROR',   pulse: true  },
  STOPPED: { color: 'var(--text-tertiary)',  label: 'STOPPED', pulse: false },
};

export default function BotStatusBanner({ status }) {
  const s = STATE_STYLE[status.state] ?? STATE_STYLE.STOPPED;
  return (
    <section
      className="flex items-center justify-between rounded-xl px-3 py-2"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="num-mono inline-flex items-center gap-1 rounded-full px-2.5 py-1"
          style={{
            background: s.color,
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: '0.04em',
            animation: s.pulse ? 'dsPulse 1.2s ease-in-out infinite' : 'none',
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: '#FFFFFF' }}
          />
          {s.label}
        </span>
        <span
          className="t-caption num-mono"
          style={{ color: 'var(--text-secondary)', fontWeight: 600 }}
        >
          {status.env.toUpperCase()} · {status.testMode ? 'TEST' : 'LIVE'}
        </span>
      </div>
      <span
        className="t-caption num-mono"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {formatAgo(status.lastTickTs)} · {status.sessionOpen}–{status.sessionClose}
      </span>
    </section>
  );
}
