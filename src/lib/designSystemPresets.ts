import {
  designTokenTimestamp,
  newDesignTokenId,
  type ColorTokenValue,
  type DesignToken,
} from "@/lib/designTokens";

/** Default Paytm Craft color palette for new design systems. */
export const DEFAULT_COLOR_PALETTE: { name: string; hex: string; opacity?: number }[] = [
  { name: "Brand / Paytm Blue", hex: "#00baf2" },
  { name: "Brand / Navy", hex: "#002970" },
  { name: "Brand / Sky", hex: "#e0f4fd" },
  { name: "Neutral / White", hex: "#ffffff" },
  { name: "Neutral / 50", hex: "#f8fafc" },
  { name: "Neutral / 100", hex: "#f1f5f9" },
  { name: "Neutral / 200", hex: "#e2e8f0" },
  { name: "Neutral / 400", hex: "#94a3b8" },
  { name: "Neutral / 600", hex: "#475569" },
  { name: "Neutral / 900", hex: "#0f172a" },
  { name: "Semantic / Success", hex: "#22c55e" },
  { name: "Semantic / Warning", hex: "#f59e0b" },
  { name: "Semantic / Error", hex: "#ef4444" },
  { name: "Semantic / Info", hex: "#0d99ff" },
  { name: "Accent / Violet", hex: "#8b5cf6" },
  { name: "Accent / Coral", hex: "#f97316" },
];

export function createColorDesignToken(
  name: string,
  value: ColorTokenValue,
  existing?: Record<string, DesignToken>,
): DesignToken {
  const base = name.trim() || "Color";
  let nm = base.slice(0, 64);
  if (existing) {
    const names = new Set(Object.values(existing).map((t) => t.name));
    let i = 2;
    while (names.has(nm)) {
      nm = `${base.slice(0, 58)} ${i}`;
      i += 1;
    }
  }
  const now = designTokenTimestamp();
  return {
    id: newDesignTokenId("color"),
    name: nm,
    type: "color",
    value,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildPaletteTokens(
  palette: { name: string; hex: string; opacity?: number }[],
  existing: Record<string, DesignToken> = {},
): Record<string, DesignToken> {
  const next = { ...existing };
  for (const swatch of palette) {
    const token = createColorDesignToken(swatch.name, { hex: swatch.hex, opacity: swatch.opacity ?? 1 }, next);
    next[token.id] = token;
  }
  return next;
}
