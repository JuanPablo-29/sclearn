import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_NOTES_LENGTH = 100_000;

type Flashcard = { question: string; answer: string };

type QuotaReserveResult = {
  allowed: boolean;
  code?: string;
  plan?: string;
  used?: number;
  limit?: number;
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseFlashcardsJson(content: string): Flashcard[] {
  let raw = content.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(raw);
  if (fence) raw = fence[1].trim();

  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("invalid_model_output");
  }

  return parsed.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("invalid_model_output");
    }
    const o = item as Record<string, unknown>;
    const q = o.question;
    const a = o.answer;
    if (typeof q !== "string" || typeof a !== "string") {
      throw new Error("invalid_model_output");
    }
    return { question: q.trim(), answer: a.trim() };
  });
}

function getSupabasePublicClientKey(): string | undefined {
  return (
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim() ||
    Deno.env.get("SUPABASE_ANON_KEY")?.trim() ||
    undefined
  );
}

function paywallMessage(plan: string | undefined): { error: string; code: string } {
  if (plan === "pro") {
    return {
      error:
        "You've used your 200 generations this month. More credits reset next month.",
      code: "generation_limit_pro",
    };
  }
  return {
    error:
      "You've used your 3 free generations today. Upgrade to Pro for more access.",
    code: "generation_limit_free",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const supabasePublicKey = getSupabasePublicClientKey();
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  if (!supabaseUrl || !supabasePublicKey || !openaiKey) {
    return json(500, { error: "Internal server error" });
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const plan = profile?.plan === "pro" ? "pro" : "free";
  const MAX_CARDS = plan === "pro" ? 50 : 10;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return json(400, { error: "Invalid request body" });
  }

  const notesField = (rawBody as Record<string, unknown>).notes;
  if (typeof notesField !== "string") {
    return json(400, { error: "Invalid request body" });
  }

  const countField = (rawBody as Record<string, unknown>).count;
  const parsedCount =
    typeof countField === "number" && Number.isFinite(countField)
      ? Math.floor(countField)
      : 10;
  const requestedCount = Math.min(Math.max(parsedCount, 1), MAX_CARDS);

  if (parsedCount > MAX_CARDS) {
    return json(400, {
      error:
        plan === "pro"
          ? "Max 50 flashcards per generation."
          : "Free plan allows up to 10 flashcards.",
      code: "FLASHCARD_LIMIT_EXCEEDED",
      plan,
      max_cards: MAX_CARDS,
    });
  }

  const notes = notesField.trim();
  if (!notes) {
    return json(400, { error: "notes is required" });
  }
  if (notes.length > MAX_NOTES_LENGTH) {
    return json(400, { error: "notes exceed maximum allowed length" });
  }

  const { data: quotaData, error: quotaError } = await supabase.rpc(
    "reserve_ai_generation_slot"
  );

  if (quotaError) {
    return json(500, { error: "Internal server error" });
  }

  const quota = quotaData as QuotaReserveResult | null;
  if (!quota?.allowed) {
    const pl = typeof quota?.plan === "string" ? quota.plan : "free";
    const { error, code } = paywallMessage(pl);
    return json(429, {
      error,
      code,
      plan: pl,
      used: quota?.used,
      limit: quota?.limit,
    });
  }

  const planAfterReserve =
    typeof quota.plan === "string" ? quota.plan : "free";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              'You convert study notes into flashcards. Respond with ONLY a valid JSON array of objects. Each object must have exactly two string keys: "question" and "answer". No markdown fences, no commentary, no extra keys.',
          },
          {
            role: "user",
            content: `Generate exactly ${requestedCount} flashcards from the following notes. Each flashcard should have a clear question and answer.\n\nNotes:\n${notes}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      return json(502, { error: "Generation service temporarily unavailable" });
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      return json(502, { error: "Generation service temporarily unavailable" });
    }

    let cards: Flashcard[];
    try {
      cards = parseFlashcardsJson(content);
    } catch {
      return json(502, { error: "Generation service temporarily unavailable" });
    }

    if (cards.length === 0) {
      return json(502, { error: "Generation service temporarily unavailable" });
    }

    cards = cards.slice(0, MAX_CARDS);

    const { error: recordError } = await supabase.rpc("record_usage_event", {
      p_type: "generation",
    });

    if (recordError) {
      return json(500, { error: "Internal server error" });
    }

    return new Response(
      JSON.stringify({
        cards,
        plan: planAfterReserve,
        requested_count: requestedCount,
        max_cards: MAX_CARDS,
      }),
      {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch {
    return json(500, { error: "Internal server error" });
  }
});
