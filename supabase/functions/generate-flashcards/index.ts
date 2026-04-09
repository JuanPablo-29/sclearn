import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DAILY_LIMIT = 10;
const MAX_NOTES_LENGTH = 100_000;

type Flashcard = { question: string; answer: string };

type QuotaBeginResult = { allowed: boolean; log_id: string | null };

function json(status: number, body: Record<string, string>): Response {
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

  const notes = notesField.trim();
  if (!notes) {
    return json(400, { error: "notes is required" });
  }
  if (notes.length > MAX_NOTES_LENGTH) {
    return json(400, { error: "notes exceed maximum allowed length" });
  }

  const { data: quotaData, error: quotaError } = await supabase.rpc(
    "begin_flashcard_generation",
    { p_daily_limit: DAILY_LIMIT }
  );

  if (quotaError) {
    return json(500, { error: "Internal server error" });
  }

  const quota = quotaData as QuotaBeginResult | null;
  if (!quota?.allowed || !quota.log_id) {
    return json(429, { error: "Daily generation limit reached" });
  }

  let reservationId: string | null = quota.log_id;

  const releaseReservation = async () => {
    const id = reservationId;
    reservationId = null;
    if (!id) return;
    await supabase.rpc("finalize_flashcard_generation", {
      p_log_id: id,
      p_success: false,
    });
  };

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
            content: `Convert the following notes into concise flashcards. Each flashcard should have a clear question and answer.\n\nNotes:\n${notes}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      await releaseReservation();
      return json(502, { error: "Generation service temporarily unavailable" });
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      await releaseReservation();
      return json(502, { error: "Generation service temporarily unavailable" });
    }

    let cards: Flashcard[];
    try {
      cards = parseFlashcardsJson(content);
    } catch {
      await releaseReservation();
      return json(502, { error: "Generation service temporarily unavailable" });
    }

    if (cards.length === 0) {
      await releaseReservation();
      return json(502, { error: "Generation service temporarily unavailable" });
    }

    const { error: finalizeError } = await supabase.rpc(
      "finalize_flashcard_generation",
      { p_log_id: quota.log_id, p_success: true }
    );

    if (finalizeError) {
      await releaseReservation();
      return json(500, { error: "Internal server error" });
    }

    reservationId = null;

    return new Response(JSON.stringify({ cards }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    await releaseReservation();
    return json(500, { error: "Internal server error" });
  }
});
