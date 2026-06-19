import { isCraftBridgeEnabled } from "./config";
import { validateBridgeAuth, type BridgeAuthResult } from "./auth";

export type BridgeGuardResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export function assertBridgeAccess(req: Request): BridgeGuardResult {
  if (!isCraftBridgeEnabled()) {
    return {
      ok: false,
      status: 403,
      error: "Craft bridge is disabled. Set CRAFT_BRIDGE_ENABLED=1.",
    };
  }

  const auth: BridgeAuthResult = validateBridgeAuth(req);
  if (!auth.ok) return auth;
  return { ok: true };
}
