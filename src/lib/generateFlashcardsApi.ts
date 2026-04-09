import { trackEvent } from "@/lib/analytics";
import type { Flashcard } from "./flashcard";
import { supabase } from "./supabase";

type InvokeSuccess = { cards: Flashcard[] };
type InvokeError = { error: string };

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

function edgeFunctionUrl(): string {
  const raw = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const base = typeof raw === "string" ? raw.trim().replace(/\/+$/, "") : "";
  if (!base) {
    throw new Error(
      "VITE_SUPABASE_URL is missing or empty (check .env and rebuild the app)"
    );
  }
  return `${base}/functions/v1/generate-flashcards`;
}

function parseErrorMessage(text: string, result: unknown): string {
  if (result && typeof result === "object" && result !== null) {
    const o = result as Record<string, unknown>;
    if (typeof o.error === "string" && o.error.length > 0) return o.error;
    if (typeof o.message === "string" && o.message.length > 0) return o.message;
  }
  return text.slice(0, 200).trim() || "Request failed";
}

/**
 * Calls the Edge Function with `apikey` (publishable) and `Authorization: Bearer <access_token>`.
 * Auth is enforced inside the function via `getUser` (gateway JWT verification off).
 */
export async function generateFlashcardsFromNotes(
  notes: string
): Promise<Flashcard[]> {
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
      "Not signed in or session expired. Sign out, sign in again, then try AI generation."
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(
      "Session could not be validated. Sign out and sign in again."
    );
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
      "Your session has expired. Sign out, sign in again, then try AI generation."
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

  const url = edgeFunctionUrl();

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: publishableKey,
  };
  if (accessToken) {
    requestHeaders.Authorization = `Bearer ${accessToken}`;
  }

  if (!requestHeaders.Authorization) {
    throw new Error("Sign in to use AI generation.");
  }

  const response = await globalThis.fetch(url, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify({ notes }),
  });

  const text = await response.text();
  let result: unknown;
  try {
    result = text ? JSON.parse(text) : null;
  } catch {
    result = null;
  }

  if (!response.ok) {
    if (response.status === 429) {
      trackEvent("daily_limit_reached");
      throw new Error(
        "You have reached today's free generation limit. Please try again tomorrow."
      );
    }
    const msg = parseErrorMessage(text, result);
    if (response.status === 401) {
      throw new Error(
        msg === "Unauthorized"
          ? "Not authorized. Sign out, sign in again, and retry."
          : msg
      );
    }
    throw new Error(msg);
  }

  if (!result || typeof result !== "object") {
    throw new Error("Empty response from server");
  }

  const dataOut = result as InvokeSuccess & Partial<InvokeError>;

  if ("error" in dataOut && typeof dataOut.error === "string") {
    throw new Error(dataOut.error);
  }

  if (!("cards" in dataOut) || !Array.isArray(dataOut.cards)) {
    throw new Error("Invalid response from server");
  }

  return dataOut.cards as Flashcard[];
}
