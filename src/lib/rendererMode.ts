export type RendererMode = "dom" | "svg";

function readOptionalString(name: string): string {
  const v = process.env[name];
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

/** Canvas scene renderer: `dom` (default) or experimental `svg`. */
export function getRendererMode(): RendererMode {
  const raw = readOptionalString("NEXT_PUBLIC_PAYTM_CRAFT_RENDERER");
  if (raw === "svg") return "svg";
  return "dom";
}

export function isSvgRendererEnabled(): boolean {
  return getRendererMode() === "svg";
}

/** When true, SVG mode keeps invisible DOM objects for hit-testing (legacy). */
export function isSvgDomHitFallbackEnabled(): boolean {
  return readOptionalString("NEXT_PUBLIC_PAYTM_CRAFT_SVG_DOM_HIT_FALLBACK") === "true";
}
