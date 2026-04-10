import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

type FlashcardProps = {
  question: string;
  answer: string;
};

/** Tap toggles question / answer; touch-pan-y lets vertical drags scroll the snap scroller */
export function Flashcard({ question, answer }: FlashcardProps) {
  const [flipped, setFlipped] = useState(false);

  function handleFlip() {
    trackEvent("flashcard_flipped");
    setFlipped((f) => !f);
  }

  return (
    <div className="touch-pan-y select-none">
      <button
        type="button"
        onClick={handleFlip}
        className="flex h-[min(70dvh,560px)] min-h-[44px] w-[min(92vw,480px)] cursor-pointer touch-pan-y select-none flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 px-6 py-8 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 sm:px-8"
        aria-label={flipped ? "Show question" : "Show answer"}
      >
        <p className="text-pretty break-words text-lg font-medium leading-relaxed text-zinc-100 sm:text-xl md:text-2xl">
          {flipped ? answer : question}
        </p>
        <span className="text-xs text-zinc-500">
          Tap to {flipped ? "show question" : "show answer"}
        </span>
      </button>
    </div>
  );
}
