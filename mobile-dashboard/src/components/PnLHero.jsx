import { formatKrw, formatPct, sentimentColor } from '../data/format.js';

// Big number card: today's realized P&L is the headline; unrealized and
// exposure are smaller meta. Mono numerals so the digit-width never
// twitches when the price feed updates.

export default function PnLHero({ pnl }) {
  const realizedColor = sentimentColor(pnl.realizedKrw);
  const unrealizedColor = sentimentColor(pnl.unrealizedKrw);

  return (
    <section
      className="rounded-2xl p-5"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div
        className="t-caption"
        style={{ color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}
      >
        오늘 실현
      </div>
      <div
        className="num-mono mt-1"
        style={{
          fontSize: 32,
          lineHeight: '40px',
          fontWeight: 700,
          color: realizedColor,
          letterSpacing: '-0.015em',
        }}
      >
        {formatKrw(pnl.realizedKrw, { sign: true })}
      </div>
      <div
        className="num-mono t-label"
        style={{ color: realizedColor, marginTop: 2 }}
      >
        {formatPct(pnl.realizedPct, { sign: true })}
      </div>

      <hr className="my-3.5" style={{ borderColor: 'var(--border-subtle)' }} />

      <div className="flex items-center justify-between">
        <div>
          <div className="t-caption" style={{ color: 'var(--text-tertiary)' }}>
            미실현
          </div>
          <div
            className="num-mono t-heading2"
            style={{ color: unrealizedColor, fontWeight: 600 }}
          >
            {formatKrw(pnl.unrealizedKrw, { sign: true })}
          </div>
        </div>
        <div className="text-right">
          <div className="t-caption" style={{ color: 'var(--text-tertiary)' }}>
            노출
          </div>
          <div
            className="num-mono t-heading2"
            style={{ color: 'var(--text-primary)', fontWeight: 600 }}
          >
            {formatPct(pnl.exposurePct, { digits: 1 })}
          </div>
        </div>
      </div>
    </section>
  );
}
