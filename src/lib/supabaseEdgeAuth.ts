import { supabase } from "@/lib/supabase";

function decodeJwtPayload(
  token: string
): { iss?: string; exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payloadB64 = parts[1];
    const padded = payloadB64.padEnd(
      payloadB64.length + ((4 - (payloadB64.length % 4)) % 4),
      "="
    );
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as { iss?: string; exp?: number };
  } catch {
    return null;
  }
}

function supabaseProjectRef(host: string): string | null {
  if (host.endsWith(".supabase.co")) return host.split(".")[0] || null;
  return null;
}

function assertJwtMatchesProject(accessToken: string, supabaseUrl: string): void {
  let appHost: string;
  try {
    appHost = new URL(supabaseUrl.trim()).hostname;
  } catch {
    return;
  }
  const appRef = supabaseProjectRef(appHost);
  if (!appRef) return;

  const payload = decodeJwtPayload(accessToken);
  if (!payload?.iss || typeof payload.iss !== "string") return;
  try {
    const issHost = new URL(payload.iss).hostname;
    const issRef = supabaseProjectRef(issHost);
    if (issRef && issRef !== appRef) {
      throw new Error(
        "Session does not match this app configuration. Sign out, sign in again, and confirm your Supabase URL matches your project."
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Session does not match")) throw e;
  }
}

/**
 * Refreshes session and returns headers for `functions/v1/*` calls
 * (publishable key + Bearer access token), matching `generate-flashcards` auth.
 */
export async function getAuthorizedEdgeInvokeHeaders(): Promise<{
  supabaseUrl: string;
  headers: Record<string, string>;
}> {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
    ?.trim()
    .replace(/\/+$/, "");
  if (!supabaseUrl) {
    throw new Error(
      "VITE_SUPABASE_URL is missing or empty (check .env and rebuild the app)"
    );
  }

  const { data: refreshData } = await supabase.auth.refreshSession();

  let accessToken =
    refreshData.session?.access_token?.trim() ??
    (await supabase.auth.getSession()).data.session?.access_token?.trim();

  if (!accessToken) {
    throw new Error(
      "Not signed in or session expired. Sign out, sign in again, then try again."
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Session could not be validated. Sign out and sign in again.");
  }

  const { data: afterUser } = await supabase.auth.getSession();
  const latest = afterUser.session?.access_token?.trim();
  if (latest) {
    accessToken = latest;
  }

  assertJwtMatchesProject(accessToken, supabaseUrl);

  const jwtPayload = decodeJwtPayload(accessToken);
  if (jwtPayload?.exp && jwtPayload.exp * 1000 < Date.now() - 10_000) {
    throw new Error(
      "Your session has expired. Sign out, sign in again, then try again."
    );
  }

  const publishableKeyRaw = import.meta.env
    .VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  const publishableKey =
    typeof publishableKeyRaw === "string" ? publishableKeyRaw.trim() : "";

  if (!publishableKey) {
    throw new Error(
      "VITE_SUPABASE_PUBLISHABLE_KEY is missing or empty (check .env and rebuild the app)"
    );
  }

  return {
    supabaseUrl,
    headers: {
      "Content-Type": "application/json",
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
  };
}
