const steps = [
  {
    n: 1,
    title: "Paste your notes",
    description:
      "Add your lecture notes, readings, or any text — Sclearn uses it as the source for your deck.",
  },
  {
    n: 2,
    title: "Generate flashcards with AI",
    description:
      "AI turns your content into clear questions and answers you can study right away.",
  },
  {
    n: 3,
    title: "Scroll and learn",
    description:
      "Swipe through flashcards and tap to reveal answers, making studying feel natural and engaging.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-b border-zinc-800/80 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
          How It Works
        </h2>
        <div className="mt-12 flex flex-col gap-8 md:flex-row md:items-start md:justify-center md:gap-6 lg:gap-10">
          {steps.map((step) => (
            <div
              key={step.n}
              className="flex flex-1 flex-col items-center text-center md:max-w-xs"
            >
              <span className="flex h-12 w-12 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-emerald-500/20 text-lg font-bold text-emerald-400">
                {step.n}
              </span>
              <p className="mt-4 text-base font-medium text-zinc-100 sm:text-lg">
                {step.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
