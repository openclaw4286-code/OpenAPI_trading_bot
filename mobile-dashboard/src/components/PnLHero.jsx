import { TrendingUp, TrendingDown } from 'lucide-react';
import Sparkline from './Sparkline.jsx';
import { formatKrw, formatPct, sentimentColor } from '../data/format.js';
import { equityCurve } from '../data/series.js';

// Hero card built for Toss-style visual weight: huge headline number
// (48px / 800), colored percentage chip, dense secondary stats row,
// and a slim full-width sparkline at the bottom that gives the card a
// real visual story without washing the type out behind a gradient.

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
      className="overflow-hidden rounded-2xl"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--elev-1)',
      }}
    >
      <div className="px-5 pt-5">
        <div className="flex items-center justify-between">
          <span
            className="t-label"
            style={{
              color: 'var(--text-secondary)',
              fontWeight: 600,
            }}
          >
            오늘 실현 손익
          </span>
          <span
            className="num-mono inline-flex items-center gap-1 rounded-full px-2 py-0.5 t-caption"
            style={{
              background: realizedSoft,
              color: realizedColor,
              fontWeight: 700,
            }}
          >
            <Trend size={11} strokeWidth={2.5} />
            {formatPct(pnl.realizedPct, { sign: true })}
          </span>
        </div>

        <div
          className="num-mono mt-2"
          style={{
            fontSize: 44,
            lineHeight: '52px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.025em',
          }}
        >
          {formatKrw(pnl.realizedKrw, { sign: true })}
        </div>

        <div
          className="mt-4 grid grid-cols-2 gap-3 border-t pt-4"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div>
            <div className="t-caption" style={{ color: 'var(--text-tertiary)' }}>
              미실현
            </div>
            <div
              className="num-mono mt-0.5"
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: sentimentColor(pnl.unrealizedKrw),
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
              className="num-mono mt-0.5"
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              {formatPct(pnl.exposurePct, { digits: 1 })}
            </div>
          </div>
        </div>
      </div>

      <div className="-mb-1 h-12 w-full">
        <Sparkline
          data={curve}
          width={400}
          height={48}
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
