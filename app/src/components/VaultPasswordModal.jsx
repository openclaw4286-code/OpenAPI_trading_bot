import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import FormField from './FormField.jsx';
import FormPasswordInput from './FormPasswordInput.jsx';

const MIN_LEN = 8;

export default function VaultPasswordModal({ open, busy, onSubmit, onClose }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setCurrent('');
      setNext('');
      setConfirm('');
      setError('');
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (!current) {
      setError('현재 비밀번호를 입력해주세요');
      return;
    }
    if (next.length < MIN_LEN) {
      setError(`새 비밀번호는 최소 ${MIN_LEN}자입니다`);
      return;
    }
    if (next !== confirm) {
      setError('새 비밀번호 확인이 일치하지 않아요');
      return;
    }
    if (next === current) {
      setError('현재와 동일한 비밀번호입니다');
      return;
    }
    try {
      setError('');
      await onSubmit(current, next);
    } catch (err) {
      setError(err.message ?? String(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Vault 비밀번호 변경"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={busy || !current || !next || !confirm}
            onClick={submit}
          >
            {busy ? '변경 중…' : '변경'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        <FormField label="현재 비밀번호">
          <FormPasswordInput
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoFocus
            autoComplete="current-password"
            name="vault-current"
          />
        </FormField>
        <FormField label="새 비밀번호" hint={`최소 ${MIN_LEN}자`}>
          <FormPasswordInput
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            name="vault-new"
          />
        </FormField>
        <FormField label="새 비밀번호 확인">
          <FormPasswordInput
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            name="vault-new-confirm"
          />
        </FormField>
        {error && (
          <div
            className="t-caption rounded-md px-3 py-2 text-left"
            style={{
              background: 'var(--state-negative-soft)',
              color: 'var(--state-negative)',
            }}
          >
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
