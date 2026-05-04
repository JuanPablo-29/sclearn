import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { parseFileToText } from "../_shared/parseFile.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_FILE_SIZE_BYTES = 5_000_000;
const MAX_IMAGE_SIZE_BYTES = 5_000_000;
const MAX_EXTRACTION_CHARS = 12_000;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function inferMimeFromFilename(name: string): string | null {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot) : "";
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
    case ".jpe":
    case ".jfif":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".heic":
      return "image/heic";
    case ".heif":
      return "image/heif";
    default:
      return null;
  }
}

/** Browsers on phones often omit `type` or send `application/octet-stream`. */
function normalizeUploadMime(file: File): string {
  let t = (file.type ?? "").trim().toLowerCase();
  if (t === "image/jpg" || t === "image/pjpeg") t = "image/jpeg";
  const inferred = inferMimeFromFilename(file.name ?? "");
  if (!t || t === "application/octet-stream") {
    return inferred ?? t;
  }
  return t;
}

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

const FLASHCARD_SYSTEM_PROMPT =
  'You convert study notes into flashcards. Respond with ONLY a valid JSON array of objects. Each object must have exactly two string keys: "question" and "answer". No markdown fences, no commentary, no extra keys.';

/** Base64 for large binaries without stack overflow from spread. */
function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const sub = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
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

  const effectiveMime = normalizeUploadMime(fileEntry);
  if (!effectiveMime || !ALLOWED_TYPES.has(effectiveMime)) {
    return json(400, {
      error:
        "Invalid file type. Allowed: PDF, PNG, JPEG, WebP, HEIC.",
      code: "INVALID_FILE_TYPE",
    });
  }

  if (fileEntry.size <= 0 || fileEntry.size > MAX_FILE_SIZE_BYTES) {
    return json(400, {
      error: "Invalid file size. Max size is 5MB.",
    });
  }

  if (
    effectiveMime.startsWith("image/") &&
    fileEntry.size > MAX_IMAGE_SIZE_BYTES
  ) {
    return json(400, {
      error: "Image is too large. Try a smaller photo or screenshot.",
      code: "IMAGE_TOO_LARGE",
    });
  }

  console.log("Upload type:", fileEntry.type);
  console.log("Upload size:", fileEntry.size);
  if (effectiveMime.startsWith("image/")) {
    console.log("Image size:", fileEntry.size);
  }

  const isImage = effectiveMime.startsWith("image/");

  let res: Response;
  try {
    if (isImage) {
      const buffer = await fileEntry.arrayBuffer();
      const base64 = uint8ToBase64(new Uint8Array(buffer));
      console.log("Image upload: direct flashcard generation (single OpenAI call)");

      res = await fetch("https://api.openai.com/v1/chat/completions", {
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
              content: FLASHCARD_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "Extract key concepts from this study material and generate flashcards. Return JSON only as specified in the system message.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${effectiveMime};base64,${base64}`,
                    detail: "low",
                  },
                },
              ],
            },
          ],
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });
    } else {
      let extractedText: string;
      try {
        extractedText = await Promise.race([
          parseFileToText(fileEntry, effectiveMime),
          new Promise<string>((_, reject) => {
            setTimeout(() => reject(new Error("OCR_TIMEOUT")), 55_000);
          }),
        ]);
      } catch (err) {
        if (err instanceof Error && err.message === "OCR_TIMEOUT") {
          return json(408, {
            error:
              "Processing took too long. Try a smaller or clearer file.",
            code: "OCR_TIMEOUT",
          });
        }
        console.error("Parse error:", err);
        extractedText = "";
      }

      console.log("Extracted text preview:", extractedText?.slice(0, 500));
      console.log("Extracted text length:", extractedText?.length || 0);

      const safeText = extractedText.slice(0, MAX_EXTRACTION_CHARS);
      const wordCount = safeText.split(/\s+/).filter(Boolean).length;
      const isLowQuality =
        safeText.length < 30 ||
        wordCount < 8;

      if (isLowQuality) {
        return json(400, {
          error:
            "We couldn't read enough text from this PDF. Try a text-based PDF or a clearer scan.",
          code: "LOW_QUALITY_PDF",
        });
      }

      console.log("Final text used for AI:", safeText.slice(0, 300));
      console.log("Word count:", wordCount);

      res = await fetch("https://api.openai.com/v1/chat/completions", {
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
              content: FLASHCARD_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content:
                `Convert the following notes into concise flashcards. Each flashcard should have a clear question and answer.\n\nNotes:\n${safeText}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });
    }

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
