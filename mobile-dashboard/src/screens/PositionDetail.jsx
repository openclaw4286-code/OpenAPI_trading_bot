import { useParams } from 'react-router-dom';
import { Check, Circle, Triangle } from 'lucide-react';
import ScreenHeader from '../components/ScreenHeader.jsx';
import Button from '@ds/components/Button.jsx';
import EmptyScaffold from '@ds/components/EmptyScaffold.jsx';
import {
  formatPrice,
  formatRMultiple,
  formatKrw,
  sentimentColor,
} from '../data/format.js';
import { MOCK_POSITIONS } from '../data/mock.js';

// TPSLLadder — vertical stack of TP1/TP2/TP3 + Stop with status icons.
// Inline rather than promoted to a component until/unless reused.
function TPSLLadder({ position }) {
  const dirSign = position.direction === 'bull' ? 1 : -1;
  const r = Math.abs(position.entry - position.stop);
  const rows = [
    {
      label: 'TP1',
      price: position.targets[0],
      r: dirSign * 0.5,
      done: position.tp1Done,
    },
    {
      label: 'TP2',
      price: position.targets[1],
      r: dirSign * 1.5,
      done: position.tp2Done,
    },
    {
      label: 'TP3',
      price: position.targets[2],
      r: dirSign * 3.0,
      done: position.tp3Done,
    },
    {
      label: 'Stop',
      price: position.stop,
      r: position.stop === position.entry ? 0 : -1,
      done: false,
      isStop: true,
    },
  ];
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <li
          key={row.label}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5"
          style={{
            background: row.done
              ? 'var(--state-positive-soft)'
              : 'var(--surface-layered)',
          }}
        >
          {row.isStop ? (
            <Triangle
              size={14}
              strokeWidth={2}
              fill="currentColor"
              style={{ color: 'var(--state-warning)' }}
            />
          ) : row.done ? (
            <Check
              size={14}
              strokeWidth={2.5}
              style={{ color: 'var(--state-positive)' }}
            />
          ) : (
            <Circle
              size={14}
              strokeWidth={1.75}
              style={{ color: 'var(--text-tertiary)' }}
            />
          )}
          <span
            className="t-label shrink-0"
            style={{ width: 36, fontWeight: 600 }}
          >
            {row.label}
          </span>
          <span
            className="num-mono t-body2 flex-1"
            style={{ fontWeight: 500 }}
          >
            {formatPrice(row.price)}
          </span>
          <span
            className="num-mono t-caption"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {row.isStop
              ? row.r === 0
                ? 'BE · ratchet'
                : 'init'
              : formatRMultiple(r ? row.r : 0).replace('+', '+')}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FillTable({ fills }) {
  return (
    <table className="w-full text-left">
      <thead>
        <tr className="t-caption" style={{ color: 'var(--text-tertiary)' }}>
          <th className="py-1 font-normal">시각</th>
          <th className="py-1 font-normal">방향</th>
          <th className="py-1 text-right font-normal">수량</th>
          <th className="py-1 text-right font-normal">가격</th>
          <th className="py-1 text-right font-normal">유형</th>
        </tr>
      </thead>
      <tbody className="t-body2">
        {fills.map((f, i) => (
          <tr
            key={i}
            className="border-t"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <td className="num-mono py-2">{f.ts}</td>
            <td
              className="py-2"
              style={{
                color:
                  f.side === 'BUY'
                    ? 'var(--state-positive)'
                    : 'var(--state-negative)',
                fontWeight: 600,
              }}
            >
              {f.side}
            </td>
            <td className="num-mono py-2 text-right">{f.qty}</td>
            <td className="num-mono py-2 text-right">{formatPrice(f.price)}</td>
            <td
              className="py-2 text-right t-caption"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {f.kind}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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

  return (
    <>
      <ScreenHeader title={`${position.symbol} ${position.name}`} back />
      <div className="flex flex-col gap-4 p-4 pb-8">
        <section
          className="rounded-2xl p-4"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="t-caption" style={{ color: 'var(--text-tertiary)' }}>
            미실현
          </div>
          <div
            className="num-mono"
            style={{
              fontSize: 28,
              lineHeight: '36px',
              fontWeight: 700,
              color,
            }}
          >
            {formatKrw(unrealized, { sign: true })}{' '}
            <span className="t-label" style={{ fontWeight: 600 }}>
              {formatRMultiple(position.rMultiple)}
            </span>
          </div>
          <div
            className="num-mono mt-1 t-body2"
            style={{ color: 'var(--text-secondary)' }}
          >
            진입 {formatPrice(position.entry)} · 현재{' '}
            {formatPrice(position.currentPrice)} · {position.remainingQty}/
            {position.initialQty}주
          </div>
        </section>

        <section
          className="rounded-2xl p-4"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <h3 className="t-heading2 mb-3" style={{ fontWeight: 600 }}>
            체크포인트
          </h3>
          <TPSLLadder position={position} />
        </section>

        <section
          className="rounded-2xl p-4"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <h3 className="t-heading2 mb-2" style={{ fontWeight: 600 }}>
            체결 내역 <span style={{ color: 'var(--text-tertiary)' }}>
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
            <h3 className="t-heading2" style={{ fontWeight: 600 }}>
              진입 사유 (LLM)
            </h3>
            <span
              className="t-caption num-mono"
              style={{ color: 'var(--text-secondary)' }}
            >
              conf {position.llmConfidence.toFixed(2)}
            </span>
          </div>
          <p className="mt-2 t-body2" style={{ color: 'var(--text-primary)' }}>
            "{position.llmRationale}"
          </p>
          <p
            className="mt-1 t-caption"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {position.poiKind} · {position.triggerKind} · {position.session} · 진입
            {' '}{position.enteredAt}
          </p>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" size="lg">
            트레일 일시중지
          </Button>
          <Button variant="danger" size="lg">
            강제 청산
          </Button>
        </div>
      </div>
    </>
  );
}
