import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/context/AuthContext";

export default function BillingSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { refreshBilling } = useAuth();

  useEffect(() => {
    void refreshBilling();
  }, [refreshBilling]);

  useEffect(() => {
    if (sessionId) {
      trackEvent("subscription_started", { session_id: sessionId });
    }
  }, [sessionId]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-100">
      <div className="max-w-md rounded-2xl border border-emerald-900/50 bg-zinc-900/60 px-8 py-10">
        <div
          className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-600/20 text-2xl text-emerald-400"
          aria-hidden
        >
          ✓
        </div>
        <h1 className="text-xl font-semibold text-zinc-50">You are on Pro</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Thanks for supporting Sclearn. Your higher limits are active — refresh
          if you do not see them immediately.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/app"
            className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Back to generator
          </Link>
          <Link
            to="/learn"
            className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl border border-zinc-600 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Start studying
          </Link>
        </div>
      </div>
    </div>
  );
}
