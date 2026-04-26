import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_FILE_SIZE_BYTES = 5_000_000;
const MAX_NOTES_LENGTH = 100_000;
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "application/pdf",
]);

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

function getSupabasePublicClientKey(): string | undefined {
  return (
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim() ||
    Deno.env.get("SUPABASE_ANON_KEY")?.trim() ||
    undefined
  );
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

function uploadLimitMessage(plan: string | undefined): string {
  if (plan === "pro") {
    return "You've used your 100 uploads this month.";
  }
  return "You've used your 3 uploads this month. Upgrade to Pro for more access.";
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
  const openaiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
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

  const { data: quotaData, error: quotaError } = await supabase.rpc(
    "reserve_upload_slot"
  );
  if (quotaError) {
    return json(500, { error: "Internal server error" });
  }

  const quota = quotaData as QuotaReserveResult | null;
  if (!quota?.allowed) {
    const pl = typeof quota?.plan === "string" ? quota.plan : "free";
    return json(429, {
      error: uploadLimitMessage(pl),
      code: "UPLOAD_LIMIT_REACHED",
      plan: pl,
      used: quota?.used,
      limit: quota?.limit,
    });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json(400, { error: "Invalid multipart form-data" });
  }

  const fileEntry = form.get("file");
  if (!(fileEntry instanceof File)) {
    return json(400, { error: "file is required" });
  }

  if (!ALLOWED_TYPES.has(fileEntry.type)) {
    return json(400, {
      error: "Invalid file type. Allowed: PDF, PNG, JPEG.",
    });
  }

  if (fileEntry.size <= 0 || fileEntry.size > MAX_FILE_SIZE_BYTES) {
    return json(400, {
      error: "Invalid file size. Max size is 5MB.",
    });
  }

  // Baseline text extraction placeholder (OCR/PDF parsing can replace this later).
  const rawText = (await fileEntry.text()).trim();
  if (!rawText) {
    return json(400, {
      error: "Could not extract text from file. Try a clearer file.",
    });
  }
  const notes = rawText.slice(0, MAX_NOTES_LENGTH);

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

    const { error: recordError } = await supabase.rpc("record_usage_event", {
      p_type: "upload",
    });
    if (recordError) {
      return json(500, { error: "Internal server error" });
    }

    return json(200, { cards });
  } catch {
    return json(500, { error: "Internal server error" });
  }
});
