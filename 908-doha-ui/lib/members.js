import { supabase } from './supabase.js';
import { uid } from './id.js';
import { hashPassword } from './auth.js';

// Preset colors from the 908 DS accent family (500 shades).
export const MEMBER_COLORS = [
  '#0064FF', // primary
  '#1E8443', // green
  '#D23826', // red
  '#B5610F', // orange
  '#95790A', // yellow
  '#0A6E6E', // teal
  '#4F3478', // purple
];

function rowToMember(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    role: r.role ?? '',
    bio: r.bio ?? '',
    contact: r.contact ?? '',
    hasPassword: !!(r.pw_salt && r.pw_hash),
    pw_salt: r.pw_salt ?? null,
    pw_hash: r.pw_hash ?? null,
    createdAt: new Date(r.created_at).getTime(),
  };
}

export async function listMembers() {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToMember);
}

export async function getMember(id) {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return rowToMember(data);
}

export async function createMember({ name, color, password }) {
  const row = { id: uid(), name: name.trim(), color };
  if (password) Object.assign(row, await hashPassword(password));
  const { data, error } = await supabase
    .from('members')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return rowToMember(data);
}

export async function updateMember(id, { name, color, password, role, bio, contact }) {
  const patch = {};
  if (name !== undefined) patch.name = name.trim();
  if (color !== undefined) patch.color = color;
  if (role !== undefined) patch.role = role;
  if (bio !== undefined) patch.bio = bio;
  if (contact !== undefined) patch.contact = contact;
  if (password) Object.assign(patch, await hashPassword(password));
  const { data, error } = await supabase
    .from('members')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return rowToMember(data);
}

export async function deleteMember(id) {
  const { error } = await supabase.from('members').delete().eq('id', id);
  if (error) throw error;
}
