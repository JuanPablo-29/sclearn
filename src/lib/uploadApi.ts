import { QuotaBlockedError } from "@/lib/quotaErrors";
import { getAuthorizedEdgeInvokeHeaders } from "@/lib/supabaseEdgeAuth";

type UploadResult = {
  cards: Array<{ question: string; answer: string }>;
};

type UploadNotesOptions = {
  /** Exact count (clamped server-side to plan max). Omit when `autoCount` is true. */
  count?: number;
  /** Server picks a count from material length, capped by plan (free 10 / pro 50). */
  autoCount?: boolean;
  onRequestStarted?: () => void;
  onResponseReceived?: () => void;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export async function uploadNotes(
  file: File,
  options?: UploadNotesOptions
): Promise<UploadResult> {
  const { supabaseUrl, headers } = await getAuthorizedEdgeInvokeHeaders();
  const formData = new FormData();
  formData.append("file", file);

  if (options?.autoCount) {
    formData.append("autoCount", "true");
  } else if (
    options?.count != null &&
    Number.isFinite(options.count) &&
    options.count > 0
  ) {
    formData.append("count", String(Math.floor(options.count)));
  }

  options?.onRequestStarted?.();
  const res = await fetch(`${supabaseUrl}/functions/v1/upload-notes`, {
    method: "POST",
    headers: {
      Authorization: headers.Authorization,
      apikey: headers.apikey,
    },
    body: formData,
  });
  options?.onResponseReceived?.();

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  const obj = asObject(parsed);

  const errorMessage =
    obj && typeof obj.error === "string"
      ? obj.error
      : text || "Upload failed";
  const code =
    obj && typeof obj.code === "string"
      ? obj.code
      : "";
  const plan =
    obj?.plan === "pro" ? "pro" : "free";

  if (!res.ok) {
    if (res.status === 429 || code === "UPLOAD_LIMIT_REACHED") {
      throw new QuotaBlockedError(errorMessage, "upload", plan);
    }
    const err = new Error(errorMessage || "Upload failed");
    (err as Error & { code?: string }).code = code || undefined;
    throw err;
  }

  if (!obj || !Array.isArray(obj.cards)) {
    throw new Error("Invalid upload response");
  }

  return { cards: obj.cards as UploadResult["cards"] };
}
