import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import {
  formatPrice,
  formatRMultiple,
  sentimentColor,
} from '../data/format.js';

// Position row, Toss-style: chunky brand badge + bold name on top, big
// price as the headline number, R-multiple in a coloured chip on the
// right that doubles as the visual sentiment cue. TP progress dots sit
// under the price like a battery gauge. No decorative background —
// keep the card visually quiet so the data shouts.

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
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: 'var(--accent-brand-soft)',
            color: 'var(--accent-brand)',
            fontWeight: 800,
            fontSize: 17,
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
          style={{ color: 'var(--text-tertiary)' }}
        />
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div
            className="num-mono"
            style={{
              fontSize: 24,
              lineHeight: '30px',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.015em',
            }}
          >
            ₩{formatPrice(position.currentPrice)}
          </div>
          <div className="mt-1.5 flex items-center gap-1">
            {Array.from({ length: TP_TOTAL }).map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-5 rounded-full"
                style={{
                  background: tpDone[i]
                    ? 'var(--state-positive)'
                    : 'var(--surface-sunken)',
                }}
              />
            ))}
            <span
              className="t-caption ml-1 num-mono"
              style={{ color: 'var(--text-tertiary)' }}
            >
              TP {tpCount}/{TP_TOTAL}
            </span>
          </div>
        </div>
        <span
          className="num-mono inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 t-label"
          style={{
            background: sentimentSoft,
            color: dirColor,
            fontWeight: 800,
            fontSize: 14,
          }}
        >
          {formatRMultiple(position.rMultiple)}
        </span>
      </div>
    </Link>
  );
}

function firstGlyph(name) {
  if (!name) return '?';
  const chars = Array.from(name.trim());
  return chars[0]?.toUpperCase() ?? '?';
}
