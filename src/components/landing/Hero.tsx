import { Link } from "react-router-dom";

type HeroProps = {
  onAppCtaClick?: () => void;
};

export function Hero({ onAppCtaClick }: HeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-zinc-800/80 py-16 sm:py-24">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(16,185,129,0.18),transparent)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-balance text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl md:text-5xl lg:text-6xl">
            Turn Your Notes Into AI Flashcards Instantly
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-zinc-400 sm:text-lg">
            Paste your notes and Sclearn generates flashcards you can study with
            an addictive scrolling interface.
          </p>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
            <Link
              to="/app"
              onClick={onAppCtaClick}
              className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl bg-emerald-500 px-6 py-3 text-center text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
            >
              Start Studying Free
            </Link>
            <Link
              to="/login"
              className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/50 px-6 py-3 text-center text-sm font-medium text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-800/80"
            >
              Sign In
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-14 max-w-md sm:mt-16">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-1 shadow-lg shadow-emerald-950/20 backdrop-blur-sm">
            <div className="rounded-lg border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 sm:p-8">
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-500/90">
                Preview
              </p>
              <p className="mt-4 text-lg font-medium text-zinc-100 sm:text-xl">
                What is photosynthesis?
              </p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                Tap to flip — the answer appears on the back while you scroll
                through your deck, one card at a time.
              </p>
              <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4 text-xs text-zinc-500">
                <span>Scroll to learn</span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-400">
                  Flip
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
