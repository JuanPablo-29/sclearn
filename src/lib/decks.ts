import type { Flashcard } from "@/lib/flashcard";
import { supabase } from "@/lib/supabase";

/** Max saved decks per user (free tier). Kept in one place for future plans / paywall. */
export const FREE_DECK_LIMIT = 3;

export const DECK_LIMIT_ERROR =
  "You've reached the free limit of 3 saved decks. Delete one to save another.";

/** Row shape from `public.decks` — ready for sharing fields in phase 2. */
export type SavedDeck = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cards: Flashcard[];
  created_at: string;
  updated_at: string;
  is_public: boolean;
  share_slug: string | null;
};

type DeckRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cards: unknown;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  share_slug: string | null;
};

function parseCardsJson(value: unknown): Flashcard[] {
  if (!Array.isArray(value)) return [];
  const out: Flashcard[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const q = o.question;
    const a = o.answer;
    if (typeof q !== "string" || typeof a !== "string") continue;
    const question = q.trim();
    const answer = a.trim();
    if (!question || !answer) continue;
    out.push({ question, answer });
  }
  return out;
}

function mapRow(row: DeckRow): SavedDeck {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    cards: parseCardsJson(row.cards),
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_public: row.is_public,
    share_slug: row.share_slug,
  };
}

function isDeckLimitDbMessage(message: string): boolean {
  return message.includes("free limit of 3 saved decks");
}

function mapSaveError(err: { message?: string }): string {
  const msg = err.message ?? "";
  if (isDeckLimitDbMessage(msg)) return DECK_LIMIT_ERROR;
  return msg || "Failed to save deck";
}

async function requireUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Sign in to manage saved decks.");
  }
  return user.id;
}

export async function getUserDecks(): Promise<SavedDeck[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("decks")
    .select(
      "id, user_id, title, description, cards, created_at, updated_at, is_public, share_slug"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!data) return [];
  return (data as DeckRow[]).map(mapRow);
}

export async function getDeckById(id: string): Promise<SavedDeck | null> {
  await requireUserId();
  const { data, error } = await supabase
    .from("decks")
    .select(
      "id, user_id, title, description, cards, created_at, updated_at, is_public, share_slug"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  const deck = mapRow(data as DeckRow);
  if (deck.cards.length === 0) return null;
  return deck;
}

export async function countUserDecks(): Promise<number> {
  const userId = await requireUserId();
  const { count, error } = await supabase
    .from("decks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Persists a deck for the signed-in user. Enforces {@link FREE_DECK_LIMIT}
 * (client pre-check + DB trigger).
 */
export async function saveDeck(params: {
  title: string;
  description?: string | null;
  cards: Flashcard[];
}): Promise<SavedDeck> {
  const userId = await requireUserId();
  if (!params.cards.length) {
    throw new Error("Add at least one flashcard before saving.");
  }

  const count = await countUserDecks();
  if (count >= FREE_DECK_LIMIT) {
    throw new Error(DECK_LIMIT_ERROR);
  }

  const title = params.title.trim() || "Untitled deck";

  const { data, error } = await supabase
    .from("decks")
    .insert({
      user_id: userId,
      title,
      description: params.description?.trim() || null,
      cards: params.cards,
      is_public: false,
      share_slug: null,
    })
    .select(
      "id, user_id, title, description, cards, created_at, updated_at, is_public, share_slug"
    )
    .single();

  if (error) {
    throw new Error(mapSaveError(error));
  }
  return mapRow(data as DeckRow);
}

export async function deleteDeck(id: string): Promise<void> {
  await requireUserId();
  const { error } = await supabase.from("decks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
