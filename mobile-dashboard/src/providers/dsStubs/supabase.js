// Read-only dashboard stub for 908-doha-ui's lib/supabase.js. Replaces
// the real Supabase client (which throws if env vars are missing) with
// a chainable no-op so AuthProvider can mount cleanly. Every list/select
// resolves to an empty array; we feed real members through other paths.

const noop = {
  from() { return chain; },
  auth: { getSession: async () => ({ data: { session: null } }) },
};

const chain = {
  select() { return this; },
  insert() { return this; },
  update() { return this; },
  upsert() { return this; },
  delete() { return this; },
  eq() { return this; },
  order() { return this; },
  single() { return Promise.resolve({ data: null, error: null }); },
  then(resolve) { resolve({ data: [], error: null }); return Promise.resolve({ data: [], error: null }); },
};

export const supabase = noop;
