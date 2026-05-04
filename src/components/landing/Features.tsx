const items = [
  {
    title: "Paste or Type Notes",
    body: "Drop in your notes or enter any topic and generate flashcards instantly.",
  },
  {
    title: "Upload PDFs & Images",
    body: "Upload lecture slides, worksheets, or photos of notes. AI extracts key concepts automatically.",
  },
  {
    title: "Smart Flashcard Generation",
    body: "Clear, concise flashcards designed for retention, not fluff.",
  },
  {
    title: "Track Your Usage",
    body: "See how many generations, uploads, and decks you have left in real time.",
  },
  {
    title: "Scroll-Based Learning",
    body: "Study faster with a clean, swipe-style flashcard experience.",
  },
  {
    title: "Save & Organize Decks",
    body: "Keep your flashcards organized and revisit them anytime.",
  },
];

export function Features() {
  return (
    <section className="border-b border-zinc-800/80 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
          Everything you need to study faster
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
