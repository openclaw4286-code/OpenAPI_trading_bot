import { AlertTriangle, TrendingUp, FlaskConical } from 'lucide-react';
import ScreenHeader from '../components/ScreenHeader.jsx';
import Sparkline from '../components/Sparkline.jsx';
import {
  formatPct,
  formatRMultiple,
  sentimentColor,
} from '../data/format.js';
import { MOCK_BACKTEST } from '../data/mock.js';
import { pricePath } from '../data/series.js';

/**
 * Backtest summary. Hero card carries the portfolio result with an
 * equity sparkline anchoring the bottom edge (same pattern as the
 * P&L hero on Home, so the visual grammar stays consistent). Below
 * it: a compact per-symbol grid where each row's avg-R is the
 * dominant signal and underperformers earn a warning glyph.
 */

function Stat({ label, value, color }) {
  return (
    <div>
      <div
        className="t-caption"
        style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}
      >
        {label}
      </div>
      <div
        className="num-mono mt-0.5"
        style={{
          fontSize: 17,
          fontWeight: 800,
          color: color ?? 'var(--text-primary)',
          letterSpacing: '-0.015em',
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function Backtest() {
  const { runAt, portfolio, perSymbol } = MOCK_BACKTEST;
  const equityCurveData = pricePath('portfolio', 1.0, 1.0 + portfolio.totalReturn, 80);
  const totalColor = sentimentColor(portfolio.totalReturn);

  return (
    <>
      <ScreenHeader title="백테스트" />
      <div className="flex flex-col gap-4 p-4 pb-8">
        <section
          className="overflow-hidden rounded-2xl"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--elev-2)',
          }}
        >
          <div className="px-5 pt-5 pb-2">
            <div className="flex items-center justify-between">
              <span
                className="t-caption inline-flex items-center gap-1.5"
                style={{
                  color: 'var(--text-tertiary)',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                <FlaskConical size={12} strokeWidth={2.5} />
                포트폴리오
              </span>
              <span
                className="num-mono inline-flex items-center gap-1 rounded-full px-2.5 py-1"
                style={{
                  background:
                    portfolio.totalReturn >= 0
                      ? 'var(--state-positive-soft)'
                      : 'var(--state-negative-soft)',
                  color: totalColor,
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                <TrendingUp size={12} strokeWidth={2.5} />
                {formatPct(portfolio.totalReturn, { sign: true, digits: 1 })}
              </span>
            </div>
            <div className="mt-1 t-caption num-mono" style={{ color: 'var(--text-tertiary)' }}>
              {runAt}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
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
                label="max DD"
                value={formatPct(portfolio.maxDrawdown, { sign: true, digits: 0 })}
                color={sentimentColor(portfolio.maxDrawdown)}
              />
              <Stat label="LLM rej" value={portfolio.llmRejected} />
              <Stat label="skip" value={portfolio.skippedNoRoom} />
            </div>
          </div>
          <div className="-mb-1 h-12 w-full">
            <Sparkline
              data={equityCurveData}
              width={400}
              height={48}
              strokeWidth={2}
              color={totalColor}
              fill
              showDot
              className="h-full w-full"
            />
          </div>
        </section>

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
            종목별 시그널 품질
          </h3>
          <ul className="flex flex-col gap-2">
            {perSymbol.map((row) => {
              const warn = row.avgR < 0;
              const rColor = sentimentColor(row.avgR);
              return (
                <li
                  key={row.symbol}
                  className="flex items-center gap-3 rounded-2xl p-4"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: 'var(--elev-1)',
                  }}
                >
                  <div
                    className="flex shrink-0 items-center justify-center rounded-xl"
                    style={{
                      width: 40,
                      height: 40,
                      background: warn
                        ? 'var(--state-warning-soft)'
                        : 'var(--accent-brand-soft)',
                      color: warn
                        ? 'var(--state-warning)'
                        : 'var(--accent-brand)',
                      fontWeight: 800,
                      fontSize: 16,
                    }}
                  >
                    {row.name.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="t-body2"
                        style={{ fontWeight: 700, color: 'var(--text-primary)' }}
                      >
                        {row.name}
                      </span>
                      <span
                        className="num-mono t-caption"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {row.symbol}
                      </span>
                    </div>
                    <div
                      className="mt-0.5 num-mono t-caption"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {row.trades} trades · {(row.winRate * 100).toFixed(0)}% win
                    </div>
                  </div>
                  <span
                    className="num-mono inline-flex items-center justify-center rounded-lg"
                    style={{
                      minWidth: 64,
                      padding: '4px 10px',
                      background:
                        row.avgR >= 0
                          ? 'var(--state-positive-soft)'
                          : 'var(--state-negative-soft)',
                      color: rColor,
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                  >
                    {formatRMultiple(row.avgR)}
                  </span>
                  {warn && (
                    <AlertTriangle
                      size={16}
                      strokeWidth={2}
                      style={{ color: 'var(--state-warning)' }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
