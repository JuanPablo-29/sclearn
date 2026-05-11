import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { CTA } from "@/components/landing/CTA";
import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/landing/Footer";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { UpgradeModal } from "@/components/UpgradeModal";
import { trackEvent } from "@/lib/analytics";
import { UploadInput } from "@/components/UploadInput";
import { useAuth } from "@/context/AuthContext";
import { useUsage } from "@/hooks/useUsage";
import type { Flashcard } from "@/lib/flashcard";
import { generateFlashcardsFromNotes } from "@/lib/generateFlashcardsApi";
import { replaceUserFlashcards } from "@/lib/flashcardsDb";
import { isQuotaBlockedError } from "@/lib/quotaErrors";
import { supabase } from "@/lib/supabase";

export default function Landing() {
  const navigate = useNavigate();
  const { user, loading: authLoading, billing } = useAuth();
  const { usage, loading: usageLoading, refreshUsage } = useUsage();
  const [notes, setNotes] = useState("");
  const [count, setCount] = useState(10);
  const [countMode, setCountMode] = useState<"manual" | "auto">("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const maxCards = billing?.plan === "pro" ? 50 : 10;

  const handleStartClick = () => {
    trackEvent("landing_cta_clicked");
  };

  useEffect(() => {
    setCount((prev) => Math.min(Math.max(prev, 1), maxCards));
  }, [maxCards]);

  useEffect(() => {
    if (!user) return;
    if (notes.trim().length > 0) return;
    try {
      const raw = sessionStorage.getItem("sclearn_draft_v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        notes?: unknown;
        countMode?: unknown;
        count?: unknown;
      };
      if (typeof parsed.notes === "string" && parsed.notes.trim().length > 0) {
        setNotes(parsed.notes);
      }
      if (parsed.countMode === "manual" || parsed.countMode === "auto") {
        setCountMode(parsed.countMode);
      }
      if (typeof parsed.count === "number" && Number.isFinite(parsed.count)) {
        setCount(Math.min(Math.max(Math.floor(parsed.count), 1), maxCards));
      }
      sessionStorage.removeItem("sclearn_draft_v1");
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function saveDraft() {
    try {
      sessionStorage.setItem(
        "sclearn_draft_v1",
        JSON.stringify({ notes, countMode, count })
      );
    } catch {
      // ignore
    }
  }

  function requireAuth() {
    saveDraft();
    trackEvent("auth_required_from_landing");
    navigate("/register");
  }

  const isGenerationBlocked = Boolean(
    user && usage && usage.generations.remaining <= 0
  );
  const canGenerate =
    Boolean(user) &&
    notes.trim().length > 0 &&
    !loading &&
    !authLoading &&
    !isGenerationBlocked;

  async function handleGenerateClick() {
    if (!user) {
      saveDraft();
      trackEvent("generate_clicked_logged_out");
      navigate("/register");
      return;
    }
    const trimmed = notes.trim();
    if (!trimmed) return;
    setError(null);
    setSuccessCount(null);
    setLoading(true);
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
        source: "landing",
      });
      setSuccessCount(cards.length);
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
    trackEvent("upload_succeeded", {
      card_count: cards.length,
      source: "landing",
    });
    setSuccessCount(cards.length);
    setError(null);
    await refreshUsage();
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
      />
      <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6 md:py-4">
          <Link
            to="/"
            className="inline-flex min-h-[44px] min-w-0 touch-manipulation items-center gap-3 text-zinc-100"
            onClick={() => setMobileMenuOpen(false)}
          >
            <img
              src="/logo.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 object-contain md:h-12 md:w-12"
              decoding="async"
            />
            <span className="whitespace-nowrap text-base font-bold tracking-tight md:text-lg">
              Sclearn
            </span>
          </Link>

          <nav
            className="hidden items-center gap-3 md:flex"
            aria-label="Main"
          >
            <Link
              to="/pricing"
              className="inline-flex min-h-[44px] touch-manipulation items-center rounded-xl px-3 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200"
            >
              Pricing
            </Link>
            <Link
              to="/login"
              className="inline-flex min-h-[44px] touch-manipulation items-center rounded-xl px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/80"
            >
              Sign In
            </Link>
            <Link
              to="/learn"
              onClick={handleStartClick}
              className="inline-flex min-h-[44px] touch-manipulation items-center rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            >
              Try Free
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2 md:hidden">
            <Link
              to="/learn"
              onClick={() => {
                handleStartClick();
                setMobileMenuOpen(false);
              }}
              className="inline-flex touch-manipulation items-center justify-center whitespace-nowrap rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            >
              Try Free
            </Link>
            <button
              type="button"
              className="inline-flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800"
              aria-expanded={mobileMenuOpen}
              aria-controls="landing-mobile-nav"
              onClick={() => setMobileMenuOpen((o) => !o)}
            >
              <span className="sr-only">
                {mobileMenuOpen ? "Close menu" : "Open menu"}
              </span>
              {mobileMenuOpen ? (
                <svg
                  className="size-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden
                >
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
                </svg>
              ) : (
                <svg
                  className="size-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    d="M4 7h16M4 12h16M4 17h16"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div
            id="landing-mobile-nav"
            className="border-t border-zinc-800/80 bg-zinc-950/95 md:hidden"
          >
            <nav
              className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3"
              aria-label="Mobile"
            >
              <Link
                to="/pricing"
                className="inline-flex min-h-[44px] touch-manipulation items-center rounded-lg px-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/80"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                to="/login"
                className="inline-flex min-h-[44px] touch-manipulation items-center rounded-lg px-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/80"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign In
              </Link>
              <Link
                to="/app"
                className="inline-flex min-h-[44px] touch-manipulation items-center rounded-lg px-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
                onClick={() => setMobileMenuOpen(false)}
              >
                Open app
              </Link>
            </nav>
          </div>
        ) : null}
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-zinc-800/80 py-6 sm:py-10">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(16,185,129,0.18),transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl">
              <div className="mb-4 text-center sm:mb-6">
                <h1 className="text-balance text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
                  Turn Notes Into Flashcards Instantly
                </h1>
                <p className="mx-auto mt-2 max-w-xl text-pretty text-sm text-zinc-400 sm:text-base">
                  Paste notes, upload PDFs or images, and generate study-ready
                  flashcards in seconds.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 shadow-lg shadow-emerald-950/20 backdrop-blur-sm sm:p-5">
                <label
                  htmlFor="landing-notes"
                  className="text-sm font-medium text-zinc-200"
                >
                  Notes
                </label>
                <p className="mt-1 text-xs text-zinc-500">No formatting needed.</p>
                <textarea
                  id="landing-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.currentTarget.value)}
                  rows={6}
                  placeholder="Paste your notes here…"
                  className="mt-2 min-h-[140px] w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-base leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600/60 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                />

                <div className="mt-3">
                  <UploadInput
                    disabled={authLoading || loading}
                    usage={usage}
                    usageLoading={usageLoading}
                    isAuthenticated={Boolean(user)}
                    onRequireAuth={requireAuth}
                    onCardsReady={handleUploadedCards}
                    onRequireUpgrade={() => setUpgradeOpen(true)}
                    count={count}
                    countMode={countMode}
                    maxCards={maxCards}
                  />
                </div>

                <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                  <p className="text-sm font-medium text-zinc-200">
                    Flashcard amount
                  </p>
                  <fieldset className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                      <input
                        type="radio"
                        name="landing-count-mode"
                        checked={countMode === "auto"}
                        disabled={loading}
                        onChange={() => setCountMode("auto")}
                        className="accent-emerald-500"
                      />
                      Let the AI decide
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                      <input
                        type="radio"
                        name="landing-count-mode"
                        checked={countMode === "manual"}
                        disabled={loading}
                        onChange={() => setCountMode("manual")}
                        className="accent-emerald-500"
                      />
                      I’ll pick a number
                    </label>
                  </fieldset>

                  {countMode === "manual" ? (
                    <div className="mt-2 flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={maxCards}
                        step={1}
                        value={count}
                        disabled={loading}
                        onChange={(e) =>
                          setCount(
                            Math.min(
                              Math.max(Number(e.currentTarget.value) || 1, 1),
                              maxCards
                            )
                          )
                        }
                        className="w-full accent-emerald-500"
                      />
                      <input
                        type="number"
                        min={1}
                        max={maxCards}
                        value={count}
                        disabled={loading}
                        onChange={(e) => {
                          const input = Number(e.currentTarget.value) || 1;
                          setCount(Math.min(Math.max(input, 1), maxCards));
                        }}
                        className="w-20 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
                      />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-400">
                      The model chooses a natural number of flashcards, capped at{" "}
                      {maxCards} on your plan.
                    </p>
                  )}
                  <p className="mt-2 text-xs text-zinc-500">
                    {billing?.plan === "pro"
                      ? "Up to 50 cards per set"
                      : "Free plan: up to 10 cards per set"}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!canGenerate}
                  onClick={() => void handleGenerateClick()}
                  className="mt-3 inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? (
                    <>
                      <span
                        className="size-4 animate-spin rounded-full border-2 border-zinc-950/30 border-t-zinc-950"
                        aria-hidden
                      />
                      Generating…
                    </>
                  ) : (
                    "Generate Flashcards"
                  )}
                </button>
                {user && isGenerationBlocked ? (
                  <p className="mt-2 text-center text-xs text-red-400">
                    Daily generation limit reached. Upgrade to continue.
                  </p>
                ) : null}
                <p className="mt-2 text-center text-xs text-zinc-500">
                  {user
                    ? "Signed in — flashcards save to your account."
                    : "Free account required to generate flashcards."}
                </p>
                {!user ? (
                  <p className="mt-1 text-center text-xs text-zinc-400">
                    <span className="font-medium text-zinc-200">
                      Create a free account to generate flashcards.
                    </span>
                  </p>
                ) : null}

                {successCount !== null ? (
                  <div className="mt-3 rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100">
                    <p className="font-medium">{successCount} flashcards ready</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link
                        to="/learn"
                        className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        Study now
                      </Link>
                      <Link
                        to="/app"
                        className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-emerald-800/60 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-950/40"
                      >
                        Open full app
                      </Link>
                    </div>
                  </div>
                ) : null}

                {error ? (
                  <p className="mt-3 text-sm text-red-400" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <Features />
        <HowItWorks />
        <CTA onAppCtaClick={handleStartClick} />
      </main>

      <Footer />
    </div>
  );
}
