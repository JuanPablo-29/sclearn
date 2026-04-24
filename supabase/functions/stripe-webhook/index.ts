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

async function syncProfileFromSubscription(
  admin: ReturnType<typeof createClient>,
  sub: Stripe.Subscription
): Promise<void> {
  let userId = userIdFromSubscription(sub);
  if (!userId) {
    const { data: row } = await admin
      .from("profiles")
      .select("id")
      .eq("stripe_subscription_id", sub.id)
      .maybeSingle();
    if (row?.id && typeof row.id === "string") userId = row.id;
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
    }
  }
  if (!userId) {
    console.warn("stripe-webhook: could not resolve user for subscription", sub.id);
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
    console.error("stripe-webhook: profile update failed", error.message);
  }
}

async function setPlanFreeByCustomer(
  admin: ReturnType<typeof createClient>,
  customerId: string,
  status: string
): Promise<void> {
  const { error } = await admin
    .from("profiles")
    .update({
      plan: "free",
      subscription_status: status,
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error("stripe-webhook: setPlanFree failed", error.message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")?.trim();
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")?.trim();

  if (!serviceRoleKey) {
    throw new Error("Missing SERVICE_ROLE_KEY");
  }
  if (!stripeSecret || !webhookSecret || !supabaseUrl) {
    return json(500, { error: "Server configuration incomplete" });
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2023-10-16",
  });

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return json(400, { error: "Missing stripe-signature" });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid signature";
    return json(400, { error: msg });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (!subId) break;

        const sub = await stripe.subscriptions.retrieve(subId);
        await syncProfileFromSubscription(admin, sub);
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await syncProfileFromSubscription(admin, sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await syncProfileFromSubscription(admin, sub);
        break;
      }
      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        const subId =
          typeof inv.subscription === "string"
            ? inv.subscription
            : inv.subscription?.id;
        if (!subId) break;
        const sub = await stripe.subscriptions.retrieve(subId);
        await syncProfileFromSubscription(admin, sub);
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId =
          typeof inv.customer === "string"
            ? inv.customer
            : inv.customer?.id;
        if (customerId) {
          await setPlanFreeByCustomer(admin, customerId, "unpaid");
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("stripe-webhook handler error", e);
    return json(500, { error: "Webhook handler failed" });
  }

  return json(200, { received: true });
});
