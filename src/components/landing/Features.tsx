const items = [
  {
    title: "AI Flashcard Generation",
    body: "Turn raw notes into structured flashcards instantly.",
  },
  {
    title: "Scroll-Based Studying",
    body: "Study with a TikTok-style interface designed to keep you engaged.",
  },
  {
    title: "Mobile Friendly",
    body: "Designed to work perfectly on phones so you can study anywhere.",
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
