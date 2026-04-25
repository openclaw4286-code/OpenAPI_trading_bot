import { useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import MemberAvatar from './MemberAvatar.jsx';
import FormField from './FormField.jsx';
import FormInput from './FormInput.jsx';

export default function LoginScreen() {
  const { members, login } = useAuth();
  const [picked, setPicked] = useState(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!picked || !password) return;
    setBusy(true);
    setError('');
    try {
      await login(picked.id, password);
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
          <div
            className="t-caption"
            style={{ color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            908doha Workspace
          </div>
          <h1 className="t-title2 mt-1">{picked ? picked.name : '누구세요?'}</h1>
          <p className="t-body2 mt-2" style={{ color: 'var(--text-secondary)' }}>
            {picked ? '비밀번호를 입력해 들어가세요.' : '프로필을 선택하면 비밀번호를 물어봅니다.'}
          </p>
        </header>

        {!picked ? (
          <div className="flex flex-col gap-1.5">
            {members.map((m) => (
              <MemberTile key={m.id} member={m} onPick={() => setPicked(m)} />
            ))}
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-5" autoComplete="on">
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: 'var(--surface-layered)' }}
            >
              <MemberAvatar member={picked} size={32} />
              <span className="t-body1" style={{ fontWeight: 500 }}>
                {picked.name}
              </span>
            </div>

            <FormField label="비밀번호">
              <FormInput
                type="password"
                name="current-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                disabled={busy}
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
              disabled={!password || busy}
              className="flex items-center justify-center rounded-md t-label"
              style={{
                height: 44,
                background:
                  !password || busy ? 'var(--surface-sunken)' : 'var(--accent-brand)',
                color:
                  !password || busy ? 'var(--text-tertiary)' : 'var(--text-inverted)',
                transition: 'background 160ms var(--ease-soft)',
              }}
            >
              {busy ? '확인 중…' : '로그인'}
            </button>

            <button
              type="button"
              onClick={() => {
                setPicked(null);
                setPassword('');
                setError('');
              }}
              className="flex items-center justify-center gap-1.5 t-label"
              style={{ height: 32, color: 'var(--text-secondary)' }}
            >
              <ArrowLeft size={14} strokeWidth={1.75} />
              다른 멤버 선택
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function MemberTile({ member, onPick }) {
  const enabled = member.hasPassword;
  return (
    <button
      onClick={onPick}
      disabled={!enabled}
      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left"
      style={{
        background: 'transparent',
        color: enabled ? 'var(--text-primary)' : 'var(--text-tertiary)',
        cursor: enabled ? 'pointer' : 'not-allowed',
        transition: 'background 160ms var(--ease-soft)',
      }}
      onMouseEnter={(e) => {
        if (enabled) e.currentTarget.style.background = 'var(--surface-layered)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <MemberAvatar member={member} size={32} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="t-body1" style={{ fontWeight: 500 }}>
          {member.name}
        </span>
        {!enabled && (
          <span className="t-caption" style={{ color: 'var(--text-tertiary)' }}>
            비밀번호 미설정
          </span>
        )}
      </div>
      {enabled && (
        <ChevronRight size={16} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)' }} />
      )}
    </button>
  );
}
