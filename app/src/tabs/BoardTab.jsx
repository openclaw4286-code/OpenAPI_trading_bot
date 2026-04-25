import { useEffect, useMemo, useState } from 'react';
import KanbanColumn from '../components/KanbanColumn.jsx';
import TaskEditor from '../components/TaskEditor.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import {
  STATUSES,
  STATUS_LABELS,
  emptyTask,
  listTasks,
  upsertTask,
  removeTask,
  updateTaskStatus,
} from '../lib/tasks.js';

export default function BoardTab() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [editing, setEditing] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  const refresh = async () => {
    try {
      const list = await listTasks();
      setTasks(list);
      setError(null);
    } catch (e) {
      setError(e.message ?? String(e));
      console.error('[tasks] list failed', e);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    const open = () => setEditing(emptyTask({ createdBy: currentUser?.id ?? null }));
    window.addEventListener('workspace:new-task', open);
    return () => window.removeEventListener('workspace:new-task', open);
  }, [currentUser]);

  const columns = useMemo(() => {
    const by = Object.fromEntries(STATUSES.map((s) => [s, []]));
    for (const t of tasks) (by[t.status] ?? by.todo).push(t);
    return by;
  }, [tasks]);

  const upsert = async (task) => {
    const idx = tasks.findIndex((t) => t.id === task.id);
    const isNew = idx === -1;
    const stamped = {
      ...task,
      createdBy: task.createdBy ?? currentUser?.id ?? null,
      updatedBy: currentUser?.id ?? null,
    };
    const prev = tasks;
    setTasks(isNew ? [stamped, ...tasks] : tasks.map((t) => (t.id === stamped.id ? stamped : t)));
    setEditing(null);
    try {
      const saved = await upsertTask(stamped);
      setTasks((list) => list.map((t) => (t.id === saved.id ? saved : t)));
      toast.success(isNew ? '작업을 만들었어요' : '작업을 저장했어요');
    } catch (e) {
      setTasks(prev);
      setError(`저장 실패: ${e.message ?? e}`);
      toast.error('저장에 실패했어요');
      console.error('[tasks] upsert failed', e);
    }
  };

  const remove = async (task) => {
    const prev = tasks;
    setTasks(tasks.filter((t) => t.id !== task.id));
    setEditing(null);
    try {
      await removeTask(task.id);
      toast.success('작업을 삭제했어요');
    } catch (e) {
      setTasks(prev);
      setError(`삭제 실패: ${e.message ?? e}`);
      toast.error('삭제에 실패했어요');
      console.error('[tasks] remove failed', e);
    }
  };

  const moveToStatus = async (id, status) => {
    const prev = tasks;
    const target = tasks.find((t) => t.id === id);
    if (!target || target.status === status) return;
    setTasks(tasks.map((t) => (t.id === id ? { ...t, status, updatedBy: currentUser?.id ?? null } : t)));
    try {
      await updateTaskStatus(id, status, currentUser?.id ?? null);
    } catch (e) {
      setTasks(prev);
      setError(`상태 변경 실패: ${e.message ?? e}`);
      console.error('[tasks] move failed', e);
    }
  };

  const empty = tasks.length === 0;

  return (
    <div className="h-full">
      <div className="mx-auto max-w-[1400px] px-5 py-6">
        <div className="mb-4 flex items-center justify-between">
          {error ? (
            <span
              className="t-caption rounded-md px-2 py-1"
              style={{ background: 'var(--state-negative-soft)', color: 'var(--state-negative)' }}
            >
              {error}
            </span>
          ) : (
            <span />
          )}
          <span className="t-caption" style={{ color: 'var(--text-tertiary)' }}>
            총 {tasks.length}개
          </span>
        </div>

        {!loaded ? (
          <BoardSkeleton />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STATUSES.map((s) => (
              <KanbanColumn
                key={s}
                status={s}
                label={STATUS_LABELS[s]}
                tasks={columns[s]}
                draggingId={draggingId}
                onDropTask={moveToStatus}
                onDragStart={setDraggingId}
                onDragEnd={() => setDraggingId(null)}
                onOpen={setEditing}
                onQuickAdd={(status) => setEditing(emptyTask({ status }))}
              />
            ))}
          </div>
        )}

        {empty && loaded && !error && (
          <div
            className="mx-auto mt-8 max-w-md rounded-xl border border-dashed p-8 text-center"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            <div className="t-heading2" style={{ color: 'var(--text-primary)' }}>
              아직 작업이 없어요
            </div>
            <p className="t-body2 mt-1.5">
              컬럼 하단의 작업 추가 버튼이나 상단의 New로 첫 작업을 만들어보세요.
            </p>
          </div>
        )}
      </div>

      <TaskEditor
        open={!!editing}
        task={editing}
        onSave={upsert}
        onDelete={remove}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function BoardSkeleton() {
  const COLS = [3, 2, 1, 2];
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {COLS.map((cardCount, ci) => (
        <section
          key={ci}
          className="flex min-h-[400px] w-[280px] shrink-0 flex-col gap-2 rounded-xl p-3"
          style={{ background: 'var(--surface-layered)' }}
        >
          <header className="flex items-center justify-between px-1">
            <Skeleton width={64} height={14} />
            <Skeleton width={20} height={14} rounded={999} />
          </header>
          <div className="flex flex-col gap-2">
            {Array.from({ length: cardCount }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border p-3"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <Skeleton width="80%" height={14} />
                <Skeleton width="55%" height={12} style={{ marginTop: 8 }} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
