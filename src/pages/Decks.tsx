import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { trackEvent } from "@/lib/analytics";
import {
  deleteDeck,
  disableDeckSharing,
  enableDeckSharing,
  FREE_DECK_LIMIT,
  getUserDecks,
  type SavedDeck,
} from "@/lib/decks";

function slugFromShareUrl(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\/deck\//, "").replace(/\/$/, "");
  } catch {
    const idx = url.indexOf("/deck/");
    return idx >= 0 ? (url.slice(idx + 6).split(/[?#]/)[0] ?? "") : "";
  }
}

async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function Decks() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [decks, setDecks] = useState<SavedDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getUserDecks();
      setDecks(list);
      trackEvent("decks_viewed", { deck_count: list.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load decks");
      setDecks([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void load();
  }, [authLoading, user, load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this deck? This cannot be undone.")) return;
    setDeletingId(id);
    setError(null);
    try {
      await deleteDeck(id);
      trackEvent("deck_deleted", { deck_id: id });
      setDecks((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete deck");
    } finally {
      setDeletingId(null);
    }
  }

  function handleOpen(id: string) {
    navigate(`/learn?deck=${encodeURIComponent(id)}`);
  }

  function shareUrlForSlug(slug: string): string {
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "";
    return `${origin}/deck/${slug}`;
  }

  async function handleShareDeck(deck: SavedDeck) {
    setSharingId(deck.id);
    setError(null);
    try {
      const url = await enableDeckSharing(deck.id);
      await copyToClipboard(url);
      const newSlug = slugFromShareUrl(url);
      trackEvent("deck_shared", { deck_id: deck.id });
      trackEvent("share_link_copied", { deck_id: deck.id, source: "enable" });
      setToast("Share link copied!");
      setDecks((prev) =>
        prev.map((d) =>
          d.id === deck.id
            ? { ...d, is_public: true, share_slug: newSlug || d.share_slug }
            : d
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not enable sharing");
    } finally {
      setSharingId(null);
    }
  }

  async function handleCopyShareLink(deck: SavedDeck) {
    if (!deck.share_slug) return;
    setError(null);
    try {
      await copyToClipboard(shareUrlForSlug(deck.share_slug));
      trackEvent("share_link_copied", { deck_id: deck.id, source: "copy" });
      setToast("Share link copied!");
    } catch {
      setError("Could not copy to clipboard. Copy the link manually.");
    }
  }

  async function handleDisableSharing(deck: SavedDeck) {
    setSharingId(deck.id);
    setError(null);
    try {
      await disableDeckSharing(deck.id);
      trackEvent("deck_unshared", { deck_id: deck.id });
      setDecks((prev) =>
        prev.map((d) =>
          d.id === deck.id ? { ...d, is_public: false } : d
        )
      );
      setToast("Sharing turned off.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disable sharing");
    } finally {
      setSharingId(null);
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 text-zinc-400">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-zinc-950 px-4 text-center text-zinc-100">
        <p className="max-w-sm text-sm text-zinc-400">
          Sign in to view and manage your saved decks.
        </p>
        <Link
          to="/login"
          className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Sign in
        </Link>
        <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Back
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-zinc-950 text-zinc-100">
      <header className="shrink-0 border-b border-zinc-800 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Link
              to="/app"
              className="inline-flex min-h-[44px] touch-manipulation items-center text-sm text-zinc-400 hover:text-zinc-200"
            >
              ← Home
            </Link>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-100 sm:text-xl">
              My Decks
            </h1>
          </div>
          <Link
            to="/learn"
            className="inline-flex min-h-[44px] touch-manipulation items-center text-sm text-emerald-400/90 hover:text-emerald-300"
          >
            Study →
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        {error ? (
          <p
            className="mb-4 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {toast ? (
          <p
            className="mb-4 rounded-xl border border-emerald-900/40 bg-emerald-950/35 px-4 py-2.5 text-center text-sm text-emerald-100"
            role="status"
          >
            {toast}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-zinc-500">Loading decks…</p>
        ) : decks.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-6 py-10 text-center">
            <p className="text-sm text-zinc-400">
              No saved decks yet. Generate flashcards on the home page, then use
              &quot;Save Deck&quot; to store up to {FREE_DECK_LIMIT} decks here.
            </p>
            <Link
              to="/app"
              className="mt-6 inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Go to generator
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {decks.map((deck) => (
              <li
                key={deck.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold text-zinc-100">
                    {deck.title}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
                    {deck.cards.length} card
                    {deck.cards.length === 1 ? "" : "s"} ·{" "}
                    {formatDate(deck.created_at)}
                  </p>
                </div>
                <div className="mt-4 flex w-full flex-wrap gap-2 sm:mt-0 sm:max-w-md sm:justify-end">
                  <button
                    type="button"
                    onClick={() => handleOpen(deck.id)}
                    className="inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 sm:flex-none sm:min-w-[5.5rem]"
                  >
                    Open
                  </button>
                  {deck.is_public && deck.share_slug ? (
                    <>
                      <button
                        type="button"
                        disabled={sharingId === deck.id}
                        onClick={() => void handleCopyShareLink(deck)}
                        className="inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center rounded-xl border border-emerald-800/60 bg-emerald-950/30 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-950/50 disabled:opacity-50 sm:flex-none"
                      >
                        Copy link
                      </button>
                      <button
                        type="button"
                        disabled={sharingId === deck.id}
                        onClick={() => void handleDisableSharing(deck)}
                        className="inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center rounded-xl border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 sm:flex-none"
                      >
                        {sharingId === deck.id ? "Disabling…" : "Disable sharing"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={sharingId === deck.id}
                      onClick={() => void handleShareDeck(deck)}
                      className="inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center rounded-xl border border-emerald-800/60 bg-emerald-950/25 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-950/40 disabled:opacity-50 sm:flex-none"
                    >
                      {sharingId === deck.id ? "Working…" : "Share"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={deletingId === deck.id}
                    onClick={() => void handleDelete(deck.id)}
                    className="inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 sm:flex-none"
                  >
                    {deletingId === deck.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
