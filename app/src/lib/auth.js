// Member password auth — PBKDF2-SHA256 600k iterations, matches vault.
// Stores salt and hash base64-encoded in the members table.

const ITERATIONS = 600_000;
const HASH_BITS = 256;

const enc = new TextEncoder();

function b64encode(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveHashBytes(password, saltBytes) {
  const material = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations: ITERATIONS, hash: 'SHA-256' },
      material,
      HASH_BITS,
    ),
  );
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHashBytes(password, salt);
  return { pw_salt: b64encode(salt), pw_hash: b64encode(hash) };
}

export async function verifyPassword(password, pw_salt, pw_hash) {
  if (!pw_salt || !pw_hash) return false;
  const saltBytes = b64decode(pw_salt);
  const derived = b64encode(await deriveHashBytes(password, saltBytes));
  // Constant-time-ish compare; data is already public once hashed.
  if (derived.length !== pw_hash.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i++) diff |= derived.charCodeAt(i) ^ pw_hash.charCodeAt(i);
  return diff === 0;
}

// ---------- session ----------

const SESSION_KEY = '908doha-workspace:session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.memberId || !s?.at) return null;
    if (Date.now() - s.at > SESSION_TTL_MS) return null;
    return s;
  } catch {
    return null;
  }
}

export function writeSession(memberId) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ memberId, at: Date.now() }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
