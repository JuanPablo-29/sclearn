import { Link } from "react-router-dom";

export default function Privacy() {
  const year = new Date().getFullYear();

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-16">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">
          Privacy Policy
        </h1>

        <p className="text-sm leading-relaxed text-zinc-400">
          <span className="font-medium text-zinc-300">Privacy Policy</span>
          <br />
          Last updated: {year}
        </p>

        <p className="text-sm leading-relaxed text-zinc-300">
          Sclearn collects limited information necessary to operate the service.
        </p>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">
            Information We Collect
          </h2>
          <p className="text-sm leading-relaxed text-zinc-300">
            When you use Sclearn we may collect:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>Account information such as email address</li>
            <li>Notes or text you submit to generate flashcards</li>
            <li>
              Usage information such as flashcard generation activity
            </li>
            <li>
              Device and analytics information used to improve the service
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">
            How We Use Information
          </h2>
          <p className="text-sm leading-relaxed text-zinc-300">
            We use collected information to:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>Provide the flashcard generation service</li>
            <li>Improve product functionality and performance</li>
            <li>Monitor usage limits and prevent abuse</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">
            Third-Party Services
          </h2>
          <p className="text-sm leading-relaxed text-zinc-300">
            Sclearn relies on third-party services to operate including:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>Supabase for authentication and database storage</li>
            <li>OpenAI for generating flashcards</li>
            <li>Analytics tools used to understand product usage</li>
          </ul>
          <p className="text-sm leading-relaxed text-zinc-300">
            These services may process limited data required to perform their
            functions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">Data Security</h2>
          <p className="text-sm leading-relaxed text-zinc-300">
            We take reasonable measures to protect user data but cannot guarantee
            absolute security.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">Data Requests</h2>
          <p className="text-sm leading-relaxed text-zinc-300">
            If you would like to request deletion of your data or have questions
            about privacy, contact the site operator.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">Changes</h2>
          <p className="text-sm leading-relaxed text-zinc-300">
            This privacy policy may be updated as the product evolves.
          </p>
        </section>

        <div className="pt-8">
          <Link
            to="/"
            className="inline-flex min-h-[44px] touch-manipulation items-center text-emerald-400 hover:text-emerald-300"
          >
            ← Back
          </Link>
        </div>
      </div>
    </div>
  );
}
