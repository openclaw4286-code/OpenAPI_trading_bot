import { Check, X as XIcon } from 'lucide-react';
import ScreenHeader from '../components/ScreenHeader.jsx';
import { MOCK_SETTINGS } from '../data/mock.js';

// Read-only configuration view. Mirrors the operator's .env / config.py
// values so the operator can verify them from a phone without SSH'ing
// in. Edits intentionally absent — config changes belong on the host.

const NOTIFY_LABELS = {
  entry:        '진입 / 청산',
  reject:       'LLM 거절',
  stopOut:      'Stop-out',
  tickSummary:  '매 틱 요약',
};

function Group({ title, children }) {
  return (
    <section
      className="rounded-2xl px-4"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <h3
        className="t-caption pt-3 pb-1"
        style={{
          color: 'var(--text-tertiary)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </h3>
      <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
        {children}
      </div>
    </section>
  );
}

function Row({ label, hint, control }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="t-body2" style={{ fontWeight: 500 }}>
          {label}
        </div>
        {hint && (
          <div className="t-caption" style={{ color: 'var(--text-tertiary)' }}>
            {hint}
          </div>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function Pill({ children, tone = 'neutral' }) {
  const palette = {
    neutral:   { bg: 'var(--surface-layered)', fg: 'var(--text-secondary)' },
    positive:  { bg: 'var(--state-positive-soft)', fg: 'var(--state-positive)' },
    warning:   { bg: 'var(--state-warning-soft)', fg: 'var(--state-warning)' },
    brand:     { bg: 'var(--accent-brand-soft)', fg: 'var(--accent-brand)' },
  };
  const p = palette[tone] ?? palette.neutral;
  return (
    <span
      className="t-caption rounded-full px-2.5 py-0.5 num-mono"
      style={{ background: p.bg, color: p.fg, fontWeight: 600 }}
    >
      {children}
    </span>
  );
}

function BoolGlyph({ on }) {
  return on ? (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full"
      style={{
        background: 'var(--state-positive-soft)',
        color: 'var(--state-positive)',
      }}
    >
      <Check size={12} strokeWidth={2.75} />
    </span>
  ) : (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full"
      style={{
        background: 'var(--surface-layered)',
        color: 'var(--text-tertiary)',
      }}
    >
      <XIcon size={12} strokeWidth={2.5} />
    </span>
  );
}

export default function Settings() {
  const s = MOCK_SETTINGS;

  return (
    <>
      <ScreenHeader title="구성" />
      <div className="flex flex-col gap-3 p-4 pb-8">
        <p
          className="t-caption px-1"
          style={{ color: 'var(--text-tertiary)' }}
        >
          조회 전용입니다. 변경은 서버의 <span className="num-mono">.env</span>{' '}
          및 <span className="num-mono">config.py</span> 에서 이뤄집니다.
        </p>

        <Group title="환경">
          <Row
            label="KIS 환경"
            hint={s.kisEnv === 'real' ? '실전 계좌' : '모의투자'}
            control={
              <Pill tone={s.kisEnv === 'real' ? 'warning' : 'brand'}>
                {s.kisEnv === 'real' ? 'REAL' : 'VPS'}
              </Pill>
            }
          />
          <Row
            label="TEST_MODE"
            hint="dry-run · 실주문 차단"
            control={<BoolGlyph on={s.testMode} />}
          />
          <Row
            label="ALLOW_SHORT"
            hint="국내 개인 공매도 제약 — 강제 OFF"
            control={<BoolGlyph on={s.allowShort} />}
          />
        </Group>

        <Group title="파이프라인">
          <Row
            label="MTF 모드"
            hint={
              s.mtfMode === 'h4'
                ? 'D / 4h / 15m (정통 ICT)'
                : 'W / D / 15m (legacy)'
            }
            control={<Pill tone="brand">{s.mtfMode}</Pill>}
          />
          <Row
            label="시그널 품질 필터"
            hint="평균 R / 승률 floor 미달 종목 가지치기"
            control={<BoolGlyph on={s.qualityFilter} />}
          />
          <Row
            label="유니버스 Top-N"
            hint="매일 08:00 KST 빌드"
            control={<Pill>{s.topN}</Pill>}
          />
        </Group>

        <Group title="알림">
          <Row
            label={`${s.webhook.provider} 웹훅`}
            hint={s.webhook.connected ? '연결됨' : '미연결'}
            control={
              s.webhook.connected ? (
                <Pill tone="positive">OK</Pill>
              ) : (
                <Pill tone="warning">설정 필요</Pill>
              )
            }
          />
          {Object.entries(NOTIFY_LABELS).map(([key, label]) => (
            <Row
              key={key}
              label={label}
              control={<BoolGlyph on={s.notifyChannels[key]} />}
            />
          ))}
        </Group>

        <Group title="세션">
          <Row label="남은 일수" control={<Pill>22 / 30일</Pill>} />
        </Group>
      </div>
    </>
  );
}
