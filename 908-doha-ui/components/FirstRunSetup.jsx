import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { createMember, MEMBER_COLORS } from '../lib/members.js';
import FormField from './FormField.jsx';
import FormInput from './FormInput.jsx';
import ColorPicker from './ColorPicker.jsx';

export default function FirstRunSetup() {
  const { refreshMembers, login } = useAuth();
  const [name, setName] = useState('');
  const [color, setColor] = useState(MEMBER_COLORS[0]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canSubmit =
    name.trim().length > 0 &&
    name.trim().length <= 20 &&
    password.length >= 4 &&
    password === confirm;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      const created = await createMember({ name: name.trim(), color, password });
      await refreshMembers();
      await login(created.id, password);
    } catch (err) {
      setError(err.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex min-h-full items-center justify-center px-5 py-10"
      style={{ background: 'var(--background)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{ background: 'var(--surface)', boxShadow: 'var(--elev-2)' }}
      >
        <header className="mb-7">
          <div className="t-caption" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            908doha Workspace
          </div>
          <h1 className="t-title2 mt-1">첫 멤버 만들기</h1>
          <p className="t-body2 mt-2" style={{ color: 'var(--text-secondary)' }}>
            본인 프로필을 먼저 등록하고 들어갑니다.
          </p>
        </header>

        <form onSubmit={submit} className="flex flex-col gap-5" autoComplete="on">
          <FormField label="이름" hint={`${name.length}/20`}>
            <FormInput
              name="nickname"
              autoComplete="nickname"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 20))}
              placeholder="예: 대건"
              autoFocus
            />
          </FormField>

          <FormField label="색">
            <ColorPicker value={color} onChange={setColor} />
          </FormField>

          <FormField label="비밀번호" hint="최소 4자">
            <FormInput
              type="password"
              name="new-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>

          <FormField
            label="비밀번호 확인"
            hint={confirm && password !== confirm ? '일치하지 않음' : undefined}
            tone={confirm && password !== confirm ? 'negative' : undefined}
          >
            <FormInput
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </FormField>

          {error && (
            <div
              className="t-caption rounded-md px-3 py-2"
              style={{ background: 'var(--state-negative-soft)', color: 'var(--state-negative)' }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="flex items-center justify-center rounded-md t-label"
            style={{
              height: 44,
              marginTop: 4,
              background: !canSubmit || busy ? 'var(--surface-sunken)' : 'var(--accent-brand)',
              color: !canSubmit || busy ? 'var(--text-tertiary)' : 'var(--text-inverted)',
              transition: 'background 160ms var(--ease-soft)',
            }}
          >
            {busy ? '만드는 중…' : '시작하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
