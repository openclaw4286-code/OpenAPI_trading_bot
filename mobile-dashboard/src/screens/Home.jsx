import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Clock } from 'lucide-react';
import ScreenHeader from '../components/ScreenHeader.jsx';
import BotStatusBanner from '../components/BotStatusBanner.jsx';
import PnLHero from '../components/PnLHero.jsx';
import PositionMiniCard from '../components/PositionMiniCard.jsx';
import EventLogRow from '../components/EventLogRow.jsx';
import PipelineFunnel from '../components/PipelineFunnel.jsx';
import KillModal from '../components/KillModal.jsx';
import {
  MOCK_BOT_STATUS,
  MOCK_PNL,
  MOCK_POSITIONS,
  MOCK_RECENT_EVENTS,
  MOCK_PIPELINE,
} from '../data/mock.js';

// Home screen — at-a-glance dashboard. Order matters: status → P&L →
// positions → events → pipeline → shortcuts. Operator should be able to
// answer "is it OK?" within 5 seconds of opening the app.

const SHORTCUTS = [
  { to: '/backtest',                   label: '신호 품질' },
  { to: '/positions',                  label: '포지션 전체' },
  { to: '/signals',                    label: '오늘 신호' },
];

function nowKstClock() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')} KST`;
}

export default function Home() {
  const [killOpen, setKillOpen] = useState(false);
  const [status, setStatus] = useState(MOCK_BOT_STATUS);

  return (
    <>
      <ScreenHeader
        title="ICT Trader"
        trailing={
          <span
            className="t-caption num-mono flex items-center gap-1 px-2"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Clock size={13} strokeWidth={1.75} />
            {nowKstClock()}
          </span>
        }
      />
      <div className="flex flex-col gap-3 p-4 pb-8">
        <BotStatusBanner
          status={status}
          onPause={() => setStatus({ ...status, state: 'PAUSED' })}
          onResume={() => setStatus({ ...status, state: 'RUNNING' })}
          onKill={() => setKillOpen(true)}
        />

        <PnLHero pnl={MOCK_PNL} />

        <section className="mt-1">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="t-heading2" style={{ fontWeight: 600 }}>
              열린 포지션{' '}
              <span style={{ color: 'var(--text-tertiary)' }}>
                {MOCK_POSITIONS.length}
              </span>
            </h3>
            <Link
              to="/positions"
              className="t-caption flex items-center gap-0.5"
              style={{ color: 'var(--text-link)', textDecoration: 'none' }}
            >
              모두 보기
              <ChevronRight size={13} strokeWidth={1.75} />
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {MOCK_POSITIONS.slice(0, 2).map((p) => (
              <PositionMiniCard key={p.symbol} position={p} />
            ))}
          </div>
        </section>

        <section
          className="rounded-2xl p-4"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="mb-1 flex items-center justify-between">
            <h3 className="t-heading2" style={{ fontWeight: 600 }}>
              최근 이벤트
            </h3>
            <Link
              to="/signals"
              className="t-caption"
              style={{ color: 'var(--text-link)', textDecoration: 'none' }}
            >
              전체 →
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {MOCK_RECENT_EVENTS.slice(0, 5).map((ev, i) => (
              <EventLogRow key={i} event={ev} />
            ))}
          </div>
        </section>

        <PipelineFunnel pipeline={MOCK_PIPELINE} />

        <section>
          <h3
            className="t-caption mb-2 px-1"
            style={{
              color: 'var(--text-tertiary)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            바로가기
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {SHORTCUTS.map((sc) => (
              <Link
                key={sc.to}
                to={sc.to}
                className="t-label flex h-12 items-center justify-center rounded-xl"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                {sc.label}
              </Link>
            ))}
          </div>
        </section>
      </div>

      <KillModal
        open={killOpen}
        onClose={() => setKillOpen(false)}
        onConfirm={() => {
          setStatus({ ...status, state: 'STOPPED' });
          setKillOpen(false);
        }}
      />
    </>
  );
}
