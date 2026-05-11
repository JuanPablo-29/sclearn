import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { CTA } from "@/components/landing/CTA";
import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/landing/Footer";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { trackEvent } from "@/lib/analytics";
import { UploadInput } from "@/components/UploadInput";
import { useAuth } from "@/context/AuthContext";
import { useUsage } from "@/hooks/useUsage";

export default function Landing() {
  const navigate = useNavigate();
  const { user, loading: authLoading, billing } = useAuth();
  const { usage, loading: usageLoading } = useUsage();
  const [notes, setNotes] = useState("");
  const [count, setCount] = useState(10);
  const [countMode, setCountMode] = useState<"manual" | "auto">("auto");
  const maxCards = billing?.plan === "pro" ? 50 : 10;

  const handleStartClick = () => {
    trackEvent("landing_cta_clicked");
  };

  useEffect(() => {
    setCount((prev) => Math.min(Math.max(prev, 1), maxCards));
  }, [maxCards]);

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

  function handleGenerateClick() {
    if (!user) {
      saveDraft();
      trackEvent("generate_clicked_logged_out");
      navigate("/register");
      return;
    }
    navigate("/app");
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            to="/"
            className="inline-flex min-h-[44px] touch-manipulation items-center gap-3 text-lg font-semibold tracking-tight text-zinc-100"
          >
            <img
              src="/logo.png"
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
              decoding="async"
            />
            <span>Sclearn</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
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
              className="inline-flex min-h-[44px] touch-manipulation items-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            >
              Try sample
            </Link>
          </div>
        </div>
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
                    disabled={authLoading}
                    usage={usage}
                    usageLoading={usageLoading}
                    isAuthenticated={Boolean(user)}
                    onRequireAuth={requireAuth}
                    onCardsReady={async () => {
                      navigate("/app");
                    }}
                    onRequireUpgrade={() => navigate("/pricing")}
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
                  onClick={handleGenerateClick}
                  className="mt-3 inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                >
                  Generate Flashcards
                </button>
                <p className="mt-2 text-center text-xs text-zinc-500">
                  {user
                    ? "You're signed in — generate anytime."
                    : "Free account required to generate flashcards."}
                </p>
                {!user ? (
                  <p className="mt-1 text-center text-xs text-zinc-400">
                    <span className="font-medium text-zinc-200">
                      Create a free account to generate flashcards.
                    </span>
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
