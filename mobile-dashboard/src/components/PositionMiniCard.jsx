import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  formatPrice,
  formatRMultiple,
  sentimentColor,
} from '../data/format.js';

// Position list row. Visual pattern lifted from 908-doha-ui VaultEntry
// (square accent leading badge + title + subtitle + trailing meta), but
// adapted for read-only navigation: the entire card is a single Link,
// trailing slot shows the R-multiple and direction arrow rather than
// hover-revealed action buttons.

export default function PositionMiniCard({ position }) {
  const dirColor = sentimentColor(position.rMultiple);
  const Arrow = position.rMultiple >= 0 ? ArrowUpRight : ArrowDownRight;
  const subtitle = `${formatPrice(position.currentPrice)} · ${
    position.remainingQty
  }/${position.initialQty}주 · ${tpProgress(position)}`;

  return (
    <Link
      to={`/positions/${position.symbol}`}
      className="flex items-center gap-3 rounded-xl border p-3"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border-subtle)',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'background var(--dur-fast) var(--ease-soft)',
      }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl num-mono"
        style={{
          background: 'var(--accent-brand-soft)',
          color: 'var(--accent-brand)',
          fontWeight: 700,
          fontSize: 13,
        }}
      >
        {position.symbol.slice(0, 4)}
      </div>

      <div className="min-w-0 flex-1">
        <div
          className="t-body2 truncate"
          style={{ fontWeight: 600, color: 'var(--text-primary)' }}
        >
          {position.name}
        </div>
        <div
          className="num-mono mt-0.5 truncate t-caption"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {subtitle}
        </div>
      </div>

      <div
        className="flex shrink-0 items-center gap-1"
        style={{ color: dirColor }}
      >
        <span className="num-mono t-label" style={{ fontWeight: 700 }}>
          {formatRMultiple(position.rMultiple)}
        </span>
        <Arrow size={16} strokeWidth={2} />
      </div>
    </Link>
  );
}

function tpProgress(p) {
  if (p.tp3Done) return 'TP3 ✓';
  if (p.tp2Done) return 'TP2 ✓';
  if (p.tp1Done) return 'TP1 ✓ · BE';
  return 'pending TP1';
}
