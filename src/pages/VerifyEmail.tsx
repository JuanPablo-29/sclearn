import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

function webmailInbox(email: string): { label: string; href: string } | null {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return null;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return { label: "Open Gmail", href: "https://mail.google.com" };
  }
  if (
    domain === "outlook.com" ||
    domain === "hotmail.com" ||
    domain === "live.com" ||
    domain === "msn.com"
  ) {
    return { label: "Open Outlook", href: "https://outlook.live.com" };
  }
  if (domain === "yahoo.com" || domain === "ymail.com" || domain === "rocketmail.com") {
    return { label: "Open Yahoo Mail", href: "https://mail.yahoo.com" };
  }
  return null;
}

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { resendSignupEmail } = useAuth();
  const emailRaw = searchParams.get("email") ?? "";
  const email = useMemo(() => {
    try {
      return decodeURIComponent(emailRaw).trim();
    } catch {
      return emailRaw.trim();
    }
  }, [emailRaw]);

  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  const inbox = useMemo(() => (email ? webmailInbox(email) : null), [email]);

  const handleResend = useCallback(async () => {
    if (!email) return;
    setResendMessage(null);
    setResendError(null);
    setResending(true);
    const { error } = await resendSignupEmail(email);
    setResending(false);
    if (error) {
      setResendError(error.message || "Could not resend the email. Try again in a moment.");
      return;
    }
    setResendMessage("Verification email sent.");
  }, [email, resendSignupEmail]);

  if (!email) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-950 px-4 py-10 text-zinc-100">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center shadow-xl shadow-black/40">
          <h1 className="text-lg font-semibold text-zinc-100">Missing email</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Start from the sign-up form so we know which address to verify.
          </p>
          <Link
            to="/register"
            className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(16,185,129,0.12),transparent)]" />

      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800/90 bg-zinc-900/70 p-8 shadow-2xl shadow-emerald-950/10 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <svg
            className="h-8 w-8 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.25}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="mt-6 text-center text-2xl font-semibold tracking-tight text-zinc-50">
          Check your email
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-zinc-400">
          We sent a verification link to your email address.
        </p>

        <p className="mt-5 break-all rounded-xl border border-zinc-700/80 bg-zinc-950/60 px-4 py-3 text-center text-sm font-medium text-emerald-100/95">
          {email}
        </p>

        <p className="mt-5 text-center text-sm leading-relaxed text-zinc-500">
          Click the link in the email to activate your account. You can close this page and come
          back after verifying.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {inbox ? (
            <a
              href={inbox.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl border border-zinc-600 bg-zinc-800/80 px-4 py-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-800"
            >
              {inbox.label}
            </a>
          ) : null}
          <button
            type="button"
            disabled={resending}
            onClick={() => void handleResend()}
            className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl border border-emerald-700/50 bg-emerald-600/15 px-4 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-600/25 disabled:opacity-50"
          >
            {resending ? "Sending…" : "Resend email"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-xl px-4 py-3 text-sm font-medium text-zinc-400 hover:text-zinc-200"
          >
            Back to sign in
          </button>
        </div>

        {resendMessage ? (
          <p className="mt-4 text-center text-sm text-emerald-400" role="status">
            {resendMessage}
          </p>
        ) : null}
        {resendError ? (
          <p className="mt-4 text-center text-sm text-red-400" role="alert">
            {resendError}
          </p>
        ) : null}

        <p className="mt-8 text-center">
          <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
