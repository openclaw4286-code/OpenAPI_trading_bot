import { TrendingUp, TrendingDown } from 'lucide-react';
import Sparkline from './Sparkline.jsx';
import { formatKrw, formatPct, sentimentColor } from '../data/format.js';
import { equityCurve } from '../data/series.js';

// Hero card: the headline number for the day. Now anchored by an
// embedded equity-curve sparkline that fills the right half so the
// card has actual visual weight rather than reading as a quote slip.
// Background uses the soft tone of the realized-P&L colour to
// reinforce sentiment at a glance.

export default function PnLHero({ pnl }) {
  const realizedColor = sentimentColor(pnl.realizedKrw);
  const realizedSoft =
    pnl.realizedKrw >= 0
      ? 'var(--state-positive-soft)'
      : 'var(--state-negative-soft)';
  const Trend = pnl.realizedKrw >= 0 ? TrendingUp : TrendingDown;

  const curve = equityCurve(
    pnl.startEquityKrw,
    pnl.startEquityKrw + pnl.realizedKrw + pnl.unrealizedKrw,
    60,
  );

  return (
    <section
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: `linear-gradient(135deg, ${realizedSoft} 0%, var(--surface) 70%)`,
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--elev-1)',
      }}
    >
      {/* Sparkline fills the card behind the numbers */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0"
        style={{ width: '60%', opacity: 0.9 }}
      >
        <Sparkline
          data={curve}
          width={260}
          height={170}
          strokeWidth={2.25}
          color={realizedColor}
          showDot
          className="h-full w-full"
        />
      </div>

      <div className="relative p-5">
        <div className="flex items-center gap-1.5">
          <span
            className="t-caption"
            style={{
              color: 'var(--text-tertiary)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            오늘 실현
          </span>
          <Trend
            size={13}
            strokeWidth={2}
            style={{ color: realizedColor }}
          />
        </div>

        <div
          className="num-mono mt-1.5"
          style={{
            fontSize: 36,
            lineHeight: '44px',
            fontWeight: 800,
            color: realizedColor,
            letterSpacing: '-0.02em',
          }}
        >
          {formatKrw(pnl.realizedKrw, { sign: true })}
        </div>
        <div
          className="num-mono mt-0.5 t-label"
          style={{ color: realizedColor, fontWeight: 600 }}
        >
          {formatPct(pnl.realizedPct, { sign: true })}
        </div>

        <div
          className="mt-5 flex items-end justify-between gap-3 rounded-xl p-3"
          style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(4px)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div className="t-caption" style={{ color: 'var(--text-tertiary)' }}>
              미실현
            </div>
            <div
              className="num-mono t-heading2"
              style={{
                color: sentimentColor(pnl.unrealizedKrw),
                fontWeight: 700,
              }}
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
              style={{ color: 'var(--text-primary)', fontWeight: 700 }}
            >
              {formatPct(pnl.exposurePct, { digits: 1 })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
