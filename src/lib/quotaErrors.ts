export type BillingPlan = "free" | "pro";

export type QuotaKind = "generation" | "upload";

export class QuotaBlockedError extends Error {
  readonly quotaKind: QuotaKind;
  readonly plan: BillingPlan;

  constructor(message: string, quotaKind: QuotaKind, plan: BillingPlan) {
    super(message);
    this.name = "QuotaBlockedError";
    this.quotaKind = quotaKind;
    this.plan = plan;
  }
}

export function isQuotaBlockedError(e: unknown): e is QuotaBlockedError {
  return e instanceof QuotaBlockedError;
}
