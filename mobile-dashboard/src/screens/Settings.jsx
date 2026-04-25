import { useState } from 'react';
import { Check } from 'lucide-react';
import ScreenHeader from '../components/ScreenHeader.jsx';
import Button from '@ds/components/Button.jsx';
import { MOCK_SETTINGS } from '../data/mock.js';

// Inline toggle. We don't pull this into its own file until a second
// screen needs it — keep the surface area minimal.
function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      className="relative inline-flex h-6 w-10 items-center rounded-full"
      style={{
        background: checked
          ? 'var(--accent-brand)'
          : 'var(--surface-sunken)',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background var(--dur-fast) var(--ease-soft)',
      }}
    >
      <span
        className="inline-block h-5 w-5 rounded-full"
        style={{
          background: '#FFFFFF',
          transform: `translateX(${checked ? 18 : 2}px)`,
          transition: 'transform var(--dur-fast) var(--ease-soft)',
          boxShadow: '0 1px 2px rgba(0,0,0,.15)',
        }}
      />
    </button>
  );
}

function Row({ label, hint, control }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="t-body2" style={{ fontWeight: 500 }}>{label}</div>
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

function Group({ title, children }) {
  return (
    <section
      className="rounded-2xl p-1 px-4"
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

function RadioGroup({ value, options, onChange }) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="t-label rounded-full px-3 py-1"
            style={{
              background: active ? 'var(--accent-brand)' : 'var(--surface-layered)',
              color: active ? '#FFFFFF' : 'var(--text-secondary)',
              fontWeight: 600,
              border: active ? 'none' : '1px solid var(--border-subtle)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Settings() {
  const [s, setS] = useState(MOCK_SETTINGS);
  const update = (patch) => setS({ ...s, ...patch });

  return (
    <>
      <ScreenHeader title="설정" />
      <div className="flex flex-col gap-3 p-4 pb-8">
        <Group title="환경">
          <Row
            label="KIS 환경"
            hint="real로 전환은 데스크톱에서만 가능합니다"
            control={
              <RadioGroup
                value={s.kisEnv}
                onChange={(v) => update({ kisEnv: v })}
                options={[
                  { value: 'vps',  label: '모의(vps)' },
                  { value: 'real', label: '실전' },
                ]}
              />
            }
          />
          <Row
            label="TEST_MODE"
            hint="dry-run · 실주문 차단"
            control={
              <Toggle
                checked={s.testMode}
                onChange={(v) => update({ testMode: v })}
              />
            }
          />
          <Row
            label="ALLOW_SHORT"
            hint="국내 개인 공매도 제약 — 강제 OFF"
            control={<Toggle checked={s.allowShort} onChange={() => {}} disabled />}
          />
        </Group>

        <Group title="파이프라인">
          <Row
            label="MTF 모드"
            hint="daily=W/D/15m, h4=D/4h/15m"
            control={
              <RadioGroup
                value={s.mtfMode}
                onChange={(v) => update({ mtfMode: v })}
                options={[
                  { value: 'daily', label: 'daily' },
                  { value: 'h4',    label: 'h4' },
                ]}
              />
            }
          />
          <Row
            label="시그널 품질 필터"
            hint="평균 R / 승률 floor 미달 종목 가지치기"
            control={
              <Toggle
                checked={s.qualityFilter}
                onChange={(v) => update({ qualityFilter: v })}
              />
            }
          />
          <Row
            label="유니버스 Top-N"
            hint="매일 08:00 KST 빌드"
            control={
              <span
                className="num-mono t-label"
                style={{ fontWeight: 600 }}
              >
                {s.topN}
              </span>
            }
          />
        </Group>

        <Group title="알림">
          <Row
            label={`${s.webhook.provider} 웹훅`}
            hint={s.webhook.connected ? '연결됨' : '미연결'}
            control={
              s.webhook.connected ? (
                <span
                  className="flex items-center gap-1 t-caption"
                  style={{ color: 'var(--state-positive)' }}
                >
                  <Check size={14} strokeWidth={2.5} /> OK
                </span>
              ) : (
                <span
                  className="t-caption"
                  style={{ color: 'var(--state-warning)' }}
                >
                  설정 필요
                </span>
              )
            }
          />
          {Object.entries({
            entry:        '진입 / 청산',
            reject:       'LLM 거절',
            stopOut:      'Stop-out',
            tickSummary:  '매 틱 요약',
          }).map(([key, label]) => (
            <Row
              key={key}
              label={label}
              control={
                <Toggle
                  checked={s.notifyChannels[key]}
                  onChange={(v) =>
                    update({
                      notifyChannels: { ...s.notifyChannels, [key]: v },
                    })
                  }
                />
              }
            />
          ))}
        </Group>

        <Group title="보안">
          <Row label="마스터 비밀번호 변경" control={<Button variant="ghost" size="sm">변경</Button>} />
          <Row label="세션" hint="남은 22일 / 30일" control={null} />
          <Row label="" control={<Button variant="secondary" size="sm">로그아웃</Button>} />
        </Group>
      </div>
    </>
  );
}
