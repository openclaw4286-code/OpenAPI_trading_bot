import MemberAvatar from '@ds/components/MemberAvatar.jsx';
import { formatAgo } from '../data/format.js';

// Read-only status header. Anchors the home screen with three visual
// layers: (1) a 4px state-coloured rail on the left, (2) a real
// 908-doha-ui MemberAvatar carrying a synthesized "BOT" identity
// (matches the avatar style used everywhere else in the design
// system), and (3) a state pill that doubles as the status word.

const STATE_STYLE = {
  RUNNING: { color: 'var(--state-positive)', label: 'RUNNING', pulse: false },
  PAUSED:  { color: 'var(--state-warning)',  label: 'PAUSED',  pulse: false },
  ERROR:   { color: 'var(--state-negative)', label: 'ERROR',   pulse: true  },
  STOPPED: { color: 'var(--text-tertiary)',  label: 'STOPPED', pulse: false },
};

export default function BotStatusBanner({ status }) {
  const s = STATE_STYLE[status.state] ?? STATE_STYLE.STOPPED;
  // Construct the BOT member inline with the state colour so the avatar
  // tells the same story as the rail and pill.
  const botMember = { id: 'bot', name: 'BOT', color: s.color };

  return (
    <section
      className="rounded-2xl p-4"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderLeft: `4px solid ${s.color}`,
        boxShadow: 'var(--elev-1)',
      }}
    >
      <div className="flex items-center gap-3">
        <MemberAvatar member={botMember} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="t-label rounded-full px-2 py-0.5 num-mono"
              style={{
                background: `${s.color}1A`,
                color: s.color,
                fontWeight: 700,
                letterSpacing: '0.04em',
                animation: s.pulse ? 'dsPulse 1.2s ease-in-out infinite' : 'none',
              }}
            >
              {s.label}
            </span>
            <span
              className="t-caption num-mono"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {status.env.toUpperCase()} · {status.testMode ? 'TEST' : 'LIVE'}
            </span>
          </div>
          <div
            className="num-mono mt-1 t-caption"
            style={{ color: 'var(--text-secondary)' }}
          >
            last tick {formatAgo(status.lastTickTs)} · 세션{' '}
            {status.sessionOpen}–{status.sessionClose}
          </div>
        </div>
      </div>
    </section>
  );
}
