import { trackEvent } from "@/lib/analytics";
import type { Flashcard } from "./flashcard";
import {
  QuotaBlockedError,
  type BillingPlan,
} from "@/lib/quotaErrors";
import { getAuthorizedEdgeInvokeHeaders } from "@/lib/supabaseEdgeAuth";

type InvokeSuccess = { cards: Flashcard[] };
type InvokeError = { error: string };

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
  notes: string,
  count = 10
): Promise<Flashcard[]> {
  const { supabaseUrl, headers } = await getAuthorizedEdgeInvokeHeaders();
  const url = `${supabaseUrl}/functions/v1/generate-flashcards`;

  const response = await globalThis.fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ notes, count }),
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
      const o = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
      const plan: BillingPlan = o.plan === "pro" ? "pro" : "free";
      trackEvent("paywall_hit_generation", { plan });
      const msg = parseErrorMessage(text, result);
      throw new QuotaBlockedError(msg, "generation", plan);
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
