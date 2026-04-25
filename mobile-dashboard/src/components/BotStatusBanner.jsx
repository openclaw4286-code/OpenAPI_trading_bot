import { formatAgo } from '../data/format.js';

// Read-only status display. Surfaces the bot lifecycle state
// (RUNNING / PAUSED / ERROR / STOPPED) + last tick. No actions —
// control plane lives elsewhere (CLI / Slack). Color is fully
// token-driven so dark mode flips for free if/when enabled.

const STATE_STYLE = {
  RUNNING: {
    dot: 'var(--state-positive)',
    label: 'RUNNING',
    bg: 'var(--state-positive-soft)',
    pulse: false,
  },
  PAUSED: {
    dot: 'var(--state-warning)',
    label: 'PAUSED',
    bg: 'var(--state-warning-soft)',
    pulse: false,
  },
  ERROR: {
    dot: 'var(--state-negative)',
    label: 'ERROR',
    bg: 'var(--state-negative-soft)',
    pulse: true,
  },
  STOPPED: {
    dot: 'var(--text-tertiary)',
    label: 'STOPPED',
    bg: 'var(--surface-layered)',
    pulse: false,
  },
};

export default function BotStatusBanner({ status }) {
  const s = STATE_STYLE[status.state] ?? STATE_STYLE.STOPPED;
  return (
    <section
      className="rounded-2xl p-4"
      style={{ background: s.bg, border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{
            background: s.dot,
            animation: s.pulse ? 'dsPulse 1.2s ease-in-out infinite' : 'none',
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="t-label" style={{ fontWeight: 700 }}>
              {s.label}
            </span>
            <span
              className="t-caption"
              style={{ color: 'var(--text-tertiary)' }}
            >
              · {status.env} · {status.testMode ? 'TEST_MODE' : 'LIVE'}
            </span>
          </div>
          <div
            className="t-caption num-mono"
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
