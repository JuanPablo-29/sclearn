import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Scroller } from "@/components/Scroller";
import { useAuth } from "@/context/AuthContext";
import { trackEvent } from "@/lib/analytics";
import { fetchUserFlashcards } from "@/lib/flashcardsDb";
import type { Flashcard } from "@/lib/flashcard";
import { supabase } from "@/lib/supabase";

export default function Learn() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const studySessionTracked = useRef(false);

  useEffect(() => {
    if (authLoading || loading || !user || error || cards.length === 0) return;
    if (studySessionTracked.current) return;
    studySessionTracked.current = true;
    trackEvent("study_session_started", { card_count: cards.length });
  }, [authLoading, loading, user, error, cards.length]);

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

  if (!user) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-zinc-950 px-4 py-8 text-center text-zinc-100 sm:px-6">
        <p className="max-w-sm text-sm text-zinc-400 sm:text-base">
          Sign in to view your saved flashcards.
        </p>
        <Link
          to="/login"
          className="inline-flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Sign in
        </Link>
        <Link to="/app" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Home
        </Link>
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

  if (cards.length === 0) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-zinc-950 px-4 py-8 text-center text-zinc-100 sm:px-6">
        <p className="max-w-sm text-sm text-zinc-400 sm:text-base">
          No flashcards yet. Generate a deck on the home page.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            to="/app"
            className="inline-flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Back to input
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-full border border-zinc-700 px-6 py-3 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      <Scroller cards={cards} />
    </div>
  );
}
