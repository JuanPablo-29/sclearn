import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { trackEvent } from "@/lib/analytics";
import { createCheckoutSessionUrl } from "@/lib/billing";
import { useAuth } from "@/context/AuthContext";

const freeFeatures = [
  "3 AI generations per day",
  "1 file / image upload per day",
  "Save up to 3 decks",
];

const proFeatures = [
  "200 AI generations per month",
  "50 file / image uploads per month",
  "Save up to 10 decks",
  "Future premium tools",
];

export default function Pricing() {
  const navigate = useNavigate();
  const { user, billingLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    trackEvent("pricing_viewed");
  }, []);

  async function upgrade() {
    setErr(null);
    if (!user) {
      navigate("/login", { state: { from: "/pricing" } });
      return;
    }
    setBusy(true);
    try {
      trackEvent("checkout_started");
      const url = await createCheckoutSessionUrl();
      window.location.href = url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Checkout failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <Link
            to="/"
            className="text-sm font-medium text-zinc-400 hover:text-zinc-200"
          >
            ← Sclearn
          </Link>
          <Link
            to="/app"
            className="text-sm text-emerald-400 hover:text-emerald-300"
          >
            Generator
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Simple pricing
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-base text-zinc-400 sm:text-lg">
            Start free, upgrade when Sclearn becomes part of your daily study
            flow.
          </p>
        </div>

        {err ? (
          <p
            className="mx-auto mt-8 max-w-lg rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-center text-sm text-red-200"
            role="alert"
          >
            {err}
          </p>
        ) : null}

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <section className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-zinc-50">Free</h2>
            <p className="mt-1 text-sm text-zinc-500">For occasional study bursts</p>
            <p className="mt-6 text-3xl font-bold text-zinc-100">$0</p>
            <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-zinc-300">
              {freeFeatures.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-emerald-500" aria-hidden>
                    ✓
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/register"
              className="mt-8 inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl border border-zinc-600 px-4 py-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-800"
            >
              Get started free
            </Link>
          </section>

          <section className="relative flex flex-col rounded-2xl border border-emerald-800/60 bg-gradient-to-b from-emerald-950/40 to-zinc-900/80 p-6 shadow-lg shadow-emerald-950/20 sm:p-8">
            <div className="absolute right-4 top-4 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
              Popular
            </div>
            <h2 className="text-xl font-semibold text-zinc-50">Pro</h2>
            <p className="mt-1 text-sm text-zinc-400">For serious learners</p>
            <p className="mt-6 text-3xl font-bold text-zinc-50">
              $7<span className="text-base font-normal text-zinc-500">/month</span>
            </p>
            <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-zinc-200">
              {proFeatures.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-emerald-400" aria-hidden>
                    ✓
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={busy || billingLoading}
              onClick={() => void upgrade()}
              className="mt-8 inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? "Redirecting…" : "Upgrade to Pro"}
            </button>
            {!user ? (
              <p className="mt-2 text-center text-xs text-zinc-500">
                You will be asked to sign in before checkout.
              </p>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
