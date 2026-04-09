import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { trackEvent } from "@/lib/analytics";
import { replaceUserFlashcards } from "@/lib/flashcardsDb";
import { generateFlashcardsFromNotes } from "@/lib/generateFlashcardsApi";
import { generateMockFlashcards } from "@/lib/mockFlashcards";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const [notes, setNotes] = useState("");
  const [useAi, setUseAi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!user) return;
    const trimmed = notes.trim();
    if (trimmed.length === 0) return;
    setError(null);
    setLoading(true);
    try {
      let cards;
      if (!useAi) {
        cards = generateMockFlashcards(trimmed);
        if (cards.length === 0) {
          setError("Could not build flashcards from that input.");
          return;
        }
      } else {
        cards = await generateFlashcardsFromNotes(trimmed);
        if (cards.length === 0) {
          throw new Error("No flashcards returned");
        }
      }
      await replaceUserFlashcards(supabase, user.id, cards);
      trackEvent("flashcards_generated", {
        mode: useAi ? "ai" : "mock",
        card_count: cards.length,
      });
      navigate("/learn");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const canGenerate =
    Boolean(user) && notes.trim().length > 0 && !loading && !authLoading;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-zinc-950 text-zinc-100">
      <header className="shrink-0 border-b border-zinc-800 px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div>
            <Link
              to="/"
              className="block text-base font-semibold tracking-tight text-zinc-100 hover:text-emerald-400/90 sm:text-lg"
            >
              Sclearn
            </Link>
            <p className="text-xs text-zinc-500 sm:text-sm">
              Scroll. Flip. Learn.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {user ? (
              <>
                <span className="hidden max-w-[140px] truncate text-xs text-zinc-500 sm:inline">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="inline-flex min-h-[44px] touch-manipulation items-center rounded-lg px-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-lg px-3 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-lg px-3 text-sm text-emerald-400 hover:text-emerald-300"
                >
                  Register
                </Link>
              </>
            )}
            <Link
              to="/learn"
              className="inline-flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-lg px-2 text-sm text-emerald-400/90 hover:text-emerald-300"
            >
              Open deck →
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pb-8 pt-3 sm:px-6 sm:pb-10 sm:pt-4">
        {!user && !authLoading ? (
          <p className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-400">
            Sign in to generate flashcards and save them to your account.{" "}
            <Link to="/login" className="text-emerald-400 hover:text-emerald-300">
              Sign in
            </Link>{" "}
            or{" "}
            <Link
              to="/register"
              className="text-emerald-400 hover:text-emerald-300"
            >
              register
            </Link>
            .
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor="notes" className="text-sm font-medium text-zinc-300">
            Your notes
          </label>
          <textarea
            id="notes"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            autoComplete="off"
            placeholder="Paste notes here…"
            rows={10}
            disabled={!user || authLoading}
            className="min-h-[200px] w-full resize-y rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600/60 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 disabled:opacity-50 sm:min-h-[260px]"
          />
          <p className="text-xs text-zinc-500" aria-live="polite">
            {notes.length} characters · trimmed {notes.trim().length}
          </p>
        </div>
      </main>

      {error ? (
        <p
          className="mx-auto w-full max-w-2xl shrink-0 px-4 pb-2 text-sm text-red-400 sm:px-6"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <footer className="mt-auto w-full shrink-0 border-t border-zinc-800 bg-zinc-950">
        <div className="mx-auto w-full max-w-2xl px-4 py-3 pb-safe sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={useAi}
                aria-label={useAi ? "AI on" : "AI off"}
                disabled={!user || authLoading}
                onClick={() => setUseAi((v) => !v)}
                className="flex min-h-[44px] min-w-[44px] shrink-0 touch-manipulation items-center justify-center rounded-lg px-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40"
              >
                <span
                  className={`relative inline-flex h-9 w-14 shrink-0 items-center rounded-full ${
                    useAi ? "bg-emerald-600" : "bg-zinc-700"
                  }`}
                >
                  <span
                    className={`absolute top-1 size-7 rounded-full bg-white shadow ${
                      useAi ? "right-1 left-auto" : "left-1 right-auto"
                    }`}
                  />
                </span>
              </button>
              <span className="text-sm text-zinc-400">
                Use AI{" "}
                <span className="text-zinc-500">
                  ({useAi ? "OpenAI (server)" : "mock deck, no API"})
                </span>
              </span>
            </div>

            <button
              type="button"
              disabled={!canGenerate}
              onClick={handleGenerate}
              className="inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[44px] sm:shadow-md"
            >
              {loading ? (
                <>
                  <span
                    className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden
                  />
                  Generating…
                </>
              ) : (
                "Generate flashcards"
              )}
            </button>
          </div>
          {notes.trim().length === 0 && !loading && user ? (
            <p className="mt-2 text-center text-xs text-zinc-600 sm:text-left">
              Type or paste notes to enable Generate.
            </p>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
