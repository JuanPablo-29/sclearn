import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type ReferrerRow = {
  referrer_id: string;
  email: string | null;
  referral_code: string;
  conversions: number;
  pending: number;
  paid: number;
};

type ReferralRow = {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  status: "pending" | "converted" | "paid";
  created_at: string;
  converted_at: string | null;
  paid_at: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function AdminReferrals() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referrers, setReferrers] = useState<ReferrerRow[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [codeUserId, setCodeUserId] = useState("");
  const [code, setCode] = useState("");
  const [filterReferrer, setFilterReferrer] = useState<string>("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [{ data: refRows, error: refErr }, { data: listRows, error: listErr }] =
        await Promise.all([
          supabase.rpc("admin_list_referrers"),
          supabase.rpc("admin_list_referrals", {
            p_referrer: filterReferrer || null,
          }),
        ]);

      if (refErr) throw refErr;
      if (listErr) throw listErr;
      setReferrers((refRows ?? []) as ReferrerRow[]);
      setReferrals((listRows ?? []) as ReferralRow[]);
      setSelectedIds([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load referrals data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when filter changes
  }, [filterReferrer]);

  const convertedRows = useMemo(
    () => referrals.filter((r) => r.status === "converted"),
    [referrals]
  );

  async function setReferralCode() {
    if (!codeUserId.trim() || !code.trim()) return;
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc("admin_set_referral_code", {
        p_user_id: codeUserId.trim(),
        p_code: code.trim().toLowerCase(),
      });
      if (rpcError) throw rpcError;
      setCode("");
      setCodeUserId("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set referral code");
    }
  }

  async function markPaid() {
    if (!selectedIds.length) return;
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc("admin_mark_paid", {
        p_ids: selectedIds,
      });
      if (rpcError) throw rpcError;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark paid");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Referrals Admin</h1>
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
          <h2 className="text-sm font-medium text-zinc-200">Assign Referral Code</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              placeholder="User ID"
              value={codeUserId}
              onChange={(e) => setCodeUserId(e.currentTarget.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
            <input
              placeholder="Code (e.g. tiktok-john)"
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
            <button
              type="button"
              onClick={() => void setReferralCode()}
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Save
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="mb-3 text-sm font-medium text-zinc-200">Creators</h2>
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-zinc-400">
                  <tr>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Code</th>
                    <th className="py-2 pr-3">Converted</th>
                    <th className="py-2 pr-3">Pending</th>
                    <th className="py-2 pr-3">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {referrers.map((r) => (
                    <tr key={r.referrer_id} className="border-t border-zinc-800">
                      <td className="py-2 pr-3">{r.email ?? "—"}</td>
                      <td className="py-2 pr-3">{r.referral_code}</td>
                      <td className="py-2 pr-3">{r.conversions}</td>
                      <td className="py-2 pr-3">{r.pending}</td>
                      <td className="py-2 pr-3">{r.paid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-zinc-200">Referrals</h2>
            <div className="flex gap-2">
              <input
                placeholder="Filter by referrer UUID"
                value={filterReferrer}
                onChange={(e) => setFilterReferrer(e.currentTarget.value)}
                className="min-w-[280px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
              />
              <button
                type="button"
                disabled={selectedIds.length === 0}
                onClick={() => void markPaid()}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-zinc-700 px-3 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                Mark Paid ({selectedIds.length})
              </button>
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] text-left text-sm">
                <thead className="text-zinc-400">
                  <tr>
                    <th className="py-2 pr-2">Pay</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Referrer</th>
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">Created</th>
                    <th className="py-2 pr-3">Converted</th>
                    <th className="py-2 pr-3">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => {
                    const selectable = r.status === "converted";
                    return (
                      <tr key={r.id} className="border-t border-zinc-800">
                        <td className="py-2 pr-2">
                          <input
                            type="checkbox"
                            disabled={!selectable}
                            checked={selectedIds.includes(r.id)}
                            onChange={() => toggleSelect(r.id)}
                          />
                        </td>
                        <td className="py-2 pr-3">{r.status}</td>
                        <td className="py-2 pr-3">{r.referrer_id}</td>
                        <td className="py-2 pr-3">{r.referred_user_id}</td>
                        <td className="py-2 pr-3">{formatDate(r.created_at)}</td>
                        <td className="py-2 pr-3">{formatDate(r.converted_at)}</td>
                        <td className="py-2 pr-3">{formatDate(r.paid_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loading && convertedRows.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-500">No converted referrals yet.</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
