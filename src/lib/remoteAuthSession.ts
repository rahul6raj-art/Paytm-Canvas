import { apiClient } from "@/lib/apiClient";
import { isPaytmCraftRemoteMode } from "@/lib/env";

export const REMOTE_AUTH_REFRESH_EVENT = "paytm-craft:remote-auth-refresh";

export function notifyRemoteAuthRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(REMOTE_AUTH_REFRESH_EVENT));
}

export function subscribeRemoteAuthRefresh(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(REMOTE_AUTH_REFRESH_EVENT, listener);
  return () => window.removeEventListener(REMOTE_AUTH_REFRESH_EVENT, listener);
}

export async function signOutRemoteSession(): Promise<void> {
  if (!isPaytmCraftRemoteMode()) return;
  await apiClient.logout();
  notifyRemoteAuthRefresh();
}
