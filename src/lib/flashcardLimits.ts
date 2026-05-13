/** Client-side caps per generation (must match Edge Functions). */
export const FREE_MAX_FLASHCARDS_PER_RUN = 20;
export const PRO_MAX_FLASHCARDS_PER_RUN = 50;

export function maxFlashcardsPerRun(
  plan: "pro" | "free" | string | null | undefined
): number {
  return plan === "pro"
    ? PRO_MAX_FLASHCARDS_PER_RUN
    : FREE_MAX_FLASHCARDS_PER_RUN;
}
