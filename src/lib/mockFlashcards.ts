import type { Flashcard } from "./flashcard";

const MAX_CARDS = 10;

export function generateMockFlashcards(notes: string): Flashcard[] {
  const trimmed = notes.trim();
  if (!trimmed) return [];

  const byParagraph = trimmed
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const segments: string[] =
    byParagraph.length > 0
      ? byParagraph.slice(0, MAX_CARDS)
      : trimmed
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, MAX_CARDS);

  if (segments.length === 0) {
    return [{ question: "What did you capture in your notes?", answer: trimmed }];
  }

  return segments.map((segment, i) => {
    const preview = segment.slice(0, 72).trim();
    const question =
      preview.length < segment.length
        ? `Recall: "${preview}…"`
        : `What is covered in segment ${i + 1}?`;
    return { question, answer: segment };
  });
}
