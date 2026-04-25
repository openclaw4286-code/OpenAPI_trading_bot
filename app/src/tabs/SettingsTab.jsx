import { useEffect, useState } from 'react';
import { Plus, KeyRound, ChevronRight, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { useViewport } from '../contexts/ViewportContext.jsx';
import { createMember, updateMember, deleteMember } from '../lib/members.js';
import { changeMasterPassword, fetchVaultRow } from '../lib/vault.js';
import MemberAvatar from '../components/MemberAvatar.jsx';
import MemberEditor from '../components/MemberEditor.jsx';
import Button from '../components/Button.jsx';
import VaultPasswordModal from '../components/VaultPasswordModal.jsx';

export default function SettingsTab() {
  const { members, currentUser, refreshMembers } = useAuth();
  const toast = useToast();
  const { canMutateSettings } = useViewport();
  const readOnly = !canMutateSettings;
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [vaultExists, setVaultExists] = useState(false);
  const [vaultModal, setVaultModal] = useState(false);
  const [vaultBusy, setVaultBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const row = await fetchVaultRow();
        setVaultExists(!!row);
      } catch {
        setVaultExists(false);
      }
    })();
  }, []);

  const submitVaultChange = async (current, next) => {
    setVaultBusy(true);
    try {
      await changeMasterPassword(current, next, currentUser?.id ?? null);
      setVaultModal(false);
      toast.success('Vault 비밀번호를 변경했어요');
    } finally {
      setVaultBusy(false);
    }
  };

  const save = async (input) => {
    try {
      if (input.id) await updateMember(input.id, input);
      else await createMember(input);
      await refreshMembers();
      setEditing(null);
      setError('');
    } catch (e) {
      setError(`저장 실패: ${e.message ?? e}`);
    }
  };

  const remove = async (m) => {
    if (!confirm(`"${m.name}" 멤버를 삭제할까요? 연결된 작성 이력은 유지되지만 작성자 표시가 사라집니다.`)) return;
    try {
      await deleteMember(m.id);
      await refreshMembers();
      setEditing(null);
    } catch (e) {
      setError(`삭제 실패: ${e.message ?? e}`);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-5 py-6">
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="t-heading1">멤버</h2>
          {!readOnly && (
            <button
              onClick={() => setEditing({})}
              className="flex h-9 items-center gap-1.5 rounded-md px-3 t-label"
              style={{ background: 'var(--accent-brand)', color: 'var(--text-inverted)' }}
            >
              <Plus size={16} strokeWidth={2} />
              멤버 추가
            </button>
          )}
        </div>

        {error && (
          <div
            className="t-caption mb-3 rounded-md px-3 py-2"
            style={{ background: 'var(--state-negative-soft)', color: 'var(--state-negative)' }}
          >
            {error}
          </div>
        )}

        <div
          className="divide-y overflow-hidden rounded-xl border"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface)' }}
        >
          {members.map((m) => {
            const isSelf = m.id === currentUser?.id;
            return (
              <button
                key={m.id}
                onClick={() => !readOnly && setEditing(m)}
                disabled={readOnly}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                style={{
                  borderColor: 'var(--border-subtle)',
                  transition: 'background 160ms var(--ease-soft)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-layered)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <MemberAvatar member={m} size={32} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="t-body1" style={{ fontWeight: 500 }}>
                    {m.name}
                    {isSelf && (
                      <span
                        className="t-caption ml-2 rounded-full px-1.5 py-0.5"
                        style={{ background: 'var(--accent-brand-soft)', color: 'var(--text-brand)' }}
                      >
                        나
                      </span>
                    )}
                  </span>
                  <span className="t-caption inline-flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                    {m.hasPassword ? (
                      <>
                        <KeyRound size={11} strokeWidth={1.75} />
                        비밀번호 설정됨
                      </>
                    ) : (
                      '비밀번호 미설정 — 편집해서 설정하세요'
                    )}
                  </span>
                </div>
                <ChevronRight size={16} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)' }} />
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="t-heading1">Vault</h2>
        </div>
        <div
          className="flex items-center gap-3 rounded-xl border p-4"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface)' }}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--accent-brand-soft)', color: 'var(--accent-brand)' }}
          >
            <Lock size={18} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="t-body2" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
              마스터 비밀번호
            </div>
            <div className="t-caption" style={{ color: 'var(--text-tertiary)' }}>
              {vaultExists
                ? '보관함을 여는 단일 비밀번호. 변경 시 모든 항목이 새 키로 다시 암호화됩니다.'
                : '아직 보관함이 만들어지지 않았어요. Vault 탭에서 처음 비밀번호를 설정하세요.'}
            </div>
          </div>
          <Button
            variant="secondary"
            size="md"
            disabled={!vaultExists || readOnly}
            onClick={() => setVaultModal(true)}
          >
            변경
          </Button>
        </div>
      </section>

      <MemberEditor
        open={!!editing}
        member={editing}
        isSelf={editing?.id === currentUser?.id}
        onSave={save}
        onDelete={remove}
        onClose={() => setEditing(null)}
        readOnly={readOnly}
      />

      <VaultPasswordModal
        open={vaultModal}
        busy={vaultBusy}
        onSubmit={submitVaultChange}
        onClose={() => setVaultModal(false)}
      />
    </div>
  );
}
