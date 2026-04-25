import { useEffect, useState } from 'react';
import { Dices, Trash2 } from 'lucide-react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import IconButton from './IconButton.jsx';
import FormField from './FormField.jsx';
import FormInput from './FormInput.jsx';
import FormTextarea from './FormTextarea.jsx';
import FormPasswordInput from './FormPasswordInput.jsx';
import { generatePassword } from '../lib/vault.js';

export default function VaultEntryEditor({ open, entry, onSave, onDelete, onClose, readOnly = false }) {
  const [draft, setDraft] = useState(entry);

  useEffect(() => {
    if (open) setDraft(entry);
  }, [open, entry]);

  if (!draft) return null;

  const isNew = !entry?.updatedAt || entry.updatedAt === draft.updatedAt && !entry?.title;
  const canSave = (draft.title ?? '').trim().length > 0;

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const save = () => {
    if (!canSave) return;
    onSave({
      ...draft,
      title: draft.title.trim(),
      updatedAt: Date.now(),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={readOnly ? '자격증명 보기' : isNew ? '새 자격증명' : '자격증명 편집'}
      footer={
        readOnly ? (
          <Button variant="secondary" size="md" onClick={onClose}>
            닫기
          </Button>
        ) : (
          <>
            {!isNew && (
              <Button
                variant="ghost"
                size="md"
                icon={Trash2}
                onClick={() => onDelete?.(draft)}
                style={{ color: 'var(--state-negative)', border: 'none' }}
                className="mr-auto"
              >
                삭제
              </Button>
            )}
            <Button variant="secondary" size="md" onClick={onClose}>
              취소
            </Button>
            <Button variant="primary" size="md" disabled={!canSave} onClick={save}>
              저장
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="제목">
          <FormInput
            value={draft.title}
            onChange={(e) => set({ title: e.target.value.slice(0, 80) })}
            placeholder="예: Supabase · admin"
            autoFocus={!readOnly}
            readOnly={readOnly}
          />
        </FormField>

        <FormField label="아이디 / 이메일">
          <FormInput
            value={draft.username}
            onChange={(e) => set({ username: e.target.value })}
            placeholder=""
            autoComplete="off"
            readOnly={readOnly}
          />
        </FormField>

        <FormField label="비밀번호">
          <FormPasswordInput
            value={draft.password}
            onChange={(e) => set({ password: e.target.value })}
            readOnly={readOnly}
            trailing={
              !readOnly && (
                <IconButton
                  icon={Dices}
                  size="sm"
                  variant="clear"
                  ariaLabel="비밀번호 생성"
                  onClick={() => set({ password: generatePassword(20) })}
                />
              )
            }
          />
        </FormField>

        <FormField label="URL">
          <FormInput
            value={draft.url}
            onChange={(e) => set({ url: e.target.value })}
            placeholder="https://"
            autoComplete="off"
            readOnly={readOnly}
          />
        </FormField>

        <FormField label="메모">
          <FormTextarea
            value={draft.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="선택"
            rows={4}
            readOnly={readOnly}
          />
        </FormField>
      </div>
    </Modal>
  );
}
