import { TrendingUp, TrendingDown } from 'lucide-react';
import Sparkline from './Sparkline.jsx';
import { formatKrw, formatPct, sentimentColor } from '../data/format.js';
import { equityCurve } from '../data/series.js';

/**
 * Headline P&L card. Uses the design-system display token (40 px /
 * 700) for the realized number — biggest type on the screen, so the
 * eye lands here first. Right-side trend chip + bottom-edge
 * full-width sparkline carry the "today's path" story without
 * fighting the type. Light card surface; sentiment colour escapes
 * only via the number, the chip, and the sparkline stroke.
 */
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
    72,
  );

  return (
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
            className="t-caption"
            style={{
              color: 'var(--text-tertiary)',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            오늘 실현 손익
          </span>
          <span
            className="num-mono inline-flex items-center gap-1 rounded-full px-2.5 py-1"
            style={{
              background: realizedSoft,
              color: realizedColor,
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: '-0.005em',
            }}
          >
            <Trend size={12} strokeWidth={2.5} />
            {formatPct(pnl.realizedPct, { sign: true })}
          </span>
        </div>

        <div
          className="num-mono mt-2"
          style={{
            fontSize: 40,
            lineHeight: '48px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.025em',
          }}
        >
          {formatKrw(pnl.realizedKrw, { sign: true })}
        </div>

        <div
          className="mt-4 grid grid-cols-2 gap-3 border-t pt-3"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div>
            <div
              className="t-caption"
              style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}
            >
              미실현
            </div>
            <div
              className="num-mono mt-0.5"
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: sentimentColor(pnl.unrealizedKrw),
                letterSpacing: '-0.01em',
              }}
            >
              {formatKrw(pnl.unrealizedKrw, { sign: true })}
            </div>
          </div>
          <div className="text-right">
            <div
              className="t-caption"
              style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}
            >
              총 노출
            </div>
            <div
              className="num-mono mt-0.5"
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
              }}
            >
              {formatPct(pnl.exposurePct, { digits: 1 })}
            </div>
          </div>
        </div>
      </div>

      <div className="-mb-1 h-14 w-full">
        <Sparkline
          data={curve}
          width={400}
          height={56}
          strokeWidth={2}
          color={realizedColor}
          fill
          showDot
          className="h-full w-full"
        />
      </div>
    </section>
  );
}
