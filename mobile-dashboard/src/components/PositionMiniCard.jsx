import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  formatPrice,
  formatRMultiple,
  sentimentColor,
} from '../data/format.js';

// Compact card for the home-screen position list. Left border encodes
// the trade direction × R-multiple sentiment (green up, red down). Tap
// routes to the full detail screen.

export default function PositionMiniCard({ position }) {
  const dirColor = sentimentColor(position.rMultiple);
  const Arrow = position.rMultiple >= 0 ? ArrowUpRight : ArrowDownRight;

  const tpProgress = (() => {
    if (position.tp3Done) return 'TP3 ✓';
    if (position.tp2Done) return 'TP2 ✓';
    if (position.tp1Done) return 'TP1 ✓ · stop BE';
    return `pending TP1`;
  })();

  return (
    <Link
      to={`/positions/${position.symbol}`}
      className="block rounded-2xl p-4"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderLeft: `4px solid ${dirColor}`,
        textDecoration: 'none',
        color: 'inherit',
        transition: 'background var(--dur-fast) var(--ease-soft)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="t-heading2 num-mono" style={{ fontWeight: 600 }}>
            {position.symbol}
          </span>
          <span
            className="t-body2 truncate"
            style={{ color: 'var(--text-secondary)' }}
          >
            {position.name}
          </span>
        </div>
        <div className="flex items-center gap-1" style={{ color: dirColor }}>
          <span className="num-mono t-label" style={{ fontWeight: 600 }}>
            {formatRMultiple(position.rMultiple)}
          </span>
          <Arrow size={16} strokeWidth={2} />
        </div>
      </div>
      <div
        className="num-mono mt-2 t-caption"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {formatPrice(position.currentPrice)} / {position.remainingQty}주 · {tpProgress}
      </div>
    </Link>
  );
}
