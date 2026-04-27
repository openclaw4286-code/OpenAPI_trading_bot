import { useMemo, useState } from 'react';
import { Check, X, Clock } from 'lucide-react';
import ScreenHeader from '../components/ScreenHeader.jsx';
import SearchField from '@ds/components/SearchField.jsx';
import EmptyScaffold from '@ds/components/EmptyScaffold.jsx';
import { MOCK_SIGNALS } from '../data/mock.js';

/**
 * Today's signals timeline. Each row is a signal record with its
 * outcome (approved / rejected / wait), reasoning, and meta. A pill
 * filter strip + symbol-name SearchField above the list lets the
 * operator narrow down to a specific cohort or ticker.
 */

const FILTERS = [
  { key: 'all',      label: '전체' },
  { key: 'approved', label: '승인' },
  { key: 'rejected', label: '거절' },
  { key: 'wait',     label: '대기' },
];

const OUTCOME_VISUAL = {
  approved: {
    icon: Check,
    color: 'var(--state-positive)',
    softBg: 'var(--state-positive-soft)',
    label: 'APPROVED',
  },
  rejected: {
    icon: X,
    color: 'var(--state-negative)',
    softBg: 'var(--state-negative-soft)',
    label: 'REJECTED',
  },
  wait: {
    icon: Clock,
    color: 'var(--state-warning)',
    softBg: 'var(--state-warning-soft)',
    label: 'WAIT',
  },
};

function SignalRow({ sig }) {
  const v = OUTCOME_VISUAL[sig.outcome] ?? OUTCOME_VISUAL.wait;
  const Icon = v.icon;
  return (
    <article
      className="rounded-2xl p-4"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--elev-1)',
        borderLeft: `3px solid ${v.color}`,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="num-mono inline-flex items-center gap-1 rounded-full px-2 py-0.5"
          style={{
            background: v.softBg,
            color: v.color,
            fontWeight: 800,
            fontSize: 11,
            letterSpacing: '0.04em',
          }}
        >
          <Icon size={11} strokeWidth={2.75} />
          {v.label}
        </span>
        <span
          className="t-caption num-mono"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {sig.ts}
        </span>
        <span className="flex-1" />
        <span
          className="t-body2 num-mono shrink-0"
          style={{ fontWeight: 700, color: 'var(--text-primary)' }}
        >
          {sig.symbol}
        </span>
      </div>
      <div
        className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 t-caption num-mono"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span>
          rr <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{sig.rr.toFixed(1)}</span>
        </span>
        <span>{sig.poiKind ?? '—'}</span>
        <span>{sig.triggerKind}</span>
        <span>{sig.session}</span>
        {sig.outcome === 'approved' && (
          <span>
            LLM <span style={{ fontWeight: 700, color: v.color }}>{sig.llmConf.toFixed(2)}</span>
          </span>
        )}
      </div>
      <p className="mt-2 t-body2" style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>
        {sig.rationale}
      </p>
    </article>
  );
}

export default function Signals() {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return MOCK_SIGNALS.filter((s) => {
      if (filter !== 'all' && s.outcome !== filter) return false;
      if (
        t &&
        !s.symbol.toLowerCase().includes(t) &&
        !s.name.toLowerCase().includes(t)
      )
        return false;
      return true;
    });
  }, [filter, q]);

  return (
    <>
      <ScreenHeader title="오늘 신호" />
      <div className="flex flex-col gap-3 p-4 pb-8">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="종목코드 또는 이름"
          className="w-full"
        />
        <div
          className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1"
          role="tablist"
        >
          {FILTERS.map((f) => {
            const active = f.key === filter;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="t-label shrink-0 rounded-full px-3.5 py-1.5"
                style={{
                  background: active
                    ? 'var(--accent-brand)'
                    : 'var(--surface)',
                  color: active ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: 700,
                  border: active
                    ? 'none'
                    : '1px solid var(--border-default)',
                  transition: 'background 200ms cubic-bezier(0.32, 0.72, 0, 1)',
                  boxShadow: active ? 'var(--elev-1)' : 'none',
                }}
                role="tab"
                aria-selected={active}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <EmptyScaffold
            title="해당 신호가 없어요"
            subtitle="다른 필터 또는 검색어를 시도해보세요."
            spec={`filter=${filter}${q ? ` · q="${q}"` : ''}`}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((s, i) => (
              <SignalRow key={`${s.ts}-${s.symbol}-${i}`} sig={s} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
