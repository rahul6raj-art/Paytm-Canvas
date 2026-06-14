/** Set `MASK_DEBUG=1` to log mask compositor diagnostics. */
export const MASK_DEBUG_ENABLED =
  typeof process !== "undefined" && process.env?.MASK_DEBUG === "1";

export function logMaskDiagnostic(
  phase: string,
  detail: Record<string, unknown>,
): void {
  if (!MASK_DEBUG_ENABLED) return;
  // eslint-disable-next-line no-console
  console.debug("[mask]", phase, detail);
}

export function warnMaskFallback(
  groupId: string,
  maskId: string,
  reason: string,
): void {
  logMaskDiagnostic("fallback", { groupId, maskId, reason });
  // eslint-disable-next-line no-console
  console.warn(`[mask] ${reason} (group=${groupId}, mask=${maskId})`);
}
