import { Link } from "react-router-dom";
import { CTA } from "@/components/landing/CTA";
import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { trackEvent } from "@/lib/analytics";

const scrollDemoBullets = [
  "• Swipe through flashcards effortlessly",
  "• Tap to reveal answers instantly",
  "• Study longer without losing focus",
];

const whyScrollingPoints = [
  "• Bite-sized information improves retention",
  "• Continuous scrolling keeps your brain engaged",
  "• Instant feedback strengthens memory",
];

export default function Landing() {
  const handleStartClick = () => {
    trackEvent("landing_cta_clicked");
  };

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
              Open app
            </Link>
          </div>
        </div>
      </header>

      <main>
        <Hero onAppCtaClick={handleStartClick} />

        <section className="border-b border-zinc-800/80 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl space-y-4 px-6 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
              Learning That Feels Like Scrolling
            </h2>
            <p className="text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg">
              Instead of flipping through boring flashcards, Sclearn lets you
              study by scrolling through concepts. Each swipe reveals a new idea,
              making studying feel fast, engaging, and addictive.
            </p>
            <ul className="mx-auto max-w-md space-y-3 pt-2 text-left text-sm text-zinc-300 sm:text-base">
              {scrollDemoBullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </section>

        <Features />

        <section className="border-b border-zinc-800/80 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
              Why Scrolling Works for Learning
            </h2>
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
              {whyScrollingPoints.map((point) => (
                <div
                  key={point}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-5 py-6 text-center"
                >
                  <p className="text-sm leading-relaxed text-zinc-300 sm:text-base">
                    {point}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <HowItWorks />
        <CTA onAppCtaClick={handleStartClick} />
      </main>

      <Footer />
    </div>
  );
}
