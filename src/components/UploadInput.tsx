import { useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import type { Flashcard } from "@/lib/flashcard";
import { isQuotaBlockedError } from "@/lib/quotaErrors";
import { uploadNotes } from "@/lib/uploadApi";
import type { UsageSummary } from "@/lib/usage";

type UploadInputProps = {
  disabled?: boolean;
  usage: UsageSummary | null;
  usageLoading?: boolean;
  onCardsReady: (cards: Flashcard[]) => Promise<void>;
  onRequireUpgrade: () => void;
};

type UploadStatus =
  | "uploading"
  | "extracting"
  | "generating"
  | "done"
  | "error"
  | null;

const MAX_FILE_SIZE_BYTES = 5_000_000;
const ACCEPTED_MIME = new Set([
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

function normalizeClientUploadMime(file: File): string {
  let t = (file.type ?? "").trim().toLowerCase();
  if (t === "image/jpg" || t === "image/pjpeg") t = "image/jpeg";
  const inferred = inferMimeFromFilename(file.name ?? "");
  if (!t || t === "application/octet-stream") {
    return inferred ?? t;
  }
  return t;
}

export function UploadInput({
  disabled = false,
  usage,
  usageLoading = false,
  onCardsReady,
  onRequireUpgrade,
}: UploadInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<UploadStatus>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const busy =
    status !== null && status !== "done" && status !== "error";
  const uploadsRemaining = usage?.uploads.remaining ?? 0;
  const isUploadBlocked = Boolean(usage && uploadsRemaining <= 0);

  async function handleUploadClick() {
    if (disabled || busy || isUploadBlocked) return;
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setStatus("error");
      setError("Choose a supported file first (PDF or image).");
      return;
    }

    const effectiveMime = normalizeClientUploadMime(file);
    if (!effectiveMime || !ACCEPTED_MIME.has(effectiveMime)) {
      setStatus("error");
      setError(
        "Invalid file type. Allowed: PDF, PNG, JPEG, WebP, or HEIC."
      );
      return;
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
      setStatus("error");
      setError("File too large. Max size is 5MB.");
      return;
    }

    setStatus("uploading");
    setError(null);
    setSuccess(null);
    trackEvent("upload_started", {
      file_type: effectiveMime,
      file_size: file.size,
    });

    try {
      const { cards } = await uploadNotes(file, {
        onRequestStarted: () => setStatus("extracting"),
        onResponseReceived: () => setStatus("generating"),
      });
      if (!cards.length) {
        throw new Error("No flashcards returned");
      }
      await onCardsReady(cards);
      trackEvent("upload_succeeded", {
        card_count: cards.length,
        file_type: effectiveMime,
      });
      setStatus("done");
      setSuccess("Flashcards ready!");
      setFileName(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (e) {
      setStatus("error");
      if (isQuotaBlockedError(e) && e.quotaKind === "upload") {
        trackEvent("paywall_hit_upload", { plan: e.plan });
        if (e.plan === "free") {
          onRequireUpgrade();
          setError(null);
        } else {
          setError(e.message);
        }
      } else if (e instanceof Error) {
        setError(e.message || "Upload failed");
      } else {
        setError("Upload failed");
      }
    }
  }

  const statusText =
    status === "uploading"
      ? "Uploading file..."
      : status === "extracting"
        ? "Reading your file..."
        : status === "generating"
          ? "Generating flashcards..."
          : status === "done"
            ? "Flashcards ready!"
            : null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 sm:p-4">
      <p className="text-sm font-medium text-zinc-200">Upload notes file</p>
      <p className="mt-1 text-xs text-zinc-500">
        PDF or common image formats (PNG, JPEG, WebP, HEIC) up to 5MB.
      </p>
      {usageLoading ? (
        <p className="mt-2 text-xs text-zinc-500">Loading usage...</p>
      ) : usage ? (
        <p className="mt-2 text-xs text-zinc-400">
          You have {uploadsRemaining} uploads left this month.
        </p>
      ) : null}
      {isUploadBlocked ? (
        <p className="mt-1 text-xs text-emerald-300">
          You reached your upload limit this month. Upgrade to Pro for more.
        </p>
      ) : null}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif,.pdf,.png,.jpg,.jpeg,.webp,.heic,.heif"
          disabled={disabled || busy || isUploadBlocked}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            setFileName(file?.name ?? null);
            setError(null);
            setSuccess(null);
            setStatus(null);
          }}
          className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-100 hover:file:bg-zinc-700 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void handleUploadClick()}
          disabled={disabled || busy || isUploadBlocked}
          className="inline-flex min-h-[44px] shrink-0 touch-manipulation items-center justify-center rounded-xl border border-emerald-700/60 bg-emerald-600/15 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-600/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Processing..." : "Upload Notes"}
        </button>
      </div>
      {fileName ? (
        <div className="mt-2 text-sm text-zinc-300 opacity-70">File: {fileName}</div>
      ) : null}
      {statusText ? (
        <p className="mt-2 text-xs text-zinc-400">{statusText}</p>
      ) : null}
      {success ? <p className="mt-2 text-xs text-emerald-400">{success}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
