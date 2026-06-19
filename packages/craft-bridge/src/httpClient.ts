import { bridgeAuthHeaders } from "./auth";

export type BridgeHttpClientOptions = {
  baseUrl: string;
  token?: string;
};

export function createBridgeHttpClient(opts: BridgeHttpClientOptions) {
  const base = opts.baseUrl.replace(/\/$/, "");
  const headers = {
    "Content-Type": "application/json",
    ...bridgeAuthHeaders(opts.token ?? process.env.CRAFT_BRIDGE_TOKEN),
  };

  async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
    });
    const body = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return body;
  }

  return { fetchJson, baseUrl: base };
}
