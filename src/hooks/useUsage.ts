import { useCallback, useEffect, useState } from "react";
import { getUsageSummary, type UsageSummary } from "@/lib/usage";
import { useAuth } from "@/context/AuthContext";

export function useUsage() {
  const { user, loading: authLoading } = useAuth();
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshUsage = useCallback(async () => {
    if (!user) {
      setUsage(null);
      return;
    }
    setLoading(true);
    try {
      const summary = await getUsageSummary();
      setUsage(summary);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refreshUsage();
  }, [authLoading, refreshUsage]);

  return { usage, loading, refreshUsage };
}
