// Vault backed by the single encrypted blob in public.vault (spec 5.6).
// The master password never touches the server; we derive a key and
// encrypt a JSON array of entries via Web Crypto AES-GCM (crypto.js).

import { supabase } from './supabase.js';
import { decryptVault, encryptVault } from './crypto.js';
import { uid } from './id.js';

export function emptyEntry(overrides = {}) {
  return {
    id: uid(),
    title: '',
    username: '',
    password: '',
    url: '',
    notes: '',
    updatedAt: Date.now(),
    ...overrides,
  };
}

export async function fetchVaultRow() {
  const { data, error } = await supabase
    .from('vault')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function initVault(master, updaterId = null) {
  const payload = await encryptVault(master, []);
  const row = { id: 1, ...payload, updated_by: updaterId };
  const { data, error } = await supabase.from('vault').upsert(row).select().single();
  if (error) throw error;
  return { row: data, entries: [] };
}

export async function unlockVault(master) {
  const row = await fetchVaultRow();
  if (!row) return null;
  try {
    const entries = await decryptVault(master, row);
    return { row, entries: Array.isArray(entries) ? entries : [] };
  } catch (e) {
    throw new Error('비밀번호가 일치하지 않아요');
  }
}

export async function saveEntries(master, entries, updaterId = null) {
  const payload = await encryptVault(master, entries);
  const row = { id: 1, ...payload, updated_by: updaterId };
  const { data, error } = await supabase.from('vault').upsert(row).select().single();
  if (error) throw error;
  return data;
}

// Re-encrypt the vault under a new master password. Verifies the
// current master first so a wrong entry can't wipe the blob.
export async function changeMasterPassword(currentMaster, newMaster, updaterId = null) {
  const row = await fetchVaultRow();
  if (!row) throw new Error('아직 보관함이 만들어지지 않았어요');
  let entries;
  try {
    entries = await decryptVault(currentMaster, row);
  } catch {
    throw new Error('현재 비밀번호가 일치하지 않아요');
  }
  await saveEntries(newMaster, Array.isArray(entries) ? entries : [], updaterId);
}

export function generatePassword(length = 20) {
  const charset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*+-_';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const n of bytes) out += charset[n % charset.length];
  return out;
}
