import { createClient } from "@supabase/supabase-js";

/**
 * Single browser Supabase client for the whole app.
 * Uses `VITE_SUPABASE_PUBLISHABLE_KEY`. Import only from this module.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(url ?? "", publishableKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
