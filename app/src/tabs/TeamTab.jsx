import { useEffect, useMemo, useRef, useState } from 'react';
import { Briefcase, Clock, Mail, Pencil, Play, Square } from 'lucide-react';
import Button from '../components/Button.jsx';
import IconButton from '../components/IconButton.jsx';
import MemberAvatar from '../components/MemberAvatar.jsx';
import MemberEditor from '../components/MemberEditor.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { useViewport } from '../contexts/ViewportContext.jsx';
import { updateMember } from '../lib/members.js';
import {
  clockIn,
  clockOut,
  findOpenLog,
  formatHM,
  formatTimeOfDay,
  listLogsSince,
  startOfWeek,
  totalsForMember,
} from '../lib/team.js';

export default function TeamTab() {
  const { members, currentUser, refreshMembers } = useAuth();
  const toast = useToast();
  const { canMutateTeam } = useViewport();
  const readOnly = !canMutateTeam;

  const [logs, setLogs] = useState([]);
  const [openLog, setOpenLog] = useState(null);
  const [editing, setEditing] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [loaded, setLoaded] = useState(false);
  const tickRef = useRef(null);

  const refresh = async () => {
    if (!currentUser) return;
    try {
      const since = startOfWeek();
      const [list, open] = await Promise.all([
        listLogsSince(since),
        findOpenLog(currentUser.id),
      ]);
      setLogs(list);
      setOpenLog(open);
    } catch (e) {
      toast.error(`불러오기 실패: ${e.message ?? e}`);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Tick every minute so the running timer + today/week totals advance.
  useEffect(() => {
    if (!openLog) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    setNow(Date.now());
    tickRef.current = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [openLog]);

  const handleClockIn = async () => {
    if (!currentUser) return;
    try {
      const log = await clockIn(currentUser.id);
      setOpenLog(log);
      setLogs((list) => [log, ...list]);
      toast.success('출근 기록을 시작했어요');
    } catch (e) {
      toast.error(`기록 실패: ${e.message ?? e}`);
    }
  };

  const handleClockOut = async () => {
    if (!openLog) return;
    try {
      const ended = await clockOut(openLog.id);
      setOpenLog(null);
      setLogs((list) => list.map((l) => (l.id === ended.id ? ended : l)));
      toast.success(`퇴근! 오늘 ${formatHM(ended.endedAt - ended.startedAt)} 일했어요`);
    } catch (e) {
      toast.error(`기록 실패: ${e.message ?? e}`);
    }
  };

  const saveProfile = async (input) => {
    try {
      await updateMember(input.id, input);
      await refreshMembers();
      setEditing(null);
      toast.success('프로필을 저장했어요');
    } catch (e) {
      toast.error(`저장 실패: ${e.message ?? e}`);
    }
  };

  const sortedMembers = useMemo(() => {
    if (!currentUser) return members;
    return [
      ...members.filter((m) => m.id === currentUser.id),
      ...members.filter((m) => m.id !== currentUser.id),
    ];
  }, [members, currentUser]);

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="t-title3">Team</h2>
        <span className="t-caption" style={{ color: 'var(--text-tertiary)' }}>
          {members.length}명
        </span>
      </div>

      {!loaded ? (
        <TeamSkeleton count={Math.max(3, members.length || 4)} />
      ) : (
        <>
          {currentUser && (
            <SelfTimeCard
              user={currentUser}
              openLog={openLog}
              now={now}
              onClockIn={handleClockIn}
              onClockOut={handleClockOut}
              onEdit={() => setEditing(currentUser)}
              totals={totalsForMember(logs, currentUser.id, now)}
              readOnly={readOnly}
            />
          )}

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedMembers.map((m) => {
              const totals = totalsForMember(logs, m.id, now);
              const memberOpen = m.id === currentUser?.id ? openLog : null;
              return (
                <MemberCard
                  key={m.id}
                  member={m}
                  isSelf={m.id === currentUser?.id}
                  totals={totals}
                  activeSince={memberOpen?.startedAt}
                  onEdit={() => setEditing(m)}
                  readOnly={readOnly}
                />
              );
            })}
          </div>
        </>
      )}

      <MemberEditor
        open={!!editing}
        member={editing}
        isSelf={editing?.id === currentUser?.id}
        onSave={saveProfile}
        onDelete={null}
        onClose={() => setEditing(null)}
        readOnly={readOnly}
      />
    </div>
  );
}

function SelfTimeCard({ user, openLog, now, onClockIn, onClockOut, onEdit, totals, readOnly }) {
  const elapsed = openLog ? now - openLog.startedAt : 0;
  return (
    <section
      className="flex flex-wrap items-center gap-4 rounded-2xl border p-5"
      style={{
        borderColor: 'var(--border-subtle)',
        background: 'var(--surface)',
        boxShadow: 'var(--elev-1)',
      }}
    >
      <MemberAvatar member={user} size={56} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span
            className="t-heading1 truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {user.name}
          </span>
          <span
            className="t-caption rounded-full px-2 py-0.5"
            style={{
              background: 'var(--accent-brand-soft)',
              color: 'var(--text-brand)',
            }}
          >
            나
          </span>
        </div>
        <div
          className="t-caption mt-0.5"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {openLog ? (
            <>
              <span style={{ color: 'var(--state-positive)' }}>● 근무 중</span> ·{' '}
              {formatTimeOfDay(openLog.startedAt)} 시작 · 진행 {formatHM(elapsed)}
            </>
          ) : (
            <>오늘 {formatHM(totals.todayMs)} · 이번 주 {formatHM(totals.weekMs)}</>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2">
          <IconButton
            icon={Pencil}
            size="md"
            variant="clear"
            ariaLabel="내 정보 수정"
            onClick={onEdit}
          />
          {openLog ? (
            <Button variant="secondary" size="md" icon={Square} onClick={onClockOut}>
              퇴근
            </Button>
          ) : (
            <Button variant="primary" size="md" icon={Play} onClick={onClockIn}>
              출근
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function MemberCard({ member, isSelf, totals, activeSince, onEdit, readOnly }) {
  return (
    <article
      className="flex flex-col gap-3 rounded-xl border p-4"
      style={{
        borderColor: 'var(--border-subtle)',
        background: 'var(--surface)',
      }}
    >
      <div className="flex items-start gap-3">
        <MemberAvatar member={member} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="t-body1 truncate"
              style={{ fontWeight: 600, color: 'var(--text-primary)' }}
            >
              {member.name}
            </span>
            {isSelf && (
              <span
                className="t-caption rounded-full px-1.5 py-0.5"
                style={{
                  background: 'var(--accent-brand-soft)',
                  color: 'var(--text-brand)',
                }}
              >
                나
              </span>
            )}
          </div>
          {member.role && (
            <div
              className="mt-0.5 inline-flex items-center gap-1.5 t-caption"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Briefcase size={11} strokeWidth={1.75} />
              {member.role}
            </div>
          )}
        </div>
        {isSelf && !readOnly && (
          <IconButton
            icon={Pencil}
            size="sm"
            variant="clear"
            ariaLabel="수정"
            onClick={onEdit}
          />
        )}
      </div>

      {member.bio && (
        <p
          className="t-body2 line-clamp-3 whitespace-pre-wrap"
          style={{ color: 'var(--text-secondary)' }}
        >
          {member.bio}
        </p>
      )}

      {member.contact && (
        <div
          className="inline-flex items-center gap-1.5 t-caption"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <Mail size={11} strokeWidth={1.75} />
          <span className="truncate">{member.contact}</span>
        </div>
      )}

      <div
        className="mt-auto flex items-center justify-between border-t pt-3 t-caption"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}
      >
        <span className="inline-flex items-center gap-1.5">
          <Clock size={11} strokeWidth={1.75} />
          오늘 {formatHM(totals.todayMs)}
        </span>
        <span>이번 주 {formatHM(totals.weekMs)}</span>
      </div>

      {activeSince && (
        <div
          className="t-caption inline-flex items-center gap-1.5 rounded-md px-2 py-1"
          style={{
            background: 'var(--state-positive-soft)',
            color: 'var(--state-positive)',
            alignSelf: 'flex-start',
          }}
        >
          ● {formatTimeOfDay(activeSince)} 부터 근무 중
        </div>
      )}
    </article>
  );
}


function TeamSkeleton({ count = 4 }) {
  return (
    <>
      <section
        className="rounded-2xl border p-5"
        style={{ background: "var(--surface)", borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-3">
          <Skeleton width={48} height={48} circle />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton width={120} height={16} />
            <Skeleton width={80} height={12} />
          </div>
          <Skeleton width={88} height={36} rounded={10} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton width={36} height={10} />
              <Skeleton width={60} height={18} style={{ marginTop: 6 }} />
            </div>
          ))}
        </div>
      </section>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <article
            key={i}
            className="rounded-2xl border p-4"
            style={{ background: "var(--surface)", borderColor: "var(--border-subtle)" }}
          >
            <div className="flex items-center gap-3">
              <Skeleton width={40} height={40} circle />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton width="60%" height={14} />
                <Skeleton width="40%" height={11} />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Skeleton width={48} height={10} />
              <Skeleton width={48} height={14} />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
