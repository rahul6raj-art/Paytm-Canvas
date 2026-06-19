import { bridgeAuthHeaders } from "@paytm-craft/bridge/client";

/** Optional browser token for authenticated remote Craft (set NEXT_PUBLIC_CRAFT_BRIDGE_TOKEN). */
export function getBridgeClientToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return process.env.NEXT_PUBLIC_CRAFT_BRIDGE_TOKEN?.trim() || undefined;
}

export async function bridgeFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getBridgeClientToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(path, { ...init, headers });
}

export function bridgeAuthHeaderRecord(): Record<string, string> {
  return bridgeAuthHeaders(getBridgeClientToken());
}
