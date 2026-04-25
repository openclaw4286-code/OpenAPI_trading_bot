import { useState } from 'react';
import { Lock, ShieldAlert, Unlock } from 'lucide-react';
import Button from './Button.jsx';
import FormField from './FormField.jsx';
import FormPasswordInput from './FormPasswordInput.jsx';

// Dual-purpose screen: if no vault row exists the form is "set master
// password"; otherwise it's "unlock". Parent chooses mode via `isInit`.

export default function VaultUnlock({ isInit, busy, onSubmit }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!password) return;
    if (isInit && password.length < 8) {
      setError('최소 8자 이상');
      return;
    }
    if (isInit && password !== confirm) {
      setError('확인 비밀번호가 다릅니다');
      return;
    }
    try {
      setError('');
      await onSubmit(password);
    } catch (err) {
      setError(err.message ?? String(err));
    }
  };

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-5 px-5 py-16 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: 'var(--accent-brand-soft)', color: 'var(--accent-brand)' }}
      >
        <Lock size={24} strokeWidth={1.75} />
      </div>
      <div className="flex flex-col gap-1.5">
        <h2 className="t-title3">Vault</h2>
        <p className="t-body2" style={{ color: 'var(--text-secondary)' }}>
          {isInit
            ? '마스터 비밀번호를 정하세요. 이 보관함을 여는 열쇠입니다.'
            : '팀 자격증명 보관함. 마스터 비밀번호로 잠금 해제.'}
        </p>
      </div>

      <div
        className="flex w-full items-start gap-2.5 rounded-lg px-3.5 py-3 text-left"
        style={{ background: 'var(--state-warning-soft)' }}
      >
        <ShieldAlert
          size={16}
          strokeWidth={1.75}
          style={{ color: 'var(--state-warning)', flexShrink: 0, marginTop: 2 }}
        />
        <p className="t-caption" style={{ color: 'var(--text-secondary)' }}>
          마스터 비밀번호 분실 시 복구가 불가능해요. 안전한 채널로 공유·보관하세요.
        </p>
      </div>

      <form onSubmit={submit} className="flex w-full flex-col gap-3">
        <FormField label={isInit ? '새 마스터 비밀번호' : '마스터 비밀번호'}>
          <FormPasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete={isInit ? 'new-password' : 'current-password'}
            name="vault-master"
            placeholder={isInit ? '최소 8자' : ''}
          />
        </FormField>

        {isInit && (
          <FormField label="비밀번호 확인">
            <FormPasswordInput
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              name="vault-master-confirm"
            />
          </FormField>
        )}

        {error && (
          <div
            className="t-caption rounded-md px-3 py-2 text-left"
            style={{ background: 'var(--state-negative-soft)', color: 'var(--state-negative)' }}
          >
            {error}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          icon={isInit ? Lock : Unlock}
          disabled={busy || !password}
          className="w-full"
        >
          {busy ? '처리 중…' : isInit ? '보관함 만들기' : '잠금 해제'}
        </Button>
      </form>
    </div>
  );
}
