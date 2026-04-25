import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import Sparkline from './Sparkline.jsx';
import {
  formatPrice,
  formatRMultiple,
  sentimentColor,
} from '../data/format.js';
import { pricePath } from '../data/series.js';

// Position list row. Three visual layers stacked horizontally:
//   1. 4px direction-coloured rail on the left edge
//   2. circular avatar w/ first-glyph (matches MemberAvatar/VaultEntry)
//   3. title + sub-meta + tranche progress dots
//   4. trailing column: R-multiple + arrow + 60-pt sparkline
// The sparkline gives the row a price story without taking real estate
// from the type, and TP1/2/3 dots replace the prose "TP1 ✓" so the
// progress is glanceable.

const TP_TOTAL = 3;

export default function PositionMiniCard({ position }) {
  const dirColor = sentimentColor(position.rMultiple);
  const Arrow = position.rMultiple >= 0 ? ArrowUpRight : ArrowDownRight;
  const glyph = firstGlyph(position.name);
  const path = pricePath(position.symbol, position.entry, position.currentPrice, 48);
  const tpDone = [position.tp1Done, position.tp2Done, position.tp3Done];

  return (
    <Link
      to={`/positions/${position.symbol}`}
      className="relative flex items-center gap-3 overflow-hidden rounded-xl border p-3 pl-4"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border-subtle)',
        boxShadow: 'var(--elev-1)',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'box-shadow var(--dur-fast) var(--ease-soft)',
      }}
    >
      {/* left direction rail */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: dirColor }}
      />

      {/* avatar badge */}
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        style={{
          background: 'var(--accent-brand-soft)',
          color: 'var(--accent-brand)',
          fontWeight: 700,
          fontSize: 17,
          letterSpacing: '-0.02em',
        }}
      >
        {glyph}
      </div>

      {/* title block */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span
            className="t-body2 truncate"
            style={{ fontWeight: 700, color: 'var(--text-primary)' }}
          >
            {position.name}
          </span>
          <span
            className="num-mono t-caption"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {position.symbol}
          </span>
        </div>
        <div
          className="num-mono mt-0.5 truncate t-caption"
          style={{ color: 'var(--text-secondary)' }}
        >
          ₩{formatPrice(position.currentPrice)} ·{' '}
          {position.remainingQty}/{position.initialQty}주
        </div>
        {/* tranche progress dots */}
        <div className="mt-1.5 flex items-center gap-1">
          {Array.from({ length: TP_TOTAL }).map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: tpDone[i]
                  ? 'var(--state-positive)'
                  : 'var(--border-default)',
              }}
            />
          ))}
          <span
            className="t-caption ml-1"
            style={{ color: 'var(--text-tertiary)' }}
          >
            TP {tpDone.filter(Boolean).length}/{TP_TOTAL}
          </span>
        </div>
      </div>

      {/* trailing: sparkline + R */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Sparkline
          data={path}
          width={64}
          height={26}
          strokeWidth={1.5}
          color={dirColor}
          fill={false}
          showDot
        />
        <div
          className="flex items-center gap-0.5"
          style={{ color: dirColor }}
        >
          <span className="num-mono t-label" style={{ fontWeight: 700 }}>
            {formatRMultiple(position.rMultiple)}
          </span>
          <Arrow size={14} strokeWidth={2.25} />
        </div>
      </div>
    </Link>
  );
}

function firstGlyph(name) {
  if (!name) return '?';
  const chars = Array.from(name.trim());
  return chars[0]?.toUpperCase() ?? '?';
}
