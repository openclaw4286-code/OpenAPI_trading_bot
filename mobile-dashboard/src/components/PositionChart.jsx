import Sparkline from './Sparkline.jsx';
import { formatPrice, sentimentColor } from '../data/format.js';
import { pricePath } from '../data/series.js';

/**
 * Position chart placeholder. Until the candle component lands we
 * synthesize a 96-point intraday curve and overlay horizontal price
 * lines for entry / stop / each TP — that's enough visual grammar
 * for the operator to read the trade story without an actual chart
 * library. Each price line carries a coloured chip on the right edge
 * so the level can be identified at a glance.
 */

const TP_LABELS = ['TP1', 'TP2', 'TP3'];

function PriceLine({ y, label, color, value, dashed = true }) {
  return (
    <>
      <line
        x1={0}
        x2="100%"
        y1={y}
        y2={y}
        stroke={color}
        strokeWidth={1}
        strokeDasharray={dashed ? '4 4' : 'none'}
        opacity={0.7}
      />
      <foreignObject x="100%" y={y - 10} width={64} height={20}
        style={{ overflow: 'visible' }}
      >
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            transform: 'translateX(-58px)',
            display: 'inline-flex',
            gap: 4,
            alignItems: 'center',
            background: color,
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            padding: '2px 6px',
            borderRadius: 4,
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      </foreignObject>
    </>
  );
}

export default function PositionChart({ position, height = 200 }) {
  const dirColor = sentimentColor(position.rMultiple);
  const path = pricePath(position.symbol, position.entry, position.currentPrice, 96);

  // Compute the y-extent so all reference levels (stop, entry, TPs) fit
  // even if some sit outside the price-walk's [min,max] range.
  const allLevels = [
    position.entry,
    position.stop,
    ...position.targets,
    ...path,
  ];
  const min = Math.min(...allLevels);
  const max = Math.max(...allLevels);
  const range = max - min || 1;
  const pad = range * 0.08;
  const top = max + pad;
  const bot = min - pad;
  const fullRange = top - bot;

  const yFor = (v) => ((top - v) / fullRange) * height;

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--elev-1)',
      }}
    >
      <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
        <h3 className="t-heading2" style={{ fontWeight: 700 }}>
          가격
        </h3>
        <span
          className="t-caption num-mono"
          style={{ color: 'var(--text-tertiary)' }}
        >
          15m · ICT overlay
        </span>
      </div>

      <div className="relative" style={{ height, paddingRight: 8 }}>
        {/* sparkline fill spanning full width */}
        <Sparkline
          data={path}
          width={400}
          height={height}
          strokeWidth={2}
          color={dirColor}
          fill
          showDot
          className="absolute inset-0 h-full w-full"
        />

        {/* reference-line overlay */}
        <svg
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          width="100%"
          height={height}
          className="absolute inset-0"
          style={{ pointerEvents: 'none' }}
        >
          <PriceLine
            y={yFor(position.stop)}
            label="STOP"
            color="var(--state-negative)"
            value={position.stop}
          />
          <PriceLine
            y={yFor(position.entry)}
            label="ENTRY"
            color="var(--text-secondary)"
            value={position.entry}
            dashed={false}
          />
          {position.targets.map((t, i) => (
            <PriceLine
              key={`tp-${i}`}
              y={yFor(t)}
              label={TP_LABELS[i]}
              color="var(--state-positive)"
              value={t}
            />
          ))}
        </svg>
      </div>

      <div
        className="grid grid-cols-3 gap-2 border-t px-4 py-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div>
          <div
            className="t-caption"
            style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}
          >
            현재가
          </div>
          <div
            className="num-mono"
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            ₩{formatPrice(position.currentPrice)}
          </div>
        </div>
        <div className="text-center">
          <div
            className="t-caption"
            style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}
          >
            진입
          </div>
          <div
            className="num-mono"
            style={{ fontSize: 16, fontWeight: 700 }}
          >
            ₩{formatPrice(position.entry)}
          </div>
        </div>
        <div className="text-right">
          <div
            className="t-caption"
            style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}
          >
            손절
          </div>
          <div
            className="num-mono"
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--state-negative)',
            }}
          >
            ₩{formatPrice(position.stop)}
          </div>
        </div>
      </div>
    </div>
  );
}
