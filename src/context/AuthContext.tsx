/* eslint-disable react-refresh/only-export-components */
import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import { identifyUser, resetAnalytics, trackEvent } from "@/lib/analytics";
import {
  fetchUserBillingProfile,
  type UserBillingProfile,
} from "@/lib/billing";
import { consumeReferralCode } from "@/lib/referral";
import { getSiteUrl, supabase } from "@/lib/supabase";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  billing: UserBillingProfile | null;
  billingLoading: boolean;
  refreshBilling: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<UserBillingProfile | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const prevUserIdRef = useRef<string | undefined>(undefined);
  const prevPlanRef = useRef<"free" | "pro" | null>(null);
  const billingUserRef = useRef<string | null>(null);

  const authUserId = useMemo(() => session?.user?.id ?? null, [session?.user?.id]);

  const refreshBilling = useCallback(async () => {
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    if (!s?.user) {
      setBilling(null);
      prevPlanRef.current = null;
      billingUserRef.current = null;
      return;
    }
    const uid = s.user.id;
    if (billingUserRef.current !== uid) {
      billingUserRef.current = uid;
      prevPlanRef.current = null;
    }
    setBillingLoading(true);
    try {
      const profile = await fetchUserBillingProfile();
      setBilling(profile);
      const next = profile?.plan ?? "free";
      if (prevPlanRef.current === "pro" && next === "free") {
        trackEvent("subscription_canceled");
      }
      prevPlanRef.current = next;
    } finally {
      setBillingLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;
    const u = session?.user;
    if (u?.id) {
      identifyUser({ id: u.id, email: u.email ?? undefined });
      prevUserIdRef.current = u.id;
    } else if (prevUserIdRef.current) {
      resetAnalytics();
      prevUserIdRef.current = undefined;
      prevPlanRef.current = null;
      setBilling(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- identify only when user id/email change
  }, [loading, session?.user?.id, session?.user?.email]);

  useEffect(() => {
    if (loading) return;
    if (!authUserId) {
      setBilling(null);
      prevPlanRef.current = null;
      return;
    }
    void refreshBilling();
  }, [loading, authUserId, refreshBilling]);

  useEffect(() => {
    if (loading || !authUserId) return;
    const referralCode = consumeReferralCode();
    if (!referralCode) return;

    void (async () => {
      try {
        await supabase.rpc("link_referrer_by_code", { p_code: referralCode });
      } catch {
        // No-op: referral linking is best-effort and should not block auth UX.
      }
    })();
  }, [loading, authUserId]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  }

  async function signUp(email: string, password: string) {
    const redirectTo = `${getSiteUrl()}/learn`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    });
    return { error: error ? new Error(error.message) : null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setBilling(null);
    prevPlanRef.current = null;
  }

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    billing,
    billingLoading,
    refreshBilling,
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
