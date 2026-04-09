import type { SupabaseClient } from "@supabase/supabase-js";
import type { Flashcard } from "./flashcard";

export async function fetchUserFlashcards(
  client: SupabaseClient,
  userId: string
): Promise<Flashcard[]> {
  const { data, error } = await client
    .from("flashcards")
    .select("question, answer")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return data.map((row) => ({
    question: row.question,
    answer: row.answer,
  }));
}

/** Replaces all flashcards for the user with a new deck */
export async function replaceUserFlashcards(
  client: SupabaseClient,
  userId: string,
  cards: Flashcard[]
): Promise<void> {
  const { error: delError } = await client
    .from("flashcards")
    .delete()
    .eq("user_id", userId);

  if (delError) throw new Error(delError.message);

  if (cards.length === 0) return;

  const rows = cards.map((c) => ({
    user_id: userId,
    question: c.question,
    answer: c.answer,
  }));

  const { error: insError } = await client.from("flashcards").insert(rows);

  if (insError) throw new Error(insError.message);
}
