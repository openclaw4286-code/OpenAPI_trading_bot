import { useParams } from 'react-router-dom';
import { Check, Circle, ChevronDown, Receipt, BrainCircuit } from 'lucide-react';
import ScreenHeader from '../components/ScreenHeader.jsx';
import PositionChart from '../components/PositionChart.jsx';
import EmptyScaffold from '@ds/components/EmptyScaffold.jsx';
import {
  formatPrice,
  formatRMultiple,
  formatKrw,
  sentimentColor,
} from '../data/format.js';
import { MOCK_POSITIONS } from '../data/mock.js';

/**
 * PositionDetail — drilling into one open trade. Vertical ladder:
 *   1. Headline P&L card (unrealized + R-multiple)
 *   2. Chart panel with reference lines (entry/stop/TPs)
 *   3. TP/SL ladder — each tranche with its R level + done state
 *   4. Fill table — chronological order of executions
 *   5. LLM rationale — why we entered, in the model's voice
 */

function TPSLLadder({ position }) {
  const dirSign = position.direction === 'bull' ? 1 : -1;
  const r = Math.abs(position.entry - position.stop);
  const rows = [
    { label: 'TP1', price: position.targets[0], r: dirSign * 0.5, done: position.tp1Done },
    { label: 'TP2', price: position.targets[1], r: dirSign * 1.5, done: position.tp2Done },
    { label: 'TP3', price: position.targets[2], r: dirSign * 3.0, done: position.tp3Done },
    { label: 'Stop', price: position.stop, r: 0, isStop: true },
  ];
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const isStop = !!row.isStop;
        return (
          <li
            key={row.label}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            style={{
              background: row.done
                ? 'var(--state-positive-soft)'
                : isStop
                ? 'var(--state-negative-soft)'
                : 'var(--surface-layered)',
              border: '1px solid transparent',
              borderColor: row.done
                ? 'var(--state-positive-soft)'
                : 'var(--border-subtle)',
            }}
          >
            <span
              className="flex shrink-0 items-center justify-center rounded-full"
              style={{
                width: 22,
                height: 22,
                background: row.done
                  ? 'var(--state-positive)'
                  : isStop
                  ? 'var(--state-negative)'
                  : 'var(--surface)',
                color: row.done || isStop ? '#FFFFFF' : 'var(--text-tertiary)',
                border: row.done || isStop ? 'none' : '1px solid var(--border-default)',
              }}
            >
              {row.done ? (
                <Check size={12} strokeWidth={3} />
              ) : isStop ? (
                <ChevronDown size={12} strokeWidth={3} />
              ) : (
                <Circle size={8} strokeWidth={3} />
              )}
            </span>
            <span
              className="t-label shrink-0"
              style={{ width: 36, fontWeight: 700 }}
            >
              {row.label}
            </span>
            <span
              className="num-mono t-body2 flex-1"
              style={{ fontWeight: 600 }}
            >
              ₩{formatPrice(row.price)}
            </span>
            <span
              className="num-mono t-caption"
              style={{
                color: isStop
                  ? 'var(--state-negative)'
                  : row.done
                  ? 'var(--state-positive)'
                  : 'var(--text-tertiary)',
                fontWeight: 600,
              }}
            >
              {isStop
                ? row.price === position.entry
                  ? 'BE · ratchet'
                  : 'init'
                : formatRMultiple(r ? row.r : 0)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function FillTable({ fills }) {
  return (
    <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--border-subtle)' }}>
      <table className="w-full text-left">
        <thead>
          <tr
            className="t-caption"
            style={{
              color: 'var(--text-tertiary)',
              background: 'var(--surface-layered)',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <th className="px-3 py-2">시각</th>
            <th className="py-2">방향</th>
            <th className="py-2 text-right">수량</th>
            <th className="py-2 text-right">가격</th>
            <th className="px-3 py-2 text-right">유형</th>
          </tr>
        </thead>
        <tbody className="t-body2">
          {fills.map((f, i) => (
            <tr
              key={i}
              className="border-t"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <td className="num-mono px-3 py-2.5">{f.ts}</td>
              <td className="py-2.5">
                <span
                  className="rounded px-1.5 py-0.5 t-caption"
                  style={{
                    background:
                      f.side === 'BUY'
                        ? 'var(--state-positive-soft)'
                        : 'var(--state-negative-soft)',
                    color:
                      f.side === 'BUY'
                        ? 'var(--state-positive)'
                        : 'var(--state-negative)',
                    fontWeight: 700,
                  }}
                >
                  {f.side}
                </span>
              </td>
              <td className="num-mono py-2.5 text-right" style={{ fontWeight: 600 }}>
                {f.qty}
              </td>
              <td className="num-mono py-2.5 text-right" style={{ fontWeight: 600 }}>
                ₩{formatPrice(f.price)}
              </td>
              <td
                className="px-3 py-2.5 text-right t-caption"
                style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}
              >
                {f.kind}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PositionDetail() {
  const { symbol } = useParams();
  const position = MOCK_POSITIONS.find((p) => p.symbol === symbol);

  if (!position) {
    return (
      <>
        <ScreenHeader title="포지션" back />
        <EmptyScaffold
          title="포지션을 찾을 수 없어요"
          subtitle="이미 청산되었거나 잘못된 종목코드일 수 있습니다."
          spec={`symbol=${symbol}`}
        />
      </>
    );
  }

  const unrealized =
    (position.currentPrice - position.entry) * position.remainingQty *
    (position.direction === 'bull' ? 1 : -1);
  const color = sentimentColor(unrealized);
  const sentimentSoft =
    unrealized >= 0 ? 'var(--state-positive-soft)' : 'var(--state-negative-soft)';

  return (
    <>
      <ScreenHeader title={`${position.symbol} ${position.name}`} back />
      <div className="flex flex-col gap-4 p-4 pb-8">
        <section
          className="rounded-2xl p-5"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--elev-2)',
          }}
        >
          <div className="flex items-center justify-between">
            <span
              className="t-caption"
              style={{
                color: 'var(--text-tertiary)',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              미실현 손익
            </span>
            <span
              className="num-mono inline-flex items-center gap-1 rounded-full px-2.5 py-1"
              style={{
                background: sentimentSoft,
                color,
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: '-0.005em',
              }}
            >
              {formatRMultiple(position.rMultiple)}
            </span>
          </div>
          <div
            className="num-mono mt-2"
            style={{
              fontSize: 32,
              lineHeight: '40px',
              fontWeight: 800,
              color,
              letterSpacing: '-0.025em',
            }}
          >
            {formatKrw(unrealized, { sign: true })}
          </div>
          <div
            className="num-mono mt-1 t-caption"
            style={{ color: 'var(--text-secondary)' }}
          >
            {position.remainingQty} / {position.initialQty}주 보유 · 진입{' '}
            {position.enteredAt}
          </div>
        </section>

        <PositionChart position={position} />

        <section className="flex flex-col gap-2">
          <h3 className="t-heading2 px-1" style={{ fontWeight: 700 }}>
            체크포인트
          </h3>
          <TPSLLadder position={position} />
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="t-heading2 flex items-center gap-1.5 px-1" style={{ fontWeight: 700 }}>
            <Receipt size={16} strokeWidth={2} style={{ color: 'var(--text-secondary)' }} />
            체결 내역
            <span
              className="t-caption num-mono ml-1 inline-flex items-center justify-center rounded-full px-1.5"
              style={{
                background: 'var(--accent-brand-soft)',
                color: 'var(--accent-brand)',
                fontWeight: 700,
                fontSize: 11,
                minHeight: 18,
              }}
            >
              {position.fills.length}
            </span>
          </h3>
          <FillTable fills={position.fills} />
        </section>

        <section
          className="rounded-2xl p-4"
          style={{
            background: 'var(--accent-brand-soft)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 t-heading2" style={{ fontWeight: 700 }}>
              <BrainCircuit
                size={16}
                strokeWidth={2}
                style={{ color: 'var(--accent-brand)' }}
              />
              진입 사유 (LLM)
            </h3>
            <span
              className="num-mono t-caption rounded-full px-2 py-0.5"
              style={{
                background: 'var(--surface)',
                color: 'var(--accent-brand)',
                fontWeight: 700,
              }}
            >
              conf {position.llmConfidence.toFixed(2)}
            </span>
          </div>
          <p className="mt-2 t-body2" style={{ color: 'var(--text-primary)', lineHeight: 1.55 }}>
            "{position.llmRationale}"
          </p>
          <p
            className="mt-2 t-caption num-mono"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {position.poiKind} · {position.triggerKind} · {position.session}
          </p>
        </section>
      </div>
    </>
  );
}
