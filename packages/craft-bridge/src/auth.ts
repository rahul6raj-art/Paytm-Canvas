import { bridgeAuthToken, isBridgeAuthRequired } from "./config";

export type BridgeAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

function readRequestToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const header = req.headers.get("x-craft-bridge-token");
  return header?.trim() || null;
}

export function validateBridgeAuth(req: Request): BridgeAuthResult {
  if (!isBridgeAuthRequired()) return { ok: true };

  const expected = bridgeAuthToken();
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: "CRAFT_BRIDGE_TOKEN is not configured on the server.",
    };
  }

  const provided = readRequestToken(req);
  if (!provided || provided !== expected) {
    return { ok: false, status: 401, error: "Invalid or missing bridge token." };
  }

  return { ok: true };
}

export function bridgeAuthHeaders(token?: string): Record<string, string> {
  if (!token?.trim()) return {};
  return { Authorization: `Bearer ${token.trim()}` };
}
