import { AlertTriangle } from 'lucide-react';
import ScreenHeader from '../components/ScreenHeader.jsx';
import { formatPct, formatRMultiple, sentimentColor } from '../data/format.js';
import { MOCK_BACKTEST } from '../data/mock.js';

// Read-only backtest summary. The actual run trigger lives in the
// Python CLI (`backtest.runner.backtest_portfolio`) — this view only
// surfaces the most recent persisted result.

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
          fontWeight: 600,
          color: color ?? 'var(--text-primary)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function Backtest() {
  const { runAt, portfolio, perSymbol } = MOCK_BACKTEST;
  return (
    <>
      <ScreenHeader title="백테스트" />
      <div className="flex flex-col gap-3 p-4 pb-8">
        <section
          className="rounded-2xl p-4"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="t-heading2" style={{ fontWeight: 600 }}>
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
        </section>

        <section
          className="rounded-2xl p-4"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <h3 className="t-heading2 mb-2" style={{ fontWeight: 600 }}>
            종목별 시그널 품질
          </h3>
          <ul className="flex flex-col">
            {perSymbol.map((row) => {
              const warn = row.avgR < 0;
              return (
                <li
                  key={row.symbol}
                  className="flex items-center gap-2 border-t py-2.5"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <span
                    className="t-label num-mono shrink-0"
                    style={{ fontWeight: 600, width: 60 }}
                  >
                    {row.symbol}
                  </span>
                  <span
                    className="t-body2 flex-1 truncate"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {row.name}
                  </span>
                  <span
                    className="t-caption num-mono"
                    style={{ color: 'var(--text-tertiary)', width: 56 }}
                  >
                    {row.trades} trd
                  </span>
                  <span
                    className="t-caption num-mono"
                    style={{ color: 'var(--text-tertiary)', width: 48 }}
                  >
                    {(row.winRate * 100).toFixed(0)}%
                  </span>
                  <span
                    className="t-label num-mono"
                    style={{
                      fontWeight: 600,
                      color: sentimentColor(row.avgR),
                      width: 64,
                      textAlign: 'right',
                    }}
                  >
                    {formatRMultiple(row.avgR)}
                  </span>
                  {warn && (
                    <AlertTriangle
                      size={14}
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
