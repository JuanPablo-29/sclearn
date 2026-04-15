import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Scroller } from "@/components/Scroller";
import { useAuth } from "@/context/AuthContext";
import { trackEvent } from "@/lib/analytics";
import { demoDeck } from "@/lib/demoDeck";
import { fetchUserFlashcards } from "@/lib/flashcardsDb";
import type { Flashcard } from "@/lib/flashcard";
import { supabase } from "@/lib/supabase";

export default function Learn() {
  const { user, loading: authLoading } = useAuth();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const studySessionTracked = useRef(false);
  const cardsToShow = cards.length > 0 ? cards : demoDeck;

  useEffect(() => {
    if (authLoading || loading || error || cardsToShow.length === 0) return;
    if (studySessionTracked.current) return;
    studySessionTracked.current = true;
    trackEvent("study_session_started", {
      card_count: cardsToShow.length,
      source: cards.length > 0 ? "user" : "demo",
    });
  }, [authLoading, loading, error, cards.length, cardsToShow.length]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setCards([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchUserFlashcards(supabase, user.id)
      .then((data) => {
        if (!cancelled) {
          setCards(data);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load cards");
          setCards([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 text-zinc-400">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-center text-zinc-100">
        <p className="text-sm text-red-400">{error}</p>
        <Link
          to="/app"
          className="text-sm text-emerald-400 hover:text-emerald-300"
        >
          ← Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      <Scroller cards={cardsToShow} />
    </div>
  );
}
