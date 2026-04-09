import posthog from "posthog-js";

let initialized = false;

export function initAnalytics() {
  if (typeof window === "undefined") return;

  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: "https://app.posthog.com",
    capture_pageview: true,
  });
  initialized = true;
}

export function identifyUser(user: { id: string; email?: string }) {
  if (!user?.id || !initialized) return;
  posthog.identify(user.id, {
    email: user.email,
  });
}

export function trackEvent(
  name: string,
  properties?: Record<string, unknown>
) {
  if (!initialized) return;
  posthog.capture(name, properties);
}

export function resetAnalytics() {
  if (!initialized) return;
  posthog.reset();
}

export default posthog;
