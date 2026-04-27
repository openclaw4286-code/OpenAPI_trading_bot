import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import Sparkline from './Sparkline.jsx';
import {
  formatPrice,
  formatRMultiple,
  sentimentColor,
} from '../data/format.js';
import { pricePath } from '../data/series.js';

/**
 * Position list row — Toss-style headline price + sentiment chip,
 * with a small (52×16) sparkline tucked between the metadata row and
 * the TP-progress battery so each card carries a price story without
 * dominating the type. Subtle hover lift via box-shadow + transform
 * on pointer devices; mobile press triggers a 0.985 scale tap so
 * touch users get tactile feedback.
 */
const TP_TOTAL = 3;

export default function PositionMiniCard({ position }) {
  const dirColor = sentimentColor(position.rMultiple);
  const sentimentSoft =
    position.rMultiple >= 0
      ? 'var(--state-positive-soft)'
      : 'var(--state-negative-soft)';
  const glyph = firstGlyph(position.name);
  const tpDone = [position.tp1Done, position.tp2Done, position.tp3Done];
  const tpCount = tpDone.filter(Boolean).length;
  const path = pricePath(position.symbol, position.entry, position.currentPrice, 32);

  return (
    <Link
      to={`/positions/${position.symbol}`}
      className="block rounded-2xl p-4"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--elev-1)',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'box-shadow 200ms cubic-bezier(0.32, 0.72, 0, 1), transform 160ms cubic-bezier(0.32, 0.72, 0, 1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--elev-2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--elev-1)';
        e.currentTarget.style.transform = '';
      }}
      onPointerDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.985)';
      }}
      onPointerUp={(e) => {
        e.currentTarget.style.transform = '';
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex shrink-0 items-center justify-center rounded-xl"
          style={{
            width: 44,
            height: 44,
            background: 'var(--accent-brand-soft)',
            color: 'var(--accent-brand)',
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: '-0.02em',
          }}
        >
          {glyph}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="t-body2 truncate"
            style={{ fontWeight: 700, color: 'var(--text-primary)' }}
          >
            {position.name}
          </div>
          <div
            className="num-mono t-caption"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {position.symbol} · {position.remainingQty}/{position.initialQty}주
          </div>
        </div>
        <ChevronRight
          size={18}
          strokeWidth={1.75}
          style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
        />
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div
            className="num-mono"
            style={{
              fontSize: 26,
              lineHeight: '32px',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            ₩{formatPrice(position.currentPrice)}
          </div>
          <div className="mt-2 flex items-center gap-1">
            {Array.from({ length: TP_TOTAL }).map((_, i) => (
              <span
                key={i}
                className="rounded-full"
                style={{
                  width: 18,
                  height: 4,
                  background: tpDone[i]
                    ? 'var(--state-positive)'
                    : 'var(--surface-sunken)',
                }}
              />
            ))}
            <span
              className="t-caption ml-1.5 num-mono"
              style={{ color: 'var(--text-tertiary)', fontSize: 11 }}
            >
              TP {tpCount}/{TP_TOTAL}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Sparkline
            data={path}
            width={52}
            height={16}
            strokeWidth={1.5}
            color={dirColor}
            fill={false}
          />
          <span
            className="num-mono inline-flex items-center justify-center rounded-lg"
            style={{
              minWidth: 60,
              padding: '4px 8px',
              background: sentimentSoft,
              color: dirColor,
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: '-0.005em',
            }}
          >
            {formatRMultiple(position.rMultiple)}
          </span>
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
