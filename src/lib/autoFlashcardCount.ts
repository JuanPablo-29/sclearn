/**
 * Mirrors `computeAutoCardCount` in `generate-flashcards` Edge Function
 * so the UI can preview the auto-selected size.
 */
export function suggestedFlashcardCountFromNotesLength(
  notesLength: number,
  maxCards: number
): number {
  if (notesLength <= 0) return Math.min(4, maxCards);
  const base = Math.ceil(notesLength / 400);
  return Math.min(maxCards, Math.max(4, base + 2));
}
