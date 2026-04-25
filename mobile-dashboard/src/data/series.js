// Synthetic but realistic-looking time series for sparklines. Seeded
// per-symbol so each card draws a stable curve across re-renders. A
// real deploy would swap these for downsampled OHLCV from
// data/cache/*.parquet via the FastAPI layer.

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Random-walk with a final-value pin so the last point sits exactly at
// `endPrice` (so the sparkline's tail aligns with the displayed
// current price).
function walk(seed, n, startPrice, endPrice, vol = 0.012) {
  const rng = mulberry32(seed);
  const out = [startPrice];
  for (let i = 1; i < n - 1; i++) {
    const last = out[out.length - 1];
    const drift = (endPrice - last) / (n - i) * 0.4;
    const noise = (rng() - 0.5) * 2 * vol * last;
    out.push(Math.max(1, last + drift + noise));
  }
  out.push(endPrice);
  return out;
}

export function pricePath(symbol, startPrice, endPrice, n = 48) {
  return walk(hashStr(symbol), n, startPrice, endPrice);
}

// Today's intraday equity curve, monotonically pulled toward `endKrw`.
export function equityCurve(startKrw, endKrw, n = 60) {
  return walk(0xc0ffee, n, startKrw, endKrw, 0.0015);
}

// Pipeline drop-off: turn raw counts into ratios of the universe size
// for the funnel bars.
export function asPercents(stages, total) {
  return stages.map((v) => Math.min(1, v / Math.max(1, total)));
}
