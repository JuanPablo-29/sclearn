import { getAuthorizedEdgeInvokeHeaders } from "@/lib/supabaseEdgeAuth";
import { supabase } from "@/lib/supabase";

export type UserBillingProfile = {
  plan: "free" | "pro";
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
};

function normalizePlan(raw: string | null | undefined): "free" | "pro" {
  return raw === "pro" ? "pro" : "free";
}

export async function fetchUserBillingProfile(): Promise<UserBillingProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "plan, subscription_status, current_period_end, stripe_customer_id"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return {
      plan: "free",
      subscriptionStatus: null,
      currentPeriodEnd: null,
      stripeCustomerId: null,
    };
  }

  const row = data as Record<string, unknown>;
  return {
    plan: normalizePlan(typeof row.plan === "string" ? row.plan : "free"),
    subscriptionStatus:
      typeof row.subscription_status === "string"
        ? row.subscription_status
        : null,
    currentPeriodEnd:
      typeof row.current_period_end === "string"
        ? row.current_period_end
        : null,
    stripeCustomerId:
      typeof row.stripe_customer_id === "string"
        ? row.stripe_customer_id
        : null,
  };
}

async function postJsonEdge<T>(
  functionName: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const { supabaseUrl, headers } = await getAuthorizedEdgeInvokeHeaders();
  const url = `${supabaseUrl}/functions/v1/${functionName}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  const obj =
    parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  if (!res.ok) {
    const msg =
      obj && typeof obj.error === "string" && obj.error.length > 0
        ? obj.error
        : text.slice(0, 200).trim() || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return parsed as T;
}

/** Returns Stripe Checkout URL (redirect user in same tab). */
export async function createCheckoutSessionUrl(): Promise<string> {
  const out = await postJsonEdge<{ url?: string }>("create-checkout-session");
  if (typeof out?.url !== "string" || !out.url) {
    throw new Error("Checkout did not return a URL.");
  }
  return out.url;
}

/** Returns Stripe Customer Portal URL. */
export async function createCustomerPortalUrl(): Promise<string> {
  const out = await postJsonEdge<{ url?: string }>("create-customer-portal");
  if (typeof out?.url !== "string" || !out.url) {
    throw new Error("Billing portal did not return a URL.");
  }
  return out.url;
}
