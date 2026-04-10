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
        <div className="mb-8 flex justify-center">
          <img
            src="/logo.png"
            alt="Sclearn logo"
            width={112}
            height={112}
            className="h-24 w-24 object-contain sm:h-28 sm:w-28"
            decoding="async"
          />
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <div className="space-y-6">
            <p className="font-medium text-emerald-400">
              Scroll + Learn = Sclearn
            </p>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-zinc-100 sm:text-5xl md:text-6xl">
              Turn Your Notes Into Addictive Study Scrolls
            </h1>
            <p className="mx-auto max-w-xl text-pretty text-base text-zinc-400 sm:text-lg">
              Sclearn combines scrolling and learning. Generate flashcards from
              your notes and study them with an addictive swipe-based interface
              designed to keep you engaged.
            </p>
          </div>

          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
            <Link
              to="/app"
              onClick={onAppCtaClick}
              className="inline-flex min-h-[48px] touch-manipulation items-center justify-center rounded-xl bg-emerald-500 px-8 py-3.5 text-center text-base font-semibold text-zinc-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 sm:min-h-[44px]"
            >
              Start Scrolling to Learn
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
