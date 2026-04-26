import { supabase } from "@/lib/supabase";

export type UsageBucket = {
  used: number;
  limit: number;
  remaining: number;
};

export type UsageSummary = {
  plan: "free" | "pro";
  generations: UsageBucket;
  uploads: UsageBucket;
  decks: UsageBucket;
};

function asUsageBucket(value: unknown): UsageBucket {
  const v = (value ?? {}) as Record<string, unknown>;
  const used = typeof v.used === "number" ? v.used : 0;
  const limit = typeof v.limit === "number" ? v.limit : 0;
  const remaining = typeof v.remaining === "number" ? v.remaining : 0;
  return { used, limit, remaining };
}

export async function getUsageSummary(): Promise<UsageSummary> {
  const { data, error } = await supabase.rpc("get_usage_summary");
  if (error) {
    throw new Error(error.message);
  }

  const o = (data ?? {}) as Record<string, unknown>;
  return {
    plan: o.plan === "pro" ? "pro" : "free",
    generations: asUsageBucket(o.generations),
    uploads: asUsageBucket(o.uploads),
    decks: asUsageBucket(o.decks),
  };
}
