import { createClient } from "@supabase/supabase-js";

/**
 * Single browser Supabase client for the whole app.
 * Uses `VITE_SUPABASE_PUBLISHABLE_KEY`. Import only from this module.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
let warnedLocalRedirect = false;

/**
 * Returns the runtime site URL used by Supabase email redirects.
 * - Browser: current origin (works for localhost, preview deploys, production)
 * - Fallback: production domain
 */
export function getSiteUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin.replace(/\/+$/, "");
    if (
      import.meta.env.DEV &&
      !warnedLocalRedirect &&
      /localhost|127\.0\.0\.1/i.test(origin)
    ) {
      warnedLocalRedirect = true;
      // Dev-only hint to make local redirect behavior explicit.
      console.warn("[Auth] Using localhost redirect URL", origin);
    }
    return origin;
  }
  return "https://sclearn.app";
}

export const supabase = createClient(url ?? "", publishableKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
