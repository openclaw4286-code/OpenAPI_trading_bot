import { ArrowRight } from 'lucide-react';

/**
 * Pipeline drop-off visualizer. Each stage is a rounded chip whose
 * width is proportional to its survival rate vs. the previous stage.
 * Between stages we show the conversion percentage in a small chip,
 * so a glance answers "where does the funnel narrow?".
 *
 * Stage tones:
 *   universe   — info  (teal)   — raw input
 *   ictPass    — brand (blue)   — algorithmic survivors
 *   llmApproved— warning(orange)— LLM gate (the bottleneck)
 *   submitted  — positive(green)— actually shipped to broker
 */
const STAGES = [
  { key: 'universe',    label: 'Universe', color: 'var(--state-info)',     bg: 'var(--state-info-soft)' },
  { key: 'ictPass',     label: 'ICT',      color: 'var(--accent-brand)',   bg: 'var(--accent-brand-soft)' },
  { key: 'llmApproved', label: 'LLM',      color: 'var(--state-warning)',  bg: 'var(--state-warning-soft)' },
  { key: 'submitted',   label: 'Order',    color: 'var(--state-positive)', bg: 'var(--state-positive-soft)' },
];

export default function PipelineFunnel({ pipeline }) {
  const universe = Math.max(1, pipeline.universe);

  const computed = STAGES.map((s, i) => {
    const v = pipeline[s.key] ?? 0;
    const prev = i === 0 ? universe : (pipeline[STAGES[i - 1].key] ?? universe);
    const dropPct = prev === 0 ? 0 : Math.round(((prev - v) / prev) * 100);
    const survivePct = prev === 0 ? 0 : Math.round((v / prev) * 100);
    return { ...s, value: v, prev, dropPct, survivePct };
  });

  return (
    <section
      className="rounded-2xl p-4"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--elev-1)',
      }}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="t-heading2" style={{ fontWeight: 700 }}>
          오늘 파이프라인
        </h3>
        <span
          className="t-caption num-mono"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {pipeline.submitted} / {pipeline.universe}
        </span>
      </div>

      {/* Stage chips with arrows in between */}
      <div className="flex items-center gap-1.5">
        {computed.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <div
              className="flex flex-col items-center justify-center rounded-xl"
              style={{
                background: s.bg,
                color: s.color,
                minWidth: 56,
                paddingTop: 8,
                paddingBottom: 8,
              }}
            >
              <span
                className="num-mono"
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                {s.value}
              </span>
              <span
                className="t-caption mt-0.5"
                style={{ fontWeight: 600, fontSize: 10, letterSpacing: '0.04em' }}
              >
                {s.label}
              </span>
            </div>
            {i < computed.length - 1 && (
              <ArrowRight
                size={12}
                strokeWidth={2}
                style={{
                  color: 'var(--text-tertiary)',
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Conversion-rate footnote */}
      <div
        className="mt-3 grid grid-cols-3 gap-1"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {computed.slice(1).map((s) => (
          <div
            key={`conv-${s.key}`}
            className="t-caption num-mono text-center"
            style={{ fontSize: 11 }}
          >
            <span style={{ color: s.color, fontWeight: 700 }}>
              {s.survivePct}%
            </span>{' '}
            survive
          </div>
        ))}
      </div>
    </section>
  );
}
