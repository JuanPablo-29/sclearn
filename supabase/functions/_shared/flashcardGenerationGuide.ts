/**
 * Shared instructional text for flashcard generation (Edge Functions).
 * Keep JSON/output discipline at the end so models anchor on structure.
 */

export const FLASHCARD_JSON_OUTPUT_RULE =
  'Respond with ONLY a valid JSON array of objects. Each object must have exactly two string keys: "question" and "answer". No markdown fences, no commentary, no extra keys.';

export const FLASHCARD_EDUCATION_RULES = `You convert study material into high-quality flashcards for active recall.

Coverage and structure:
- Generate comprehensive flashcards covering major concepts, subtopics, bullet points, numbered items, vocabulary where relevant, and learning objectives in the material.
- Prefer multiple specific flashcards over a few broad summary cards.
- When the source has bullets, sub-bullets, review objectives, standards, or headings, create separate cards for distinct teachable ideas when appropriate.
- Do not skip subtopics; do not combine unrelated concepts into one card. Each card should be atomic (one core idea per card).
- Maximize educational coverage while avoiding duplicates and near-duplicate wording.

Question style:
- Avoid weak generic questions (e.g. a lone "What is thermodynamics?" with no angle). Prefer questions that require understanding: compare/contrast, cause and effect, how/why, applications, definitions in context, and interpreting relationships.
- Good examples: "How do exothermic and endothermic reactions differ in energy transfer?", "Why do catalysts increase reaction rates without being consumed?", "What does activation energy represent on a reaction coordinate diagram?"

Answers:
- Keep answers concise, accurate, and directly useful for studying.

Quality controls:
- No filler, no padding, no trivial rephrasings of the same fact.`;

export const UPLOAD_SOURCE_ANALYSIS_RULES = `When the material comes from an image, PDF, or extracted document text, analyze the entire source carefully: titles and headings, bullet lists and sub-bullets, vocabulary and key terms, standards or rubrics, review objectives, and any readable diagram or figure labels. Treat each meaningful bullet or listed objective as a potential flashcard topic when it encodes a testable idea.`;

/** Heuristic hint for pasted or extracted text (auto-count modes). */
export function notesDensityHint(notes: string, maxCards: number): string {
  const t = notes.trim();
  if (t.length < 120) return "";
  const words = t.split(/\s+/).filter(Boolean).length;
  const bulletish = (t.match(/^\s*[-*•]\s.+/gm) ?? []).length;
  if (words >= 200 || bulletish >= 5) {
    return ` The notes look dense (many bullets, headings, objectives, or a long study guide). Lean toward a higher card count—often in the range of roughly 15–${Math.min(35, maxCards)} cards when the ideas clearly support it—up to the hard maximum of ${maxCards}, prioritizing thorough granular coverage over a small set of sweeping overview cards. Still avoid filler and duplication.`;
  }
  return "";
}

/** Vision path: encourage thorough scan of visually dense pages. */
export function imageDensityHint(maxCards: number): string {
  return ` If the page is visually dense (many bullets, section headings, objectives, or labels), lean toward more cards—often well above a minimal set—up to ${maxCards}, without filler or duplicate concepts.`;
}
