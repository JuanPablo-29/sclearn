/** Maps Supabase auth errors to friendlier copy and flags for verification UX. */
export function mapSignInError(err: Error | null): {
  displayMessage: string;
  needsEmailVerification: boolean;
} {
  if (!err) {
    return { displayMessage: "", needsEmailVerification: false };
  }
  const m = err.message.toLowerCase();
  const needsEmailVerification =
    m.includes("email not confirmed") ||
    m.includes("email_not_confirmed") ||
    m.includes("not confirmed");

  if (needsEmailVerification) {
    return {
      displayMessage: "Please verify your email before signing in.",
      needsEmailVerification: true,
    };
  }
  return { displayMessage: err.message, needsEmailVerification: false };
}
