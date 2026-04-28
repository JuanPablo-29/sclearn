import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import Stripe from "https://esm.sh/stripe@14.21.0?dts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function userIdFromSubscription(sub: Stripe.Subscription): string | null {
  const m = sub.metadata?.supabase_user_id;
  return typeof m === "string" && m.length > 0 ? m : null;
}

async function markReferralConverted(
  admin: ReturnType<typeof createClient>,
  userId: string,
  context: string
): Promise<void> {
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("referred_by")
    .eq("id", userId)
    .maybeSingle();

  if (profileErr) {
    console.error(`[${context}] referral lookup failed:`, profileErr);
    return;
  }

  const referredBy = (profile as { referred_by?: string | null } | null)?.referred_by;
  if (!referredBy) {
    return;
  }

  const { error: updErr } = await admin
    .from("referrals")
    .update({
      status: "converted",
      converted_at: new Date().toISOString(),
    })
    .eq("referred_user_id", userId)
    .eq("status", "pending");

  if (updErr) {
    console.error(`[${context}] referral conversion update failed:`, updErr);
  }
}

async function syncProfileFromSubscription(
  admin: ReturnType<typeof createClient>,
  sub: Stripe.Subscription,
  context: string
): Promise<void> {
  console.log(`[${context}] syncProfileFromSubscription subscription id:`, sub.id);

  let userId = userIdFromSubscription(sub);
  console.log(`[${context}] Extracted userId (metadata):`, userId ?? "(none)");

  if (!userId) {
    const { data: row } = await admin
      .from("profiles")
      .select("id")
      .eq("stripe_subscription_id", sub.id)
      .maybeSingle();
    if (row?.id && typeof row.id === "string") userId = row.id;
    console.log(`[${context}] Extracted userId (after subscription_id lookup):`, userId ?? "(none)");
  }
  if (!userId) {
    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    if (customerId) {
      const { data: row } = await admin
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      if (row?.id && typeof row.id === "string") userId = row.id;
      console.log(`[${context}] Extracted userId (after customer_id lookup):`, userId ?? "(none)");
    }
  }
  if (!userId) {
    console.warn(
      `[${context}] could not resolve user for subscription`,
      sub.id
    );
    return;
  }

  const active = sub.status === "active" || sub.status === "trialing";

  const plan = active ? "pro" : "free";
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? "";

  const periodEndIso =
    typeof sub.current_period_end === "number"
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;

  console.log(`[${context}] Updating profile`, {
    userId,
    plan,
    subscription_status: sub.status,
    stripe_subscription_id: sub.id,
  });

  const { error } = await admin
    .from("profiles")
    .update({
      plan,
      stripe_customer_id: customerId || null,
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      current_period_end: periodEndIso,
    })
    .eq("id", userId);

  if (error) {
    console.error(`[${context}] DB update error:`, error);
  } else {
    console.log(`[${context}] DB update success for userId:`, userId);
    if (plan === "pro") {
      await markReferralConverted(admin, userId, context);
    }
  }
}

async function setPlanFreeByCustomer(
  admin: ReturnType<typeof createClient>,
  customerId: string,
  status: string,
  context: string
): Promise<void> {
  console.log(`[${context}] setPlanFreeByCustomer customerId:`, customerId);

  const { error } = await admin
    .from("profiles")
    .update({
      plan: "free",
      subscription_status: status,
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error(`[${context}] DB update error:`, error);
  } else {
    console.log(`[${context}] DB update success (plan free) for customerId:`, customerId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  console.log("Stripe webhook received");

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")?.trim();
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")?.trim();

  if (!serviceRoleKey) {
    throw new Error("Missing SERVICE_ROLE_KEY");
  }
  if (!stripeSecret || !webhookSecret || !supabaseUrl) {
    console.error("Server configuration incomplete", {
      hasStripeSecret: Boolean(stripeSecret),
      hasWebhookSecret: Boolean(webhookSecret),
      hasSupabaseUrl: Boolean(supabaseUrl),
    });
    return json(500, { error: "Server configuration incomplete" });
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2023-10-16",
  });

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    console.error("Missing stripe-signature header");
    return json(400, { error: "Missing stripe-signature" });
  }

  const body = await req.text();
  console.log("Raw body length:", body.length);
  console.log("Raw body:", body);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      webhookSecret
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Signature verification failed:", message);
    return new Response("Invalid signature", {
      status: 400,
      headers: corsHeaders,
    });
  }

  console.log("Event type:", event.type);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    console.log("Handling event:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("Checkout session id:", session.id, "mode:", session.mode);

        if (session.mode !== "subscription") {
          console.log("Skipping: session mode is not subscription");
          break;
        }

        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        console.log("Checkout subscription id:", subId ?? "(none)");
        if (!subId) break;

        const sub = await stripe.subscriptions.retrieve(subId);
        await syncProfileFromSubscription(admin, sub, "checkout.session.completed");
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        const userIdRaw = subscription.metadata?.supabase_user_id;
        const userId =
          typeof userIdRaw === "string" && userIdRaw.trim().length > 0
            ? userIdRaw.trim()
            : "";

        console.log("Extracted userId:", userId || "(empty)");

        if (!userId) {
          throw new Error("Missing supabase_user_id in subscription metadata");
        }

        console.log("Subscription updated for user:", userId);

        const isPro =
          subscription.status === "active" ||
          subscription.status === "trialing";

        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id ?? "";

        const periodEndIso =
          typeof subscription.current_period_end === "number"
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null;

        console.log("Subscription.updated payload", {
          subscriptionId: subscription.id,
          status: subscription.status,
          isPro,
          customerId: customerId || "(none)",
          current_period_end: periodEndIso,
        });

        const { error: updErr } = await admin
          .from("profiles")
          .update({
            stripe_subscription_id: subscription.id,
            subscription_status: subscription.status,
            current_period_end: periodEndIso,
            plan: isPro ? "pro" : "free",
            ...(customerId ? { stripe_customer_id: customerId } : {}),
          })
          .eq("id", userId);

        if (updErr) {
          console.error("DB update error:", updErr);
          throw new Error(updErr.message);
        }
        console.log("DB update success for userId:", userId);
        if (isPro) {
          await markReferralConverted(admin, userId, "customer.subscription.updated");
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await syncProfileFromSubscription(admin, sub, "customer.subscription.deleted");
        break;
      }
      case "invoice.paid": {
        console.log("Handling event:", event.type, "(invoice.paid)");
        const inv = event.data.object as Stripe.Invoice;
        const subId =
          typeof inv.subscription === "string"
            ? inv.subscription
            : inv.subscription?.id;
        console.log("Invoice subscription id:", subId ?? "(none)");
        if (!subId) break;
        const sub = await stripe.subscriptions.retrieve(subId);
        await syncProfileFromSubscription(admin, sub, "invoice.paid");
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId =
          typeof inv.customer === "string"
            ? inv.customer
            : inv.customer?.id;
        console.log("Invoice customer id:", customerId ?? "(none)");
        if (customerId) {
          await setPlanFreeByCustomer(
            admin,
            customerId,
            "unpaid",
            "invoice.payment_failed"
          );
        }
        break;
      }
      default: {
        console.log("Unhandled Stripe event type:", event.type);
        break;
      }
    }

    console.log("Webhook handler finished OK for event:", event.type);
  } catch (e) {
    console.error("stripe-webhook handler error", e);
    return json(500, { error: "Webhook handler failed" });
  }

  return json(200, { received: true });
});
