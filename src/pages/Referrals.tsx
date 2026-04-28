import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

type MyReferral = {
  id: string;
  status: "pending" | "converted" | "paid";
  created_at: string;
  converted_at: string | null;
  paid_at: string | null;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function Referrals() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [rows, setRows] = useState<MyReferral[]>([]);

  useEffect(() => {
    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [{ data: profile, error: profileError }, { data, error: referralsError }] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("referral_code")
              .eq("id", user.id)
              .maybeSingle(),
            supabase
              .from("referrals")
              .select("id,status,created_at,converted_at,paid_at")
              .eq("referrer_id", user.id)
              .order("created_at", { ascending: false }),
          ]);

        if (profileError) throw profileError;
        if (referralsError) throw referralsError;

        const p = (profile ?? {}) as { referral_code?: string | null };
        setCode(p.referral_code ?? null);
        setRows((data ?? []) as MyReferral[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load referrals");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [user]);

  const convertedCount = useMemo(
    () => rows.filter((r) => r.status === "converted").length,
    [rows]
  );
  const estimatedEarnings = convertedCount * 2;

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 text-zinc-400">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-100">
        <p className="text-sm text-zinc-400">Sign in to view your referral stats.</p>
        <Link to="/login" className="text-emerald-400 hover:text-emerald-300">
          Sign in
        </Link>
      </div>
    );
  }

  const link =
    code && typeof window !== "undefined"
      ? `${window.location.origin}/?r=${encodeURIComponent(code)}`
      : null;

  return (
    <div className="min-h-[100dvh] bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">My Referrals</h1>
          <Link to="/app" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Home
          </Link>
        </div>

        {error ? (
          <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-sm font-medium text-zinc-200">Your Creator Link</h2>
          {code ? (
            <>
              <p className="mt-2 text-xs text-zinc-400">Code: {code}</p>
              <input
                readOnly
                value={link ?? ""}
                onFocus={(e) => e.currentTarget.select()}
                className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              />
            </>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">
              No referral code assigned yet. Ask admin to assign one.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-sm font-medium text-zinc-200">Performance</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Converted referrals: {convertedCount}
          </p>
          <p className="text-sm text-zinc-400">
            Estimated earnings (manual payout): ${estimatedEarnings}
          </p>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="mb-3 text-sm font-medium text-zinc-200">Referral Events</h2>
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-500">No referrals yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-zinc-400">
                  <tr>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Created</th>
                    <th className="py-2 pr-3">Converted</th>
                    <th className="py-2 pr-3">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-zinc-800">
                      <td className="py-2 pr-3">{r.status}</td>
                      <td className="py-2 pr-3">{formatDate(r.created_at)}</td>
                      <td className="py-2 pr-3">
                        {r.converted_at ? formatDate(r.converted_at) : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {r.paid_at ? formatDate(r.paid_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
