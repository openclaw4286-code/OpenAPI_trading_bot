import { Pause, Play, OctagonX } from 'lucide-react';
import IconButton from '@ds/components/IconButton.jsx';
import Button from '@ds/components/Button.jsx';
import { formatAgo } from '../data/format.js';

// Banner that anchors the home screen — surfaces the bot lifecycle state
// (RUNNING / PAUSED / ERROR / STOPPED) plus the operator's two emergency
// controls. Color fully driven by tokens so dark mode flips for free.

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

export default function BotStatusBanner({ status, onPause, onResume, onKill }) {
  const s = STATE_STYLE[status.state] ?? STATE_STYLE.STOPPED;
  const isRunning = status.state === 'RUNNING';

  return (
    <section
      className="rounded-2xl p-4"
      style={{ background: s.bg, border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{
              background: s.dot,
              animation: s.pulse ? 'dsPulse 1.2s ease-in-out infinite' : 'none',
            }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="t-label" style={{ fontWeight: 600 }}>{s.label}</span>
              <span className="t-caption" style={{ color: 'var(--text-tertiary)' }}>
                · {status.env} · {status.testMode ? 'TEST_MODE' : 'LIVE'}
              </span>
            </div>
            <div
              className="t-caption num-mono"
              style={{ color: 'var(--text-tertiary)' }}
            >
              last tick {formatAgo(status.lastTickTs)}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isRunning ? (
            <IconButton
              icon={Pause}
              variant="border"
              size="md"
              ariaLabel="일시정지"
              onClick={onPause}
            />
          ) : (
            <IconButton
              icon={Play}
              variant="brand"
              size="md"
              ariaLabel="재개"
              onClick={onResume}
            />
          )}
          <Button
            variant="danger"
            size="md"
            icon={OctagonX}
            onClick={onKill}
          >
            KILL
          </Button>
        </div>
      </div>
    </section>
  );
}
