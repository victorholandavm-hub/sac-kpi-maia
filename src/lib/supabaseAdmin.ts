import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Supabase env vars ausentes (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY)");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
