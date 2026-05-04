import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BillingHeaderActions } from "@/components/BillingHeaderActions";
import { SaveDeckModal } from "@/components/SaveDeckModal";
import { UpgradeModal } from "@/components/UpgradeModal";
import { UploadInput } from "@/components/UploadInput";
import { useAuth } from "@/context/AuthContext";
import { useUsage } from "@/hooks/useUsage";
import { trackEvent } from "@/lib/analytics";
import { deckLimitForPlan } from "@/lib/decks";
import { replaceUserFlashcards } from "@/lib/flashcardsDb";
import type { Flashcard } from "@/lib/flashcard";
import { generateFlashcardsFromNotes } from "@/lib/generateFlashcardsApi";
import { isQuotaBlockedError } from "@/lib/quotaErrors";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut, billing } = useAuth();
  const { usage, loading: usageLoading, refreshUsage } = useUsage();
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(10);
  const [countMode, setCountMode] = useState<"manual" | "auto">("auto");
  const [lastGeneratedCards, setLastGeneratedCards] = useState<
    Flashcard[] | null
  >(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const deckCap = deckLimitForPlan(billing?.plan);
  const maxCards = billing?.plan === "pro" ? 50 : 10;

  useEffect(() => {
    setCount((prev) => Math.min(Math.max(prev, 1), maxCards));
  }, [maxCards]);

  async function handleGenerate() {
    if (!user) return;
    const trimmed = notes.trim();
    if (trimmed.length === 0) return;
    setError(null);
    setLoading(true);
    setLastGeneratedCards(null);
    try {
      const cards = await generateFlashcardsFromNotes(
        trimmed,
        countMode === "auto"
          ? { autoCount: true }
          : { count: Math.min(count, maxCards) }
      );
      if (cards.length === 0) {
        throw new Error("No flashcards returned");
      }
      await replaceUserFlashcards(supabase, user.id, cards);
      trackEvent("flashcards_generated", {
        card_count: cards.length,
        count_mode: countMode,
      });
      setLastGeneratedCards(cards);
      await refreshUsage();
    } catch (e) {
      if (isQuotaBlockedError(e) && e.quotaKind === "generation") {
        if (e.plan === "free") {
          setUpgradeOpen(true);
          setError(null);
        } else {
          setError(e.message);
        }
      } else {
        setError(
          e instanceof Error ? e.message : "Failed to generate flashcards"
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadedCards(cards: Flashcard[]) {
    if (!user) {
      throw new Error("Sign in to upload notes.");
    }
    await replaceUserFlashcards(supabase, user.id, cards);
    setLastGeneratedCards(cards);
    await refreshUsage();
  }

  const canGenerate =
    Boolean(user) && notes.trim().length > 0 && !loading && !authLoading;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-zinc-950 text-zinc-100">
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
      />
      <SaveDeckModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        cards={lastGeneratedCards ?? []}
        onSaved={() => {
          setLastGeneratedCards(null);
          void refreshUsage();
        }}
        onDeckLimit={() => setUpgradeOpen(true)}
      />

      <header className="shrink-0 border-b border-zinc-800 px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div>
            <Link
              to="/"
              className="inline-flex min-h-[44px] touch-manipulation items-center gap-2.5 text-base font-semibold tracking-tight text-zinc-100 hover:text-emerald-400/90 sm:text-lg"
            >
              <img
                src="/logo.png"
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
                decoding="async"
              />
              <span className="flex flex-col items-start gap-0.5">
                <span>Sclearn</span>
                <span className="text-xs font-normal text-zinc-500 sm:text-sm">
                  Scroll. Flip. Learn.
                </span>
              </span>
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {user ? (
              <>
                <BillingHeaderActions />
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
                <Link
                  to="/pricing"
                  className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-lg px-2 text-sm text-zinc-400 hover:text-zinc-200"
                >
                  Pricing
                </Link>
              </>
            )}
            <Link
              to="/decks"
              className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-lg px-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              My Decks
            </Link>
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

        {lastGeneratedCards && lastGeneratedCards.length > 0 ? (
          <div className="mb-6 rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-4 sm:px-5">
            <p className="text-sm font-medium text-emerald-200/95">
              {lastGeneratedCards.length} flashcards ready
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Study now and save later from the study screen, or save this run
              here (up to {deckCap} saved decks on your plan).
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => navigate("/learn")}
                className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Study now
              </button>
              <button
                type="button"
                onClick={() => setSaveModalOpen(true)}
                className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl border border-emerald-700/60 bg-zinc-900/80 px-5 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-zinc-800"
              >
                Save Deck
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor="notes" className="text-sm font-medium text-zinc-300">
            Paste notes or enter a subject
          </label>
          <textarea
            id="notes"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            autoComplete="off"
            placeholder="Paste notes or type a subject like 'Biology basics' or 'World War 2'…"
            rows={10}
            disabled={!user || authLoading}
            className="min-h-[200px] w-full resize-y rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600/60 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 disabled:opacity-50 sm:min-h-[260px]"
          />
          <p className="text-xs text-zinc-500">
            {`Tip: Try a subject like 'Chemistry basics' or paste your own notes.`}
          </p>
          <p className="text-xs text-zinc-500" aria-live="polite">
            {notes.length} characters · trimmed {notes.trim().length}
          </p>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <p className="text-sm font-medium text-zinc-300">Flashcard amount</p>
            <fieldset className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="radio"
                  name="count-mode"
                  checked={countMode === "auto"}
                  disabled={!user || authLoading || loading}
                  onChange={() => setCountMode("auto")}
                  className="accent-emerald-500"
                />
                Let the AI decide how many
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="radio"
                  name="count-mode"
                  checked={countMode === "manual"}
                  disabled={!user || authLoading || loading}
                  onChange={() => setCountMode("manual")}
                  className="accent-emerald-500"
                />
                I will pick a number
              </label>
            </fieldset>
            {countMode === "auto" ? (
              <p className="mt-2 text-xs text-zinc-400">
                The model chooses how many flashcards fit your notes (no fixed
                count). Your plan still caps each run at {maxCards} cards
                maximum.
              </p>
            ) : (
              <>
                <label
                  htmlFor="card-count"
                  className="mt-2 block text-xs font-medium text-zinc-500"
                >
                  Number of flashcards
                </label>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    id="card-count"
                    type="range"
                    min={1}
                    max={maxCards}
                    step={1}
                    value={count}
                    disabled={!user || authLoading || loading}
                    onChange={(e) =>
                      setCount(
                        Math.min(
                          Math.max(Number(e.currentTarget.value) || 1, 1),
                          maxCards
                        )
                      )
                    }
                    className="w-full accent-emerald-500 disabled:opacity-50"
                  />
                  <input
                    type="number"
                    min={1}
                    max={maxCards}
                    value={count}
                    disabled={!user || authLoading || loading}
                    onChange={(e) => {
                      const input = Number(e.currentTarget.value) || 1;
                      setCount(Math.min(Math.max(input, 1), maxCards));
                    }}
                    className="w-20 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 disabled:opacity-50"
                  />
                </div>
              </>
            )}
            <p className="mt-2 text-xs text-zinc-500">
              {billing?.plan === "pro"
                ? "You can generate up to 50 flashcards per set."
                : "You can generate up to 10 flashcards per set."}
            </p>
            {billing?.plan !== "pro" &&
            countMode === "manual" &&
            count >= maxCards ? (
              <p className="mt-1 text-xs text-emerald-300">
                Upgrade to Pro to generate up to 50 flashcards at once.
              </p>
            ) : null}
          </div>
          {user ? (
            usageLoading ? (
              <p className="text-xs text-zinc-500">Loading usage...</p>
            ) : usage ? (
              <div className="grid gap-1 text-xs text-zinc-400">
                <p>
                  Generations: {usage.generations.used} / {usage.generations.limit}{" "}
                  today ({usage.generations.remaining} left)
                </p>
                <p>
                  Uploads: {usage.uploads.used} / {usage.uploads.limit} this month{" "}
                  ({usage.uploads.remaining} left)
                </p>
                <p>
                  Decks: {usage.decks.used} / {usage.decks.limit} saved
                </p>
              </div>
            ) : null
          ) : null}
        </div>

        <div className="mt-5">
          <UploadInput
            disabled={!user || authLoading || loading}
            usage={usage}
            usageLoading={usageLoading}
            onCardsReady={handleUploadedCards}
            onRequireUpgrade={() => setUpgradeOpen(true)}
          />
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
            <button
              type="button"
              disabled={!canGenerate}
              onClick={() => void handleGenerate()}
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
                "Generate Flashcards"
              )}
            </button>
          </div>
          {notes.trim().length === 0 && !loading && user ? (
            <p className="mt-2 text-center text-xs text-zinc-600 sm:text-left">
              Add notes or a subject to enable Generate.
            </p>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
