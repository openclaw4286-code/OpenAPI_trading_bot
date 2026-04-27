import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import Modal from './Modal.jsx';
import MemberAvatar from './MemberAvatar.jsx';
import FormField from './FormField.jsx';
import FormInput from './FormInput.jsx';
import FormTextarea from './FormTextarea.jsx';
import FormSelect from './FormSelect.jsx';
import FormMemberMultiSelect from './FormMemberMultiSelect.jsx';
import Button from './Button.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useViewport } from '../contexts/ViewportContext.jsx';
import { STATUSES, PRIORITIES, STATUS_LABELS, PRIORITY_LABELS } from '../lib/tasks.js';

const TITLE_MAX = 100;
const DESC_MAX = 1000;

const STATUS_OPTIONS = STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }));
const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }));

export default function TaskEditor({ open, task, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(task);
  const { members } = useAuth();
  const { canMutateTasks } = useViewport();
  const readOnly = !canMutateTasks;

  useEffect(() => {
    if (open) setDraft(task);
  }, [open, task]);

  if (!draft) return null;

  const isNew = !task?.title;
  const creator = members.find((m) => m.id === draft.createdBy);
  const editor = members.find((m) => m.id === draft.updatedBy);
  const canSave = draft.title.trim().length > 0 && draft.title.length <= TITLE_MAX;

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const save = () => {
    if (!canSave) return;
    onSave({ ...draft, title: draft.title.trim() });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={readOnly ? '작업 보기' : isNew ? '새 작업' : '작업 편집'}
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
      <div className="flex flex-col gap-5">
        <FormField label="제목" hint={`${draft.title.length}/${TITLE_MAX}`}>
          <FormInput
            value={draft.title}
            onChange={(e) => set({ title: e.target.value.slice(0, TITLE_MAX) })}
            placeholder="무엇을 처리하나요?"
            autoFocus={!readOnly}
            readOnly={readOnly}
          />
        </FormField>

        <FormField label="설명" hint={`${draft.description.length}/${DESC_MAX}`}>
          <FormTextarea
            value={draft.description}
            onChange={(e) => set({ description: e.target.value.slice(0, DESC_MAX) })}
            placeholder="상세 설명 · 선택"
            rows={8}
            style={{ minHeight: 200 }}
            readOnly={readOnly}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="상태">
            <FormSelect
              value={draft.status}
              onChange={(v) => set({ status: v })}
              options={STATUS_OPTIONS}
              disabled={readOnly}
            />
          </FormField>
          <FormField label="우선순위">
            <FormSelect
              value={draft.priority}
              onChange={(v) => set({ priority: v })}
              options={PRIORITY_OPTIONS}
              disabled={readOnly}
            />
          </FormField>
        </div>

        <FormField label="담당자" hint={draft.assignees?.length ? `${draft.assignees.length}명` : null}>
          <FormMemberMultiSelect
            value={draft.assignees ?? []}
            onChange={(ids) => set({ assignees: ids })}
            members={members}
            disabled={readOnly}
          />
        </FormField>

        <FormField label="마감일">
          <FormInput
            type="date"
            value={draft.dueDate}
            onChange={(e) => set({ dueDate: e.target.value })}
            readOnly={readOnly}
          />
        </FormField>

        {!isNew && (creator || editor) && (
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 t-caption"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}
          >
            {creator && (
              <span className="inline-flex items-center gap-1.5">
                작성 <MemberAvatar member={creator} size={16} /> {creator.name}
              </span>
            )}
            {editor && (
              <span className="inline-flex items-center gap-1.5">
                최근 수정 <MemberAvatar member={editor} size={16} /> {editor.name}
              </span>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
