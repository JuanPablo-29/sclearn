export function captureReferralFromUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const code = params.get("r");
  if (!code) return;
  localStorage.setItem("referral_code", code.toLowerCase());
}

export function consumeReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  const code = localStorage.getItem("referral_code");
  if (code) {
    localStorage.removeItem("referral_code");
  }
  return code;
}
