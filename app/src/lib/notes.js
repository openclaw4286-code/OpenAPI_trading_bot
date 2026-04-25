// Note CRUD backed by Supabase. Blocks are stored as a jsonb array
// of `{id, type, text, checked?}` records; the UI treats one block as
// one rendered row so edits stay local without re-splitting strings.

import { supabase } from './supabase.js';
import { uid } from './id.js';

export const BLOCK_TYPES = [
  'text',
  'h1',
  'h2',
  'h3',
  'check',
  'bullet',
  'numbered',
  'quote',
  'divider',
];

const TEXT_LIKE = new Set(['text', 'h1', 'h2', 'h3', 'check', 'bullet', 'numbered', 'quote']);

export function isTextLike(type) {
  return TEXT_LIKE.has(type);
}

export function emptyBlock(type = 'text') {
  const base = { id: uid(), type, text: '' };
  if (type === 'check') return { ...base, checked: false };
  return base;
}

// Older notes were saved with a single `heading` type; keep them
// readable by surfacing them as h2 on read.
function migrateBlock(b) {
  if (!b || typeof b !== 'object') return null;
  if (b.type === 'heading') return { ...b, type: 'h2' };
  return b;
}

export function emptyNote(overrides = {}) {
  return {
    id: uid(),
    title: '',
    blocks: [emptyBlock('text')],
    tags: [],
    pinned: false,
    folderId: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

function rowToNote(r) {
  return {
    id: r.id,
    title: r.title ?? '',
    blocks: (Array.isArray(r.blocks) ? r.blocks : []).map(migrateBlock).filter(Boolean),
    tags: Array.isArray(r.tags) ? r.tags : [],
    pinned: !!r.pinned,
    folderId: r.folder_id ?? null,
    createdBy: r.created_by ?? null,
    updatedBy: r.updated_by ?? null,
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : null,
  };
}

function noteToRow(n) {
  return {
    id: n.id,
    title: n.title ?? '',
    blocks: (n.blocks ?? []).filter((b) => {
      if (b.type === 'check' || b.type === 'divider') return true;
      return (b.text ?? '').trim().length > 0;
    }),
    tags: n.tags ?? [],
    pinned: !!n.pinned,
    folder_id: n.folderId ?? null,
    created_by: n.createdBy ?? null,
    updated_by: n.updatedBy ?? null,
  };
}

export async function listNotes() {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToNote);
}

export async function upsertNote(note) {
  const { data, error } = await supabase
    .from('notes')
    .upsert(noteToRow(note))
    .select()
    .single();
  if (error) throw error;
  return rowToNote(data);
}

export async function removeNote(id) {
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) throw error;
}

export function snippet(note, max = 140) {
  const parts = [];
  for (const b of note.blocks ?? []) {
    if (b.type === 'divider') {
      parts.push('—');
      continue;
    }
    if (!b.text) continue;
    let prefix = '';
    if (b.type === 'check') prefix = b.checked ? '☑ ' : '☐ ';
    else if (b.type === 'bullet') prefix = '• ';
    else if (b.type === 'numbered') prefix = '1. ';
    else if (b.type === 'quote') prefix = '" ';
    parts.push(prefix + b.text);
    if (parts.join(' · ').length > max) break;
  }
  const joined = parts.join(' · ');
  return joined.length > max ? joined.slice(0, max - 1) + '…' : joined;
}
