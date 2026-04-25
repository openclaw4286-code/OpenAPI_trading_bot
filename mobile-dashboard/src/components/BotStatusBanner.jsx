import { formatAgo } from '../data/format.js';

// Read-only status display. White surface with a thick left accent
// stripe + prominent dot — the previous all-soft-tinted card almost
// vanished against the page background. Now the state colour anchors
// the eye in two places (stripe + dot) without flooding the row.

const STATE_STYLE = {
  RUNNING: {
    color: 'var(--state-positive)',
    label: 'RUNNING',
    pulse: false,
  },
  PAUSED: {
    color: 'var(--state-warning)',
    label: 'PAUSED',
    pulse: false,
  },
  ERROR: {
    color: 'var(--state-negative)',
    label: 'ERROR',
    pulse: true,
  },
  STOPPED: {
    color: 'var(--text-tertiary)',
    label: 'STOPPED',
    pulse: false,
  },
};

export default function BotStatusBanner({ status }) {
  const s = STATE_STYLE[status.state] ?? STATE_STYLE.STOPPED;
  return (
    <section
      className="rounded-2xl p-4"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderLeft: `4px solid ${s.color}`,
      }}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="h-3 w-3 shrink-0 rounded-full"
          style={{
            background: s.color,
            boxShadow: `0 0 0 4px ${s.color}22`,
            animation: s.pulse ? 'dsPulse 1.2s ease-in-out infinite' : 'none',
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span
              className="t-label"
              style={{
                fontWeight: 700,
                color: s.color,
                letterSpacing: '0.02em',
              }}
            >
              {s.label}
            </span>
            <span
              className="t-caption"
              style={{ color: 'var(--text-secondary)' }}
            >
              · {status.env.toUpperCase()} ·{' '}
              {status.testMode ? 'TEST_MODE' : 'LIVE'}
            </span>
          </div>
          <div
            className="num-mono t-caption"
            style={{ color: 'var(--text-tertiary)' }}
          >
            last tick {formatAgo(status.lastTickTs)} · 세션{' '}
            {status.sessionOpen}–{status.sessionClose}
          </div>
        </div>
      </div>
    </section>
  );
}
