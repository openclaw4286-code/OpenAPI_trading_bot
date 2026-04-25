// KV storage abstraction for 908doha Workspace.
// v1 backend: localStorage (single-browser). Swap this module's
// implementation to point at a shared KV (Supabase row, Google Drive
// JSON, Firebase doc, etc.) without changing callers.

const NS = '908doha-workspace';

const key = (domain) => `${NS}:${domain}`;

export async function read(domain, fallback = null) {
  try {
    const raw = localStorage.getItem(key(domain));
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function write(domain, value) {
  localStorage.setItem(key(domain), JSON.stringify(value));
}

export async function remove(domain) {
  localStorage.removeItem(key(domain));
}

export const DOMAINS = {
  tasks: 'tasks',
  notes: 'notes',
  files: 'files',
  vault: 'vault',
  members: 'members',
};
