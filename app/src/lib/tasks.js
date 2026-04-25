// Task CRUD backed by Supabase. Schema per spec 5.1; DB uses
// snake_case (due_date, linked_notes, created_at) and we map to the
// camelCase shape the UI uses.

import { supabase } from './supabase.js';
import { uid } from './id.js';

export const STATUSES = ['todo', 'doing', 'review', 'done'];
export const PRIORITIES = ['high', 'mid', 'low'];

export const STATUS_LABELS = {
  todo: '할 일',
  doing: '진행 중',
  review: '검토',
  done: '완료',
};

export const PRIORITY_LABELS = {
  high: '높음',
  mid: '중간',
  low: '낮음',
};

export function emptyTask(overrides = {}) {
  return {
    id: uid(),
    title: '',
    description: '',
    status: 'todo',
    priority: 'mid',
    assignees: [],
    assignee: null,
    dueDate: '',
    attachments: [],
    linkedNotes: [],
    createdAt: Date.now(),
    ...overrides,
  };
}

function rowToTask(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? '',
    status: r.status,
    priority: r.priority,
    assignees: r.assignees ?? [],
    assignee: r.assignee ?? null,
    dueDate: r.due_date ?? '',
    attachments: r.attachments ?? [],
    linkedNotes: r.linked_notes ?? [],
    createdBy: r.created_by ?? null,
    updatedBy: r.updated_by ?? null,
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : null,
  };
}

function taskToRow(t) {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? '',
    status: t.status,
    priority: t.priority,
    assignees: t.assignees ?? [],
    assignee: t.assignee ?? null,
    due_date: t.dueDate ? t.dueDate : null,
    attachments: t.attachments ?? [],
    linked_notes: t.linkedNotes ?? [],
    created_by: t.createdBy ?? null,
    updated_by: t.updatedBy ?? null,
  };
}

export async function listTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToTask);
}

export async function upsertTask(task) {
  const { data, error } = await supabase
    .from('tasks')
    .upsert(taskToRow(task))
    .select()
    .single();
  if (error) throw error;
  return rowToTask(data);
}

export async function removeTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

export async function updateTaskStatus(id, status, updatedBy = null) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ status, updated_by: updatedBy })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return rowToTask(data);
}
