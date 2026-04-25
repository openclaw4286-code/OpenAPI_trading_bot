import { AlertTriangle } from 'lucide-react';
import ScreenHeader from '../components/ScreenHeader.jsx';
import NoteCard from '@ds/components/NoteCard.jsx';
import Sparkline from '../components/Sparkline.jsx';
import { formatPct, formatRMultiple, sentimentColor } from '../data/format.js';
import { MOCK_BACKTEST } from '../data/mock.js';
import { pricePath } from '../data/series.js';

// Read-only backtest summary. Per-symbol rows ride 908-doha-ui's
// NoteCard component with a synthesized note shape — title = symbol,
// snippet = stat line, tags = numeric badges, author = the synthetic
// BOT member injected by the AuthProvider stub. The portfolio hero
// stays bespoke because no design-system primitive carries a 6-stat
// grid.

function Stat({ label, value, color }) {
  return (
    <div>
      <div className="t-caption" style={{ color: 'var(--text-tertiary)' }}>
        {label}
      </div>
      <div
        className="num-mono mt-0.5"
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: color ?? 'var(--text-primary)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

// NoteCard expects { id, title, blocks, tags, pinned, updatedAt,
// createdBy }. We synthesise a "report note" per symbol so the card
// renders exactly like a real notes list entry.
function symbolToNote(row) {
  const blocks = [
    {
      id: `${row.symbol}-snip`,
      type: 'text',
      text: `${row.trades} trades · win ${(row.winRate * 100).toFixed(0)}% · avg ${formatRMultiple(row.avgR)}`,
    },
  ];
  const tags = [];
  if (row.avgR < 0) tags.push('UNDERPERFORM');
  tags.push(`${(row.winRate * 100).toFixed(0)}% win`);
  return {
    id: row.symbol,
    title: `${row.symbol}  ${row.name}`,
    blocks,
    tags,
    pinned: row.avgR > 0.3,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: 'bot',
    updatedBy: 'bot',
  };
}

export default function Backtest() {
  const { runAt, portfolio, perSymbol } = MOCK_BACKTEST;

  // Synthesize a portfolio equity curve from the total return; gives
  // the hero card the same visual weight as the home P&L hero.
  const equityCurve = pricePath('portfolio', 1.0, 1.0 + portfolio.totalReturn, 60);

  return (
    <>
      <ScreenHeader title="백테스트" />
      <div className="flex flex-col gap-3 p-4 pb-8">
        <section
          className="relative overflow-hidden rounded-2xl p-4"
          style={{
            background: `linear-gradient(135deg, var(--state-positive-soft) 0%, var(--surface) 70%)`,
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--elev-1)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-y-0 right-0"
            style={{ width: '55%', opacity: 0.85 }}
          >
            <Sparkline
              data={equityCurve}
              width={240}
              height={150}
              strokeWidth={2}
              color="var(--state-positive)"
              showDot
              className="h-full w-full"
            />
          </div>
          <div className="relative">
            <div className="flex items-center justify-between">
              <h3 className="t-heading2" style={{ fontWeight: 700 }}>
                포트폴리오
              </h3>
              <span
                className="t-caption num-mono"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {runAt}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Stat label="trades" value={portfolio.nTrades} />
              <Stat
                label="win rate"
                value={formatPct(portfolio.winRate, { digits: 0 })}
              />
              <Stat
                label="avg R"
                value={formatRMultiple(portfolio.avgR)}
                color={sentimentColor(portfolio.avgR)}
              />
              <Stat
                label="return"
                value={formatPct(portfolio.totalReturn, { sign: true, digits: 0 })}
                color={sentimentColor(portfolio.totalReturn)}
              />
              <Stat
                label="max DD"
                value={formatPct(portfolio.maxDrawdown, { sign: true, digits: 0 })}
                color={sentimentColor(portfolio.maxDrawdown)}
              />
              <Stat label="LLM rej" value={portfolio.llmRejected} />
            </div>
          </div>
        </section>

        <section>
          <h3
            className="t-caption mb-2 px-1"
            style={{
              color: 'var(--text-tertiary)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            종목별 시그널 품질
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {perSymbol.map((row) => (
              <div key={row.symbol} className="relative">
                <NoteCard note={symbolToNote(row)} onOpen={() => {}} />
                {row.avgR < 0 && (
                  <span
                    className="absolute right-3 top-3 inline-flex items-center gap-1 t-caption"
                    style={{ color: 'var(--state-warning)', fontWeight: 600 }}
                  >
                    <AlertTriangle size={12} strokeWidth={2.5} />
                    저조
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
