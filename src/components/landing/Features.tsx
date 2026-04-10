const items = [
  {
    title: "AI Flashcard Generation",
    body: "Paste your notes and instantly generate flashcards powered by AI.",
  },
  {
    title: "Addictive Scroll Learning",
    body: "Study using a swipe-based interface inspired by social media feeds.",
  },
  {
    title: "Learn Faster",
    body: "Scrolling through bite-sized questions helps you stay focused and retain more information.",
  },
];

export function Features() {
  return (
    <section className="border-b border-zinc-800/80 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
          Why Students Use Sclearn
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
            >
              <h3 className="text-lg font-semibold text-zinc-100">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
