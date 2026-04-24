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
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const supabasePublicKey = getSupabasePublicClientKey();

  if (!stripeSecret || !supabaseUrl || !supabasePublicKey) {
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return json(500, { error: "Could not load profile" });
  }

  const customerId =
    typeof profile?.stripe_customer_id === "string"
      ? profile.stripe_customer_id.trim()
      : "";

  if (!customerId) {
    return json(400, {
      error: "No billing account on file. Start checkout from Pricing first.",
    });
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2023-10-16",
  });

  const base = siteUrl().replace(/\/+$/, "");

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${base}/app`,
  });

  if (!portal.url) {
    return json(500, { error: "Portal session missing URL" });
  }

  return json(200, { url: portal.url });
});
