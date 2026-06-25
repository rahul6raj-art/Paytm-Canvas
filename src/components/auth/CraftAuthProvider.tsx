"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiClient, ApiRequestError, type CraftUser } from "@/lib/apiClient";
import { craftUserToMockUser } from "@/lib/dashboardApiAdapters";
import { isCraftAuthEnabled, subscribeCraftAuthRefresh } from "@/lib/craftAuthSession";
import { isPaytmCraftHttpApiMode } from "@/lib/env";
import {
  getMockCurrentUser,
  subscribeMockAuth,
  type MockUser,
} from "@/lib/mockAuth";

type CraftAuthContextValue = {
  user: MockUser | null;
  apiUser: CraftUser | null;
  loading: boolean;
  authEnabled: boolean;
  refresh: () => Promise<void>;
};

const CraftAuthContext = createContext<CraftAuthContextValue | null>(null);

export function CraftAuthProvider({ children }: { children: ReactNode }) {
  const authEnabled = isPaytmCraftHttpApiMode();
  const [apiUser, setApiUser] = useState<CraftUser | null>(null);
  const [loading, setLoading] = useState(authEnabled);
  const [mockTick, setMockTick] = useState(0);

  const refresh = useCallback(async () => {
    if (!authEnabled) {
      setApiUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const user = await apiClient.getCurrentUser();
      setApiUser(user);
    } catch (e) {
      if (!(e instanceof ApiRequestError && e.status === 401)) {
        console.error("[CraftAuth] failed to load user", e);
      }
      setApiUser(null);
    } finally {
      setLoading(false);
    }
  }, [authEnabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => subscribeCraftAuthRefresh(() => void refresh()), [refresh]);
  useEffect(() => subscribeMockAuth(() => setMockTick((n) => n + 1)), []);

  const user = useMemo((): MockUser | null => {
    if (authEnabled) {
      return apiUser ? craftUserToMockUser(apiUser) : null;
    }
    void mockTick;
    return getMockCurrentUser();
  }, [authEnabled, apiUser, mockTick]);

  const value = useMemo(
    () => ({
      user,
      apiUser,
      loading,
      authEnabled,
      refresh,
    }),
    [user, apiUser, loading, authEnabled, refresh],
  );

  return <CraftAuthContext.Provider value={value}>{children}</CraftAuthContext.Provider>;
}

export function useCraftAuth(): CraftAuthContextValue {
  const ctx = useContext(CraftAuthContext);
  if (!ctx) {
    throw new Error("useCraftAuth must be used within CraftAuthProvider");
  }
  return ctx;
}

export function useOptionalCraftAuth(): CraftAuthContextValue | null {
  return useContext(CraftAuthContext);
}

export { isCraftAuthEnabled };
