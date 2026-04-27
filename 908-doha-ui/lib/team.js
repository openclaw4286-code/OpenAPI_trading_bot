import { supabase } from './supabase.js';
import { uid } from './id.js';

function rowToLog(r) {
  return {
    id: r.id,
    memberId: r.member_id,
    startedAt: new Date(r.started_at).getTime(),
    endedAt: r.ended_at ? new Date(r.ended_at).getTime() : null,
    note: r.note ?? '',
  };
}

// Pulls everything since `since` (a timestamp ms). The Team page passes
// the start of the current week so the running totals stay scoped.
export async function listLogsSince(since) {
  const { data, error } = await supabase
    .from('work_logs')
    .select('*')
    .gte('started_at', new Date(since).toISOString())
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToLog);
}

export async function findOpenLog(memberId) {
  const { data, error } = await supabase
    .from('work_logs')
    .select('*')
    .eq('member_id', memberId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToLog(data) : null;
}

export async function clockIn(memberId) {
  // Defensive: close any open log before opening a new one.
  const open = await findOpenLog(memberId);
  if (open) await clockOut(open.id);
  const row = {
    id: uid(),
    member_id: memberId,
    started_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('work_logs')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return rowToLog(data);
}

export async function clockOut(logId) {
  const { data, error } = await supabase
    .from('work_logs')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', logId)
    .select()
    .single();
  if (error) throw error;
  return rowToLog(data);
}

// ---- time math helpers ----

export function startOfDay(t = Date.now()) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfWeek(t = Date.now()) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  // Monday-start week (Korean convention is split, but Notion uses Mon)
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.getTime();
}

function overlap(s1, e1, s2, e2) {
  const s = Math.max(s1, s2);
  const e = Math.min(e1, e2);
  return Math.max(0, e - s);
}

export function totalsForMember(logs, memberId, now = Date.now()) {
  const today = startOfDay(now);
  const week = startOfWeek(now);
  let todayMs = 0;
  let weekMs = 0;
  for (const l of logs) {
    if (l.memberId !== memberId) continue;
    const end = l.endedAt ?? now;
    todayMs += overlap(l.startedAt, end, today, today + 86_400_000);
    weekMs += overlap(l.startedAt, end, week, week + 7 * 86_400_000);
  }
  return { todayMs, weekMs };
}

export function formatHM(ms) {
  if (!ms || ms < 0) return '0분';
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

export function formatTimeOfDay(t) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
