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

function getSupabasePublicClientKey(): string | undefined {
  return (
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim() ||
    Deno.env.get("SUPABASE_ANON_KEY")?.trim() ||
    undefined
  );
}

function siteUrl(): string {
  return Deno.env.get("PUBLIC_SITE_URL")?.trim() || "https://sclearn.app";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")?.trim();
  const priceId = Deno.env.get("STRIPE_PRICE_ID_PRO_MONTHLY")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const supabasePublicKey = getSupabasePublicClientKey();

  if (!stripeSecret || !priceId || !supabaseUrl || !supabasePublicKey) {
    return json(500, { error: "Server configuration incomplete" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.trim()) {
    return json(401, { error: "Unauthorized" });
  }

  const supabase = createClient(supabaseUrl, supabasePublicKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return json(401, { error: "Unauthorized" });
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2023-10-16",
  });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return json(500, { error: "Could not load profile" });
  }

  let customerId =
    typeof profile?.stripe_customer_id === "string"
      ? profile.stripe_customer_id.trim()
      : "";

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
    if (updErr) {
      return json(500, { error: "Could not save billing customer" });
    }
  }

  const base = siteUrl().replace(/\/+$/, "");

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/pricing`,
    client_reference_id: user.id,
    metadata: { supabase_user_id: user.id },
    subscription_data: {
      metadata: { supabase_user_id: user.id },
    },
    allow_promotion_codes: true,
  });

  const url = session.url;
  if (!url) {
    return json(500, { error: "Checkout session missing URL" });
  }

  return json(200, { url });
});
