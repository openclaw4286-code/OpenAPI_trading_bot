import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import FormField from './FormField.jsx';
import FormInput from './FormInput.jsx';
import FormTextarea from './FormTextarea.jsx';
import ColorPicker from './ColorPicker.jsx';
import { MEMBER_COLORS } from '../lib/members.js';

export default function MemberEditor({ open, member, onSave, onDelete, onClose, isSelf, readOnly = false }) {
  const isNew = !member?.id;
  const [name, setName] = useState('');
  const [color, setColor] = useState(MEMBER_COLORS[0]);
  const [role, setRole] = useState('');
  const [bio, setBio] = useState('');
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(member?.name ?? '');
    setColor(member?.color ?? MEMBER_COLORS[0]);
    setRole(member?.role ?? '');
    setBio(member?.bio ?? '');
    setContact(member?.contact ?? '');
    setPassword('');
    setConfirm('');
  }, [open, member]);

  const nameOk = name.trim().length > 0 && name.trim().length <= 20;
  const pwOk =
    (isNew ? password.length >= 4 : password === '' || password.length >= 4) &&
    password === confirm;
  const canSave = nameOk && pwOk;

  const save = () => {
    if (!canSave) return;
    onSave({
      id: member?.id,
      name: name.trim(),
      color,
      role: role.trim(),
      bio: bio.trim(),
      contact: contact.trim(),
      password: password || undefined,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={readOnly ? '멤버 보기' : isNew ? '멤버 추가' : '멤버 편집'}
      footer={
        readOnly ? (
          <Button variant="secondary" size="md" onClick={onClose}>
            닫기
          </Button>
        ) : (
          <>
            {!isNew && !isSelf && (
              <Button
                variant="ghost"
                size="md"
                icon={Trash2}
                onClick={() => onDelete?.(member)}
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
        <FormField label="이름" hint={`${name.length}/20`}>
          <FormInput
            name="member-name"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 20))}
            autoFocus
          />
        </FormField>

        <FormField label="역할 / 직무">
          <FormInput
            name="member-role"
            autoComplete="off"
            value={role}
            onChange={(e) => setRole(e.target.value.slice(0, 40))}
            placeholder="예: 디자이너, 백엔드"
          />
        </FormField>

        <FormField label="연락처">
          <FormInput
            name="member-contact"
            autoComplete="off"
            value={contact}
            onChange={(e) => setContact(e.target.value.slice(0, 80))}
            placeholder="이메일, 전화 등"
          />
        </FormField>

        <FormField label="소개" hint={`${bio.length}/200`}>
          <FormTextarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 200))}
            placeholder="짧게 자기 소개"
            rows={3}
          />
        </FormField>

        <FormField label="색">
          <ColorPicker value={color} onChange={setColor} />
        </FormField>

        <FormField
          label={isNew ? '비밀번호' : '새 비밀번호'}
          hint={isNew ? '최소 4자' : '변경 시에만 입력'}
        >
          <FormInput
            type="password"
            name="new-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>

        {password && (
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
        )}

        {isSelf && !isNew && (
          <div
            className="t-caption rounded-md px-3 py-2"
            style={{ background: 'var(--state-info-soft)', color: 'var(--text-secondary)' }}
          >
            본인 계정은 이 화면에서 삭제할 수 없습니다.
          </div>
        )}
      </div>
    </Modal>
  );
}
