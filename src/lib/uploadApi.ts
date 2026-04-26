import { QuotaBlockedError } from "@/lib/quotaErrors";
import { getAuthorizedEdgeInvokeHeaders } from "@/lib/supabaseEdgeAuth";

type UploadResult = {
  cards: Array<{ question: string; answer: string }>;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export async function uploadNotes(file: File): Promise<UploadResult> {
  const { supabaseUrl, headers } = await getAuthorizedEdgeInvokeHeaders();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${supabaseUrl}/functions/v1/upload-notes`, {
    method: "POST",
    headers: {
      Authorization: headers.Authorization,
      apikey: headers.apikey,
    },
    body: formData,
  });

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
    throw new Error(errorMessage || "Upload failed");
  }

  if (!obj || !Array.isArray(obj.cards)) {
    throw new Error("Invalid upload response");
  }

  return { cards: obj.cards as UploadResult["cards"] };
}
