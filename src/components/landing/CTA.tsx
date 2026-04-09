import { Link } from "react-router-dom";

export function CTA() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/90 to-zinc-950 px-6 py-14 text-center sm:px-10 sm:py-16">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
            Ready to study smarter?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-zinc-400 sm:text-base">
            Jump in and turn your next set of notes into a deck in minutes.
          </p>
          <Link
            to="/app"
            className="mt-8 inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
          >
            Generate Flashcards Now
          </Link>
        </div>
      </div>
    </section>
  );
}
