import type { Flashcard } from "@/lib/flashcard";
import { supabase } from "@/lib/supabase";

export function deckLimitForPlan(plan: string | null | undefined): number {
  return plan === "pro" ? 10 : 3;
}

export function deckLimitExceededMessage(plan: string | null | undefined): string {
  if (plan === "pro") {
    return "You've reached the Pro limit of 10 saved decks. Delete one to save another.";
  }
  return "You've reached the free limit of 3 saved decks. Delete one to save another, or upgrade to Pro for more space.";
}

export function isDeckSaveLimitError(message: string): boolean {
  return (
    message.includes("saved deck limit") ||
    message.includes("10 saved decks") ||
    message.includes("3 saved decks") ||
    message.includes("Pro limit of 10") ||
    message.includes("free limit of 3")
  );
}

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
  return message.toLowerCase().includes("deck limit reached");
}

function mapSaveError(err: { message?: string }): string {
  const msg = err.message ?? "";
  if (isDeckLimitDbMessage(msg)) {
    return "You've reached your saved deck limit for this plan. Delete a deck or upgrade to Pro for more space.";
  }
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

async function fetchUserPlan(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return "free";
  const row = data as { plan?: string };
  return typeof row.plan === "string" ? row.plan : "free";
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
 * Persists a deck for the signed-in user. Enforces plan deck cap (client + DB trigger).
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

  const plan = await fetchUserPlan(userId);
  const limit = deckLimitForPlan(plan);
  const count = await countUserDecks();
  if (count >= limit) {
    throw new Error(deckLimitExceededMessage(plan));
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

/** Safe payload for anonymous viewers (no user_id). */
export type PublicDeckPayload = {
  title: string;
  cards: Flashcard[];
};

function shareOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

function slugifyTitle(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s.length > 0 ? s : "deck";
}

function randomSuffix(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]!;
  }
  return out;
}

function isUniqueViolation(err: { code?: string; message?: string }): boolean {
  return (
    err.code === "23505" ||
    Boolean(err.message?.toLowerCase().includes("duplicate")) ||
    Boolean(err.message?.toLowerCase().includes("unique"))
  );
}

/**
 * Load a publicly shared deck by slug (anon-safe RPC — only title + cards).
 */
export async function getPublicDeckBySlug(
  slug: string
): Promise<PublicDeckPayload | null> {
  const trimmed = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!trimmed) return null;

  const { data, error } = await supabase.rpc("get_public_deck_by_slug", {
    p_slug: trimmed,
  });

  if (error) throw new Error(error.message);
  if (data == null || typeof data !== "object") return null;

  const o = data as Record<string, unknown>;
  const title = o.title;
  const cardsRaw = o.cards;
  if (typeof title !== "string") return null;
  const cards = parseCardsJson(cardsRaw);
  if (cards.length === 0) return null;

  return { title: title.trim() || "Shared deck", cards };
}

/**
 * Turn on public sharing. If `share_slug` was cleared only in DB by mistake,
 * generates a new slug; otherwise reuses slug and only sets `is_public`.
 * @returns Full URL to copy (e.g. `https://example.com/deck/biology-a8f3`)
 */
export async function enableDeckSharing(deckId: string): Promise<string> {
  await requireUserId();
  const deck = await getDeckById(deckId);
  if (!deck) throw new Error("Deck not found.");

  const origin = shareOrigin();

  if (deck.share_slug) {
    const { error } = await supabase
      .from("decks")
      .update({ is_public: true })
      .eq("id", deckId);
    if (error) throw new Error(error.message);
    return `${origin}/deck/${deck.share_slug}`;
  }

  let lastErr: Error | null = null;
  for (let i = 0; i < 24; i++) {
    const newSlug = `${slugifyTitle(deck.title)}-${randomSuffix(4)}`;
    const { error } = await supabase
      .from("decks")
      .update({ is_public: true, share_slug: newSlug })
      .eq("id", deckId);

    if (!error) {
      return `${origin}/deck/${newSlug}`;
    }
    if (isUniqueViolation(error)) {
      lastErr = new Error(error.message);
      continue;
    }
    throw new Error(error.message);
  }
  throw lastErr ?? new Error("Could not create a unique share link.");
}

/** Stops public access; keeps `share_slug` for a future re-share. */
export async function disableDeckSharing(deckId: string): Promise<void> {
  await requireUserId();
  const { error } = await supabase
    .from("decks")
    .update({ is_public: false })
    .eq("id", deckId);
  if (error) throw new Error(error.message);
}
