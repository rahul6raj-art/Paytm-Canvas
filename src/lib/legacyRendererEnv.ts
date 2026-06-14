/** Legacy `NEXT_PUBLIC_PAYTM_CRAFT_RENDERER` values removed in Track 27 — coerced to native. */
export const LEGACY_RENDERER_ENVS = ["dom", "svg", "webgl"] as const;

export type LegacyRendererEnv = (typeof LEGACY_RENDERER_ENVS)[number];

export function isLegacyRendererEnv(raw: string): raw is LegacyRendererEnv {
  const lower = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return (LEGACY_RENDERER_ENVS as readonly string[]).includes(lower);
}
