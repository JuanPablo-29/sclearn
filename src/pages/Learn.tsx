import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SaveDeckModal } from "@/components/SaveDeckModal";
import { Scroller } from "@/components/Scroller";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useAuth } from "@/context/AuthContext";
import { trackEvent } from "@/lib/analytics";
import { demoDeck } from "@/lib/demoDeck";
import { deckLimitForPlan, getDeckById } from "@/lib/decks";
import { fetchUserFlashcards } from "@/lib/flashcardsDb";
import type { Flashcard } from "@/lib/flashcard";
import { supabase } from "@/lib/supabase";

export default function Learn() {
  const { user, loading: authLoading, billing } = useAuth();
  const [searchParams] = useSearchParams();
  const deckId = searchParams.get("deck");

  const [sessionCards, setSessionCards] = useState<Flashcard[]>([]);
  const [savedDeckCards, setSavedDeckCards] = useState<Flashcard[] | null>(
    null
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const studySessionTracked = useRef(false);
  const deckCap = deckLimitForPlan(billing?.plan);

  const inSavedDeckMode = Boolean(user && deckId);

  const cardsToShow: Flashcard[] =
    savedDeckCards && savedDeckCards.length > 0
      ? savedDeckCards
      : sessionCards.length > 0
        ? sessionCards
        : inSavedDeckMode
          ? []
          : demoDeck;

  const studySource =
    savedDeckCards && savedDeckCards.length > 0
      ? "saved_deck"
      : sessionCards.length > 0
        ? "session"
        : "demo";

  const canSaveSessionDeck = Boolean(user && studySource === "session");

  useEffect(() => {
    if (authLoading || dataLoading || loadError || cardsToShow.length === 0)
      return;
    if (studySessionTracked.current) return;
    studySessionTracked.current = true;
    trackEvent("study_session_started", {
      card_count: cardsToShow.length,
      source: studySource,
      deck_id: deckId ?? undefined,
    });
  }, [
    authLoading,
    dataLoading,
    loadError,
    cardsToShow.length,
    studySource,
    deckId,
  ]);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;
    studySessionTracked.current = false;

    async function load() {
      setDataLoading(true);
      setLoadError(null);

      try {
        if (!user) {
          setSessionCards([]);
          setSavedDeckCards(null);
          if (deckId) {
            setLoadError(
              "Sign in to open a saved deck, or remove ?deck= from the URL to try the demo."
            );
          }
          return;
        }

        if (deckId) {
          const deck = await getDeckById(deckId);
          if (cancelled) return;
          if (!deck || deck.cards.length === 0) {
            setSavedDeckCards(null);
            setSessionCards([]);
            setLoadError("Deck not found or has no cards.");
            return;
          }
          setSavedDeckCards(deck.cards);
          setSessionCards([]);
          return;
        }

        const data = await fetchUserFlashcards(supabase, user.id);
        if (cancelled) return;
        setSessionCards(data);
        setSavedDeckCards(null);
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Failed to load study content"
          );
          setSessionCards([]);
          setSavedDeckCards(null);
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, deckId]);

  if (authLoading || dataLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 text-zinc-400">
        Loading…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-center text-zinc-100">
        <p className="max-w-sm text-sm text-red-400">{loadError}</p>
        {!user && deckId ? (
          <Link
            to="/login"
            className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Sign in
          </Link>
        ) : null}
        <div className="flex flex-wrap justify-center gap-3 text-sm">
          <Link
            to="/decks"
            className="text-emerald-400 hover:text-emerald-300"
          >
            My Decks
          </Link>
          <Link to="/app" className="text-zinc-500 hover:text-zinc-300">
            ← Home
          </Link>
          <Link to="/learn" className="text-zinc-500 hover:text-zinc-300">
            Demo feed
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-950 text-zinc-100">
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
      />
      <SaveDeckModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        cards={sessionCards}
        onDeckLimit={() => setUpgradeOpen(true)}
      />
      {canSaveSessionDeck ? (
        <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/80 px-3 py-2.5 sm:px-4">
          <div className="mx-auto flex max-w-lg flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-center text-xs text-zinc-400 sm:text-left sm:text-sm">
              Like this deck? Save it to your library (up to {deckCap} decks on
              your plan).
            </p>
            <button
              type="button"
              onClick={() => setSaveModalOpen(true)}
              className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl border border-emerald-700/50 bg-emerald-600/15 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-600/25"
            >
              Save deck
            </button>
          </div>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col">
        <Scroller cards={cardsToShow} />
      </div>
    </div>
  );
}
