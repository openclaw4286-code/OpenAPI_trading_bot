import { useId } from 'react';

// Lightweight inline-SVG sparkline. No chart library dep — we only
// ever draw 30–80 points and we want zero per-frame work. The path is
// pre-computed from `data`, so React only re-renders when the array
// reference changes. A faint area-fill under the line gives the curve
// some weight without competing with the stroke.

export default function Sparkline({
  data,
  width = 120,
  height = 36,
  strokeWidth = 1.75,
  color = 'var(--accent-brand)',
  fill = true,
  className = '',
  showDot = false,
}) {
  const id = useId();
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className={className} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - strokeWidth) - strokeWidth / 2;
    return [x, y];
  });

  const linePath = points
    .map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`))
    .join(' ');

  const fillPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={`grad-${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fillPath} fill={`url(#grad-${id})`} />
        </>
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDot && (
        <circle
          cx={last[0]}
          cy={last[1]}
          r={strokeWidth + 1.5}
          fill={color}
        />
      )}
    </svg>
  );
}
