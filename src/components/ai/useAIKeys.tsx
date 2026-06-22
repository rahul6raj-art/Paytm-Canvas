"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { AIKeyProviderId } from "@/lib/aiKeys/types";
import {
  keysForProvider,
  providerHasLocalKey,
  readAIKeysStore,
} from "@/lib/aiKeys/storage";

type AIKeysModalView = "manage" | "add" | null;

type OpenAddKeyOptions = {
  /** Re-open the manage modal after a successful save (when add was launched from there). */
  returnToManage?: boolean;
};

type AIKeysContextValue = {
  version: number;
  refresh: () => void;
  modal: AIKeysModalView;
  addProvider: AIKeyProviderId | null;
  addKeyReturnToManage: boolean;
  openManageKeys: () => void;
  openAddKey: (provider: AIKeyProviderId, options?: OpenAddKeyOptions) => void;
  closeModals: () => void;
  finishAddKey: () => void;
  isProviderConfigured: (
    provider: AIKeyProviderId,
    serverConfigured?: boolean,
  ) => boolean;
  keysForProvider: (provider: AIKeyProviderId) => ReturnType<typeof keysForProvider>;
};

const AIKeysContext = createContext<AIKeysContextValue | null>(null);

export function AIKeysProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const [modal, setModal] = useState<AIKeysModalView>(null);
  const [addProvider, setAddProvider] = useState<AIKeyProviderId | null>(null);
  const [addKeyReturnToManage, setAddKeyReturnToManage] = useState(false);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const openManageKeys = useCallback(() => {
    setAddKeyReturnToManage(false);
    setModal("manage");
    setAddProvider(null);
  }, []);

  const openAddKey = useCallback((provider: AIKeyProviderId, options?: OpenAddKeyOptions) => {
    setAddProvider(provider);
    setAddKeyReturnToManage(options?.returnToManage ?? false);
    setModal("add");
  }, []);

  const closeModals = useCallback(() => {
    setModal(null);
    setAddProvider(null);
    setAddKeyReturnToManage(false);
  }, []);

  const finishAddKey = useCallback(() => {
    refresh();
    if (addKeyReturnToManage) {
      setAddProvider(null);
      setAddKeyReturnToManage(false);
      setModal("manage");
      return;
    }
    closeModals();
  }, [addKeyReturnToManage, closeModals, refresh]);

  const keysForProviderBound = useCallback(
    (provider: AIKeyProviderId) => {
      void version;
      return keysForProvider(provider);
    },
    [version],
  );

  const isProviderConfigured = useCallback(
    (provider: AIKeyProviderId, serverConfigured = false) => {
      void version;
      void readAIKeysStore();
      return providerHasLocalKey(provider) || serverConfigured;
    },
    [version],
  );

  const value = useMemo(
    (): AIKeysContextValue => ({
      version,
      refresh,
      modal,
      addProvider,
      addKeyReturnToManage,
      openManageKeys,
      openAddKey,
      closeModals,
      finishAddKey,
      isProviderConfigured,
      keysForProvider: keysForProviderBound,
    }),
    [
      version,
      refresh,
      modal,
      addProvider,
      addKeyReturnToManage,
      openManageKeys,
      openAddKey,
      closeModals,
      finishAddKey,
      isProviderConfigured,
      keysForProviderBound,
    ],
  );

  return <AIKeysContext.Provider value={value}>{children}</AIKeysContext.Provider>;
}

export function useAIKeys() {
  const ctx = useContext(AIKeysContext);
  if (!ctx) throw new Error("useAIKeys must be used within AIKeysProvider");
  return ctx;
}
