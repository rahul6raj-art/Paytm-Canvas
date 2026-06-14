/** Parse a CSS color (hex / rgb / rgba) into RGB 0-255, or null if not parseable. */
export function parseRgb(css: string | undefined): { r: number; g: number; b: number } | null {
  if (!css) return null;
  const s = css.trim().toLowerCase();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1]!;
    if (h.length === 3) {
      return {
        r: parseInt(h[0]! + h[0]!, 16),
        g: parseInt(h[1]! + h[1]!, 16),
        b: parseInt(h[2]! + h[2]!, 16),
      };
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  const rgb = s.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }
  return null;
}

/** Relative luminance per WCAG (0 = black, 1 = white). */
export function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

/** WCAG contrast ratio between two CSS colors (1 = identical, 21 = black/white). */
export function contrastRatio(a: string | undefined, b: string | undefined): number {
  const ca = parseRgb(a);
  const cb = parseRgb(b);
  if (!ca || !cb) return 21;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Ensure a label color is legible against a background. When extraction yields
 * an inherited/wrong color that nearly matches the background, fall back to a
 * contrasting black or white.
 */
export function ensureReadableTextColor(
  textColor: string | undefined,
  backgroundColor: string | undefined,
): string | undefined {
  if (!backgroundColor) return textColor;
  if (contrastRatio(textColor, backgroundColor) >= 2) return textColor;
  const bg = parseRgb(backgroundColor);
  if (!bg) return textColor;
  return relativeLuminance(bg) > 0.5 ? "#0a0a0a" : "#ffffff";
}
