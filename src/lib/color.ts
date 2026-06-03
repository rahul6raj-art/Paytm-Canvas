/** Normalize #RGB / #RRGGBB to #RRGGBB for color input. */
export function normalizeHex(input: string): string | null {
  const s = input.trim().replace(/^#/, "");
  if (s.length === 3 && /^[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`.toLowerCase();
  }
  if (s.length === 6 && /^[0-9a-fA-F]{6}$/.test(s)) {
    return `#${s.toLowerCase()}`;
  }
  return null;
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = normalizeHex(hex);
  if (!h) return null;
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** CSS color string with alpha for solid fills. */
export function fillCss(hex: string | undefined, opacity: number | undefined, enabled: boolean | undefined): string {
  if (enabled === false) return "transparent";
  const o = clamp01(opacity ?? 1);
  if (!hex) return o < 1 ? `rgba(0,0,0,${o})` : "#e5e5e5";
  const rgb = hexToRgb(hex);
  if (!rgb) return "transparent";
  if (o >= 1 - 1e-6) return normalizeHex(hex) ?? hex;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${o})`;
}
