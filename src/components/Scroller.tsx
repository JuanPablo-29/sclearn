import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Flashcard as FlashcardData } from "@/lib/flashcard";
import { Flashcard } from "./Flashcard";

type ScrollerProps = {
  cards: FlashcardData[];
};

/** Single vertical scroll + snap for /learn */
export function Scroller({ cards }: ScrollerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || cards.length === 0) return;

    const slides = root.querySelectorAll("[data-snap-slide]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const idx = Number(el.dataset.index);
          if (!Number.isNaN(idx)) setActiveIndex(idx);
        }
      },
      { root, threshold: 0.55 }
    );

    slides.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [cards.length]);

  return (
    <div
      ref={containerRef}
      className="h-[100dvh] snap-y snap-mandatory overflow-y-auto scroll-smooth overscroll-y-contain scroll-pt-0 touch-pan-y"
    >
      <header className="sticky top-0 flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-2">
        <Link
          to="/app"
          className="inline-flex min-h-[44px] min-w-[44px] touch-manipulation items-center rounded-lg px-2 text-sm text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
        >
          ← Home
        </Link>
        <span
          className="shrink-0 text-sm tabular-nums text-zinc-500"
          aria-live="polite"
        >
          {cards.length > 0 ? `${activeIndex + 1} / ${cards.length}` : ""}
        </span>
      </header>

      {cards.map((card, index) => (
        <section
          key={`${index}-${card.question.slice(0, 24)}`}
          data-snap-slide
          data-index={index}
          className="flex h-[100dvh] shrink-0 snap-start items-center justify-center px-4 py-6"
        >
          <Flashcard question={card.question} answer={card.answer} />
        </section>
      ))}
    </div>
  );
}
