import { trackEvent } from "@/lib/analytics";
import { QuotaBlockedError, type BillingPlan } from "@/lib/quotaErrors";
import { supabase } from "@/lib/supabase";

type ReserveResult = {
  allowed?: boolean;
  plan?: string;
  code?: string;
};

/**
 * Call before a file/image upload succeeds. Throws {@link QuotaBlockedError} when over quota.
 * After a successful upload, call {@link recordSuccessfulUpload}.
 */
export async function assertUploadAllowed(): Promise<void> {
  const { data, error } = await supabase.rpc("reserve_upload_slot");
  if (error) {
    throw new Error(error.message);
  }
  const o = data as ReserveResult | null;
  if (o?.allowed) return;

  const plan: BillingPlan = o?.plan === "pro" ? "pro" : "free";
  trackEvent("paywall_hit_upload", { plan });

  if (plan === "pro") {
    throw new QuotaBlockedError(
      "You've used your 50 uploads this month.",
      "upload",
      "pro"
    );
  }
  throw new QuotaBlockedError(
    "You've used your free upload today.",
    "upload",
    "free"
  );
}

export async function recordSuccessfulUpload(): Promise<void> {
  const { error } = await supabase.rpc("record_usage_event", {
    p_type: "upload",
  });
  if (error) {
    throw new Error(error.message);
  }
}
