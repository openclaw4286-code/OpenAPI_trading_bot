import { Link } from 'react-router-dom';
import { Clock, Activity, Bell, Sparkles } from 'lucide-react';
import ScreenHeader from '../components/ScreenHeader.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import BotStatusBanner from '../components/BotStatusBanner.jsx';
import PnLHero from '../components/PnLHero.jsx';
import PositionMiniCard from '../components/PositionMiniCard.jsx';
import EventLogRow from '../components/EventLogRow.jsx';
import PipelineFunnel from '../components/PipelineFunnel.jsx';
import {
  MOCK_BOT_STATUS,
  MOCK_PNL,
  MOCK_POSITIONS,
  MOCK_RECENT_EVENTS,
  MOCK_PIPELINE,
} from '../data/mock.js';

/**
 * Home — at-a-glance dashboard. Information ladder:
 *   1. Status (is the bot OK?)
 *   2. P&L hero (how am I doing today?)
 *   3. Open positions (what's working?)
 *   4. Recent events (what just happened?)
 *   5. Pipeline funnel (where is the bot stuck?)
 *
 * Each section has a SectionHeader with a leading icon + count chip
 * + trailing "모두 보기" link for consistent vertical rhythm.
 */
const SHORTCUTS = [
  { to: '/positions',  label: '포지션', icon: Activity },
  { to: '/signals',    label: '신호',   icon: Bell },
  { to: '/backtest',   label: '백테',   icon: Sparkles },
];

function nowKstClock() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')} KST`;
}

export default function Home() {
  return (
    <>
      <ScreenHeader
        title="ICT Trader"
        trailing={
          <span
            className="t-caption num-mono inline-flex items-center gap-1 px-2"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Clock size={13} strokeWidth={1.75} />
            {nowKstClock()}
          </span>
        }
      />
      <div className="flex flex-col gap-4 p-4 pb-8">
        <BotStatusBanner status={MOCK_BOT_STATUS} />

        <PnLHero pnl={MOCK_PNL} />

        <section className="flex flex-col gap-2">
          <SectionHeader
            title="열린 포지션"
            count={MOCK_POSITIONS.length}
            icon={Activity}
            actionTo="/positions"
          />
          {MOCK_POSITIONS.slice(0, 2).map((p) => (
            <PositionMiniCard key={p.symbol} position={p} />
          ))}
        </section>

        <section className="flex flex-col gap-2">
          <SectionHeader
            title="최근 이벤트"
            icon={Bell}
            actionTo="/signals"
            actionLabel="전체"
          />
          {MOCK_RECENT_EVENTS.slice(0, 5).map((ev, i) => (
            <EventLogRow key={i} event={ev} />
          ))}
        </section>

        <PipelineFunnel pipeline={MOCK_PIPELINE} />

        <section className="flex flex-col gap-2">
          <h3
            className="t-caption px-1"
            style={{
              color: 'var(--text-tertiary)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            바로가기
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {SHORTCUTS.map((sc) => {
              const Icon = sc.icon;
              return (
                <Link
                  key={sc.to}
                  to={sc.to}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-2xl py-4"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                    boxShadow: 'var(--elev-1)',
                    transition: 'box-shadow 200ms cubic-bezier(0.32, 0.72, 0, 1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = 'var(--elev-2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'var(--elev-1)';
                  }}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{
                      background: 'var(--accent-brand-soft)',
                      color: 'var(--accent-brand)',
                    }}
                  >
                    <Icon size={16} strokeWidth={2} />
                  </span>
                  <span
                    className="t-caption"
                    style={{ fontWeight: 600, fontSize: 12 }}
                  >
                    {sc.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
