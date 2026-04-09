import { Link } from "react-router-dom";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-800/80 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
        <p className="text-sm text-zinc-500">Sclearn © {year}</p>
        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm">
          <Link
            to="/privacy"
            className="inline-flex min-h-[44px] touch-manipulation items-center text-zinc-500 transition hover:text-zinc-300"
          >
            Privacy
          </Link>
          <Link
            to="/terms"
            className="inline-flex min-h-[44px] touch-manipulation items-center text-zinc-500 transition hover:text-zinc-300"
          >
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
