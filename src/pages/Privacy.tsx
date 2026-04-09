import { Link } from "react-router-dom";

export default function Privacy() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-zinc-950 px-6 py-12 text-zinc-100">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-2xl font-semibold">Privacy</h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          This policy will be published here. For now, contact the site operator
          if you have questions about your data.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex min-h-[44px] touch-manipulation items-center text-sm text-emerald-400 hover:text-emerald-300"
        >
          ← Back
        </Link>
      </div>
    </div>
  );
}
