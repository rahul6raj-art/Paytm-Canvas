import type { ReactStyleRecord } from "@/lib/codeRoundTrip/reactStyle";

function kebabToCamel(prop: string): string {
  return prop.trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function parseCSSValue(key: string, raw: string): string | number | undefined {
  const v = raw.trim();
  if (!v) return undefined;
  if (key === "opacity" || key === "fontWeight" || key === "lineHeight" || key === "zIndex") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : v;
  }
  if (key === "flexGrow" || key === "flexShrink" || key === "flex") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : v;
  }
  const px = v.match(/^([\d.]+)px$/);
  if (px) return parseFloat(px[1]);
  if (/^[\d.]+$/.test(v)) return parseFloat(v);
  return v;
}

/** Parse an HTML `style="..."` attribute into a React-style record for `reactStyleToNodePatch`. */
export function parseInlineCss(styleAttr: string | undefined | null): ReactStyleRecord {
  if (!styleAttr?.trim()) return {};
  const out: ReactStyleRecord = {};
  for (const part of styleAttr.split(";")) {
    const colon = part.indexOf(":");
    if (colon < 0) continue;
    const rawKey = part.slice(0, colon).trim();
    const rawVal = part.slice(colon + 1).trim();
    if (!rawKey || !rawVal) continue;
    const key = kebabToCamel(rawKey);
    const parsed = parseCSSValue(key, rawVal);
    if (parsed !== undefined) out[key] = parsed;
  }
  return out;
}
