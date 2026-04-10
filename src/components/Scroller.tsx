import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Flashcard as FlashcardData } from "@/lib/flashcard";
import { Flashcard } from "./Flashcard";

type ScrollerProps = {
  cards: FlashcardData[];
};

/**
 * TikTok-style vertical snap: header is fixed; only the card rail scrolls.
 * CSS .scroller: mandatory snap + scroll-snap-stop; no smooth scroll / heavy iOS momentum.
 */
export function Scroller({ cards }: ScrollerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  /** iOS Safari often keeps momentum after CSS snap; snap to nearest slide in px when scrolling stops. */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || cards.length === 0) return;

    const setSlideVar = () => {
      const h = el.clientHeight;
      if (h > 0) el.style.setProperty("--scroller-slide-px", `${h}px`);
    };

    const slideHeight = () => el.clientHeight;

    const snapToNearest = () => {
      const h = slideHeight();
      if (h <= 0) return;
      const maxScroll = Math.max(0, el.scrollHeight - h);
      const idx = Math.min(
        cards.length - 1,
        Math.max(0, Math.round(el.scrollTop / h))
      );
      const target = Math.min(idx * h, maxScroll);
      if (Math.abs(el.scrollTop - target) <= 1) return;
      el.scrollTop = target;
    };

    setSlideVar();
    const ro = new ResizeObserver(setSlideVar);
    ro.observe(el);

    let debounce: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        debounce = undefined;
        snapToNearest();
      }, 100);
    };

    const onScrollEnd = () => {
      if (debounce) {
        clearTimeout(debounce);
        debounce = undefined;
      }
      snapToNearest();
    };

    el.addEventListener("scrollend", onScrollEnd);
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      ro.disconnect();
      el.removeEventListener("scrollend", onScrollEnd);
      el.removeEventListener("scroll", onScroll);
      if (debounce) clearTimeout(debounce);
    };
  }, [cards.length]);

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
      { root, threshold: 0.5 }
    );

    slides.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [cards.length]);

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-950 text-zinc-100">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-2">
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

      <div
        ref={containerRef}
        className="scroller min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y"
      >
        {cards.map((card, index) => (
          <section
            key={`${index}-${card.question.slice(0, 24)}`}
            data-snap-slide
            data-index={index}
            className="flex w-full shrink-0 flex-col items-center justify-center px-4 py-6"
          >
            <Flashcard question={card.question} answer={card.answer} />
          </section>
        ))}
      </div>
    </div>
  );
}
