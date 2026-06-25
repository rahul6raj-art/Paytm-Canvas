import { apiClient } from "@/lib/apiClient";
import { isPaytmCraftHttpApiMode } from "@/lib/env";

export const CRAFT_AUTH_REFRESH_EVENT = "paytm-craft:craft-auth-refresh";

/** @deprecated Use CRAFT_AUTH_REFRESH_EVENT */
export const REMOTE_AUTH_REFRESH_EVENT = CRAFT_AUTH_REFRESH_EVENT;

export function notifyCraftAuthRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CRAFT_AUTH_REFRESH_EVENT));
}

/** @deprecated Use notifyCraftAuthRefresh */
export const notifyRemoteAuthRefresh = notifyCraftAuthRefresh;

export function subscribeCraftAuthRefresh(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CRAFT_AUTH_REFRESH_EVENT, listener);
  return () => window.removeEventListener(CRAFT_AUTH_REFRESH_EVENT, listener);
}

/** @deprecated Use subscribeCraftAuthRefresh */
export const subscribeRemoteAuthRefresh = subscribeCraftAuthRefresh;

export async function signOutCraftSession(): Promise<void> {
  if (!isPaytmCraftHttpApiMode()) return;
  await apiClient.logout();
  notifyCraftAuthRefresh();
}

/** @deprecated Use signOutCraftSession */
export const signOutRemoteSession = signOutCraftSession;

export function isCraftAuthEnabled(): boolean {
  return isPaytmCraftHttpApiMode();
}

export function craftLoginUrl(nextPath?: string | null): string {
  const next = nextPath?.trim();
  if (!next || next === "/" || !next.startsWith("/") || next.startsWith("//")) {
    return "/login";
  }
  if (next === "/login" || next === "/signup") return "/login";
  return `/login?next=${encodeURIComponent(next)}`;
}
