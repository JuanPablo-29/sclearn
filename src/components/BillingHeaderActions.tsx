import { useState } from "react";
import { Link } from "react-router-dom";
import { trackEvent } from "@/lib/analytics";
import { createCheckoutSessionUrl, createCustomerPortalUrl } from "@/lib/billing";
import { useAuth } from "@/context/AuthContext";

export function BillingHeaderActions() {
  const { user, billing, billingLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!user || billingLoading) return null;

  const isPro = billing?.plan === "pro";

  async function goCheckout() {
    setErr(null);
    setBusy(true);
    try {
      trackEvent("checkout_started");
      const url = await createCheckoutSessionUrl();
      window.location.href = url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  async function goPortal() {
    setErr(null);
    setBusy(true);
    try {
      const url = await createCustomerPortalUrl();
      window.location.href = url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not open billing portal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {err ? (
        <span className="max-w-[200px] text-right text-xs text-red-400" title={err}>
          {err}
        </span>
      ) : null}
      {isPro ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void goPortal()}
          className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-lg border border-zinc-600 px-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          {busy ? "…" : "Manage Subscription"}
        </button>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            to="/pricing"
            className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-lg px-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            Pricing
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => void goCheckout()}
            className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? "…" : "Upgrade to Pro"}
          </button>
        </div>
      )}
    </div>
  );
}
