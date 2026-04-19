import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Scroller } from "@/components/Scroller";
import { trackEvent } from "@/lib/analytics";
import {
  getPublicDeckBySlug,
  type PublicDeckPayload,
} from "@/lib/decks";

export default function SharedDeck() {
  const { slug } = useParams<{ slug: string }>();
  const [deck, setDeck] = useState<PublicDeckPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const openedSlugRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!slug?.trim()) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setLoading(true);
      setNotFound(false);
      try {
        const data = await getPublicDeckBySlug(slug);
        if (cancelled) return;
        if (!data) {
          setDeck(null);
          setNotFound(true);
          return;
        }
        setDeck(data);
        const key = slug.trim();
        if (openedSlugRef.current !== key) {
          openedSlugRef.current = key;
          trackEvent("shared_deck_opened", {
            slug: key,
            card_count: data.cards.length,
          });
        }
      } catch {
        if (!cancelled) {
          setDeck(null);
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 text-zinc-400">
        Loading deck…
      </div>
    );
  }

  if (notFound || !deck) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-zinc-950 px-4 text-center text-zinc-100">
        <p className="max-w-md text-lg font-semibold text-zinc-200">
          Deck not found
        </p>
        <p className="max-w-sm text-sm text-zinc-500">
          This link may be wrong, or the owner may have turned off sharing.
        </p>
        <Link
          to="/"
          className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Open Sclearn
        </Link>
        <Link
          to="/app"
          className="text-sm text-zinc-500 hover:text-zinc-300"
        >
          Generate your own deck →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-950 text-zinc-100">
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-950 px-4 py-3 sm:px-5">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-zinc-100 sm:text-xl">
              {deck.title}
            </h1>
            <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">
              {deck.cards.length} card{deck.cards.length === 1 ? "" : "s"} ·
              shared deck
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              to="/app"
              className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Open app
            </Link>
            <button
              type="button"
              disabled
              title="Coming soon"
              className="inline-flex min-h-[44px] cursor-not-allowed touch-manipulation items-center justify-center rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-500 opacity-60"
            >
              Duplicate deck
            </button>
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <Scroller cards={deck.cards} headerMode="minimal" />
      </div>
    </div>
  );
}
