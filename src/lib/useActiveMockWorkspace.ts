"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_MOCK_WORKSPACE, getActiveMockWorkspace, subscribeMockAuth } from "@/lib/mockAuth";

/** SSR-safe active workspace; hydrates from localStorage after mount without mismatch. */
export function useActiveMockWorkspace() {
  return useSyncExternalStore(subscribeMockAuth, getActiveMockWorkspace, () => DEFAULT_MOCK_WORKSPACE);
}
