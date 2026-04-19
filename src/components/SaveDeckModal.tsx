import { useEffect, useId, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { DECK_LIMIT_ERROR, FREE_DECK_LIMIT, saveDeck } from "@/lib/decks";
import type { Flashcard } from "@/lib/flashcard";

export const DEFAULT_DECK_TITLE = "Biology Notes";

type SaveDeckModalProps = {
  open: boolean;
  onClose: () => void;
  /** Cards to persist (e.g. last generation or current session deck). */
  cards: Flashcard[];
  /** Called after a successful save (e.g. clear “unsaved” UI on Home). */
  onSaved?: () => void;
};

export function SaveDeckModal({
  open,
  onClose,
  cards,
  onSaved,
}: SaveDeckModalProps) {
  const titleId = useId();
  const [title, setTitle] = useState(DEFAULT_DECK_TITLE);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(DEFAULT_DECK_TITLE);
    setSaveError(null);
  }, [open]);

  async function handleSave() {
    if (!cards.length) return;
    setSaveError(null);
    setSaving(true);
    try {
      await saveDeck({
        title: title.trim() || DEFAULT_DECK_TITLE,
        cards,
      });
      trackEvent("deck_saved", { card_count: cards.length });
      onSaved?.();
      onClose();
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to save deck. Try again.";
      setSaveError(msg);
      if (msg === DECK_LIMIT_ERROR || msg.includes("free limit of 3")) {
        trackEvent("deck_limit_reached");
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="presentation"
      onClick={() => !saving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id={titleId}
          className="text-lg font-semibold text-zinc-100"
        >
          Save deck
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Choose a title (max {FREE_DECK_LIMIT} saved decks on the free plan).
        </p>
        <label
          htmlFor={`${titleId}-input`}
          className="mt-4 block text-sm font-medium text-zinc-300"
        >
          Title
        </label>
        <input
          id={`${titleId}-input`}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          disabled={saving}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-600/60 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 disabled:opacity-50"
          autoComplete="off"
        />
        {saveError ? (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {saveError}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => onClose()}
            className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || cards.length === 0}
            onClick={() => void handleSave()}
            className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
