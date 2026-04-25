import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  const hint =
    'Create app/.env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, ' +
    'or add them to the Vercel project environment.';
  throw new Error(`[supabase] missing env vars. ${hint}`);
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});
