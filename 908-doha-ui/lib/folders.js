import { supabase } from './supabase.js';
import { uid } from './id.js';

function rowToFolder(r) {
  return {
    id: r.id,
    name: r.name,
    createdAt: new Date(r.created_at).getTime(),
  };
}

export async function listFolders() {
  const { data, error } = await supabase
    .from('note_folders')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToFolder);
}

export async function createFolder(name) {
  const row = { id: uid(), name: name.trim() };
  if (!row.name) throw new Error('이름을 입력해주세요');
  const { data, error } = await supabase
    .from('note_folders')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return rowToFolder(data);
}

export async function renameFolder(id, name) {
  const next = name.trim();
  if (!next) throw new Error('이름을 입력해주세요');
  const { data, error } = await supabase
    .from('note_folders')
    .update({ name: next })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return rowToFolder(data);
}

export async function removeFolder(id) {
  const { error } = await supabase.from('note_folders').delete().eq('id', id);
  if (error) throw error;
}
