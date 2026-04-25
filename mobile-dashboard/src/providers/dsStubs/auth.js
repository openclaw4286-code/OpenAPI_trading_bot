// Stub for 908-doha-ui's lib/auth.js. The dashboard is read-only and
// has no operator session — every helper resolves to a no-session
// state so AuthProvider's bootstrap finishes immediately without
// hitting the real PBKDF2 / localStorage paths.

export async function hashPassword() { return { pw_salt: '', pw_hash: '' }; }
export async function verifyPassword() { return false; }
export function readSession() { return null; }
export function writeSession() {}
export function clearSession() {}
