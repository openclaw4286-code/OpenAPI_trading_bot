// File CRUD backed by Supabase. Storage is base64 in the `ref`
// column for v1 (spec ≤5MB); Drive/S3 variants are listed in the
// storage enum but not wired yet.

import { supabase } from './supabase.js';
import { uid } from './id.js';

export const MAX_SIZE = 5 * 1024 * 1024;

function rowToFile(r) {
  return {
    id: r.id,
    name: r.name,
    size: Number(r.size),
    mimeType: r.mime_type,
    storage: r.storage,
    ref: r.ref,
    uploaderId: r.uploader_id ?? null,
    linkedTaskId: r.linked_task_id ?? null,
    linkedNoteId: r.linked_note_id ?? null,
    uploadedAt: new Date(r.uploaded_at).getTime(),
  };
}

export async function listFiles() {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToFile);
}

export async function uploadFile(file, { uploaderId = null, taskId = null, noteId = null } = {}) {
  if (file.size > MAX_SIZE) {
    throw new Error(`파일 크기 제한을 넘었어요 (최대 ${formatBytes(MAX_SIZE)})`);
  }
  const ref = await readAsBase64(file);
  const row = {
    id: uid(),
    name: file.name,
    size: file.size,
    mime_type: file.type || 'application/octet-stream',
    storage: 'base64',
    ref,
    uploader_id: uploaderId,
    linked_task_id: taskId,
    linked_note_id: noteId,
  };
  const { data, error } = await supabase.from('files').insert(row).select().single();
  if (error) throw error;
  return rowToFile(data);
}

export async function removeFile(id) {
  const { error } = await supabase.from('files').delete().eq('id', id);
  if (error) throw error;
}

export function downloadFile(file) {
  const href = `data:${file.mimeType};base64,${file.ref}`;
  const a = document.createElement('a');
  a.href = href;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function dataUrl(file) {
  return `data:${file.mimeType};base64,${file.ref}`;
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      const comma = s.indexOf(',');
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    r.onerror = () => reject(r.error ?? new Error('읽기 실패'));
    r.readAsDataURL(file);
  });
}
