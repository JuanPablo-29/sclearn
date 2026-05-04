import { Link } from "react-router-dom";
import { CTA } from "@/components/landing/CTA";
import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { trackEvent } from "@/lib/analytics";

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
              Open app
            </Link>
          </div>
        </div>
      </header>

      <main>
        <Hero onAppCtaClick={handleStartClick} />

        <Features />
        <HowItWorks />
        <CTA onAppCtaClick={handleStartClick} />
      </main>

      <Footer />
    </div>
  );
}
