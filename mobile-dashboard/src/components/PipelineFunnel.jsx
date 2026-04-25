// Horizontal-bar funnel showing today's pipeline survival:
// universe → ICT confluence → LLM approved → submitted.
// Bar widths normalize to the universe count so the eye can map drop-off
// at a glance. Pure presentational — no animations beyond the ease-soft
// width transition for refresh.

const STAGES = [
  { key: 'universe',    label: 'Universe' },
  { key: 'ictPass',     label: 'ICT pass' },
  { key: 'llmApproved', label: 'LLM appr' },
  { key: 'submitted',   label: 'Submitted' },
];

export default function PipelineFunnel({ pipeline }) {
  const total = Math.max(1, pipeline.universe);
  return (
    <section
      className="rounded-2xl p-4"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-baseline justify-between">
        <h3 className="t-heading2" style={{ fontWeight: 600 }}>
          오늘 파이프라인
        </h3>
        <span className="t-caption" style={{ color: 'var(--text-tertiary)' }}>
          screener → ICT → LLM → order
        </span>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {STAGES.map((s) => {
          const v = pipeline[s.key] ?? 0;
          const ratio = v / total;
          return (
            <div key={s.key} className="flex items-center gap-3">
              <span
                className="t-caption shrink-0"
                style={{ color: 'var(--text-secondary)', width: 72 }}
              >
                {s.label}
              </span>
              <span
                className="num-mono t-label shrink-0"
                style={{ width: 28, textAlign: 'right', fontWeight: 600 }}
              >
                {v}
              </span>
              <div
                className="h-2 flex-1 overflow-hidden rounded-full"
                style={{ background: 'var(--surface-sunken)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, ratio * 100)}%`,
                    background: 'var(--accent-brand)',
                    transition: 'width var(--dur-normal) var(--ease-soft)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
