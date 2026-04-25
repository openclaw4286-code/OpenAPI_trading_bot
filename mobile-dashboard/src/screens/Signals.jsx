import { useMemo, useState } from 'react';
import { Check, X, Clock } from 'lucide-react';
import ScreenHeader from '../components/ScreenHeader.jsx';
import SearchField from '@ds/components/SearchField.jsx';
import EmptyScaffold from '@ds/components/EmptyScaffold.jsx';
import { MOCK_SIGNALS } from '../data/mock.js';

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
    bg: 'var(--state-positive-soft)',
    label: 'APPROVED',
  },
  rejected: {
    icon: X,
    color: 'var(--state-negative)',
    bg: 'var(--state-negative-soft)',
    label: 'REJECTED',
  },
  wait: {
    icon: Clock,
    color: 'var(--state-warning)',
    bg: 'var(--state-warning-soft)',
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
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ background: v.bg, color: v.color }}
        >
          <Icon size={13} strokeWidth={2.5} />
        </span>
        <span
          className="t-caption shrink-0"
          style={{ fontWeight: 700, color: v.color, letterSpacing: '0.02em' }}
        >
          {v.label}
        </span>
        <span
          className="t-caption num-mono shrink-0"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {sig.ts}
        </span>
        <span className="flex-1" />
        <span
          className="t-label num-mono shrink-0"
          style={{ fontWeight: 600 }}
        >
          {sig.symbol}
        </span>
      </div>
      <div
        className="mt-2 t-caption num-mono"
        style={{ color: 'var(--text-secondary)' }}
      >
        rr {sig.rr.toFixed(1)} · {sig.poiKind ?? '—'} · {sig.triggerKind} ·{' '}
        {sig.session}
        {sig.outcome === 'approved' && ` · LLM conf ${sig.llmConf.toFixed(2)}`}
      </div>
      <p className="mt-1 t-body2" style={{ color: 'var(--text-primary)' }}>
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
      <div className="p-4 pb-8">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="종목코드 또는 이름"
          className="mb-3 w-full"
        />
        <div
          className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1"
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
                    : 'var(--surface-layered)',
                  color: active ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: 600,
                  border: active
                    ? 'none'
                    : '1px solid var(--border-subtle)',
                  transition: 'background var(--dur-fast) var(--ease-soft)',
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
