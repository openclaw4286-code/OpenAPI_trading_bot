import { useState } from 'react';
import {
  Plus, Trash2, Search, Settings, ChevronDown, Send, Heart, Pencil, Bell,
} from 'lucide-react';
import ScreenHeader from '../components/ScreenHeader.jsx';
import Button from '@ds/components/Button.jsx';
import IconButton from '@ds/components/IconButton.jsx';
import FormField from '@ds/components/FormField.jsx';
import FormInput from '@ds/components/FormInput.jsx';
import FormPasswordInput from '@ds/components/FormPasswordInput.jsx';
import FormTextarea from '@ds/components/FormTextarea.jsx';
import FormSelect from '@ds/components/FormSelect.jsx';
import SearchField from '@ds/components/SearchField.jsx';
import Skeleton from '@ds/components/Skeleton.jsx';
import EmptyScaffold from '@ds/components/EmptyScaffold.jsx';
import VaultEntry from '@ds/components/VaultEntry.jsx';
import NoteCard from '@ds/components/NoteCard.jsx';
import TaskCard from '@ds/components/TaskCard.jsx';
import MemberAvatar from '@ds/components/MemberAvatar.jsx';
import Modal from '@ds/components/Modal.jsx';
import Toast from '@ds/components/Toast.jsx';

// Design-system audit page. Renders every 908-doha-ui primitive in
// isolation so the operator can verify the design tokens / typography
// / spacing match the documented Toss-grade DNA. If THIS page looks
// off, the issue is in the design-system files (908-doha-ui/), not in
// how the mobile dashboard composes them. If this page looks good and
// the rest of the app looks weak, the composition is the bug.

function Block({ title, children }) {
  return (
    <section
      className="rounded-2xl p-4"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <h3
        className="t-caption mb-3"
        style={{
          color: 'var(--text-tertiary)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        {title}
      </h3>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </section>
  );
}

const MEMBERS = [
  { id: 'a', name: '도하', color: '#0064FF' },
  { id: 'b', name: '서연', color: '#1E8443' },
  { id: 'c', name: '민준', color: '#D23826' },
];

const SAMPLE_NOTE = {
  id: 'n1',
  title: '오늘의 매매 일지',
  blocks: [
    { id: 'b1', type: 'text', text: '삼성전자 005930 진입. ICT FVG POI 미체결.' },
    { id: 'b2', type: 'bullet', text: 'TP1 +0.5R 체결' },
    { id: 'b3', type: 'check', text: 'BE 이동 확인', checked: true },
  ],
  tags: ['삼성전자', 'ICT', 'FVG'],
  pinned: true,
  updatedAt: Date.now(),
  createdBy: 'a',
  updatedBy: 'a',
};

const SAMPLE_TASK = {
  id: 't1',
  title: 'STEP 21: 4h MTF 데이터 파이프라인 검증',
  description: 'KIS historical-minute endpoint로 4h 봉 합성 → 백테스트 RMSE < 0.5%',
  priority: 'high',
  dueDate: '2026-04-30',
  assignees: ['a', 'b'],
  status: 'doing',
  createdBy: 'c',
};

export default function Showcase() {
  const [text, setText] = useState('');
  const [pwd, setPwd] = useState('');
  const [longText, setLongText] = useState('');
  const [select, setSelect] = useState('high');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);

  return (
    <>
      <ScreenHeader title="Design Audit" />
      <div className="flex flex-col gap-3 p-4 pb-8">
        <p
          className="t-body2 px-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          908-doha-ui 컴포넌트를 그대로 렌더링한 페이지입니다. 이 화면이
          토스 무게로 보이면 디자인 시스템 파일은 정상 — 다른 화면이 약해
          보이는 건 조합 방식 문제입니다.
        </p>

        <Block title="Button · variants × sizes">
          <Button variant="primary" size="lg">Confirm</Button>
          <Button variant="secondary" size="lg">Save draft</Button>
          <Button variant="ghost" size="lg">Learn more</Button>
          <Button variant="danger" size="lg" icon={Trash2}>Delete</Button>
          <Button variant="primary" size="lg" disabled>Disabled</Button>
        </Block>

        <Block title="Button · sizes">
          <Button variant="primary" size="xl">XL · 56</Button>
          <Button variant="primary" size="lg">LG · 48</Button>
          <Button variant="primary" size="md">MD · 40</Button>
          <Button variant="primary" size="sm">SM · 32</Button>
        </Block>

        <Block title="IconButton · variants">
          <IconButton icon={Plus}     variant="brand"  size="lg" ariaLabel="add" />
          <IconButton icon={Heart}    variant="fill"   size="lg" ariaLabel="like" />
          <IconButton icon={Settings} variant="border" size="lg" ariaLabel="settings" />
          <IconButton icon={Search}   variant="clear"  size="lg" ariaLabel="search" />
          <IconButton icon={Trash2}   variant="danger" size="lg" ariaLabel="delete" />
        </Block>

        <Block title="MemberAvatar · sizes">
          <MemberAvatar member={MEMBERS[0]} size={16} />
          <MemberAvatar member={MEMBERS[1]} size={24} />
          <MemberAvatar member={MEMBERS[2]} size={32} />
          <MemberAvatar member={MEMBERS[0]} size={44} />
          <MemberAvatar member={MEMBERS[1]} size={64} />
        </Block>

        <Block title="Form · inputs">
          <div className="flex w-full flex-col gap-3">
            <FormField label="이메일" hint="회사 도메인만 허용됩니다.">
              <FormInput
                value={text}
                onChange={setText}
                placeholder="user@company.kr"
              />
            </FormField>
            <FormField label="비밀번호">
              <FormPasswordInput value={pwd} onChange={setPwd} placeholder="••••••••" />
            </FormField>
            <FormField label="우선순위">
              <FormSelect
                value={select}
                onChange={setSelect}
                options={[
                  { value: 'high', label: '높음' },
                  { value: 'mid', label: '보통' },
                  { value: 'low', label: '낮음' },
                ]}
              />
            </FormField>
            <FormField label="설명">
              <FormTextarea
                value={longText}
                onChange={setLongText}
                placeholder="여러 줄 입력 가능…"
              />
            </FormField>
          </div>
        </Block>

        <Block title="SearchField">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="검색"
            className="w-full"
          />
        </Block>

        <Block title="Skeleton">
          <div className="flex w-full flex-col gap-2">
            <Skeleton width="60%" height={16} />
            <Skeleton width="100%" height={16} />
            <Skeleton width="40%" height={16} />
            <Skeleton width="100%" height={120} rounded={12} />
          </div>
        </Block>

        <Block title="VaultEntry">
          <div className="flex w-full flex-col gap-2">
            <VaultEntry
              entry={{ title: 'Gmail', username: 'doha@gmail.com', url: 'gmail.com' }}
              onOpen={() => {}}
              onCopyPassword={() => {}}
              onCopyUsername={() => {}}
            />
            <VaultEntry
              entry={{ title: 'GitHub', username: 'openclaw4286-code' }}
              onOpen={() => {}}
              onCopyPassword={() => {}}
              onCopyUsername={() => {}}
            />
          </div>
        </Block>

        <Block title="NoteCard">
          <div className="w-full">
            <NoteCard note={SAMPLE_NOTE} onOpen={() => {}} />
          </div>
        </Block>

        <Block title="TaskCard">
          <div className="w-full">
            <TaskCard task={SAMPLE_TASK} onOpen={() => {}} />
          </div>
        </Block>

        <Block title="EmptyScaffold">
          <div className="w-full">
            <EmptyScaffold
              title="아직 신호가 없어요"
              subtitle="장이 열리면 자동으로 채워집니다."
              spec="signals.json"
            />
          </div>
        </Block>

        <Block title="Modal · Toast triggers">
          <Button variant="primary" size="lg" onClick={() => setModalOpen(true)}>
            Open modal
          </Button>
          <Button variant="secondary" size="lg" onClick={() => setShowToast(true)}>
            Show toast
          </Button>
        </Block>

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="모달 예시"
          footer={
            <>
              <Button variant="secondary" size="md" onClick={() => setModalOpen(false)}>
                취소
              </Button>
              <Button variant="primary" size="md" onClick={() => setModalOpen(false)}>
                확인
              </Button>
            </>
          }
        >
          <p className="t-body1" style={{ color: 'var(--text-secondary)' }}>
            모달은 ESC 키나 바깥 영역 클릭으로 닫을 수 있습니다.
          </p>
        </Modal>

        {showToast && (
          <div
            className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-5"
            onAnimationEnd={() => {
              setTimeout(() => setShowToast(false), 2000);
            }}
          >
            <Toast
              tone="success"
              message="저장되었습니다"
              onDismiss={() => setShowToast(false)}
            />
          </div>
        )}
      </div>
    </>
  );
}
