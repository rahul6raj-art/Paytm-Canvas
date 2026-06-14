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

/**
 * Hex ready to apply while typing: only a full 6-digit #RRGGBB (no partial padding).
 * e.g. "cf" → null, "cfcfcf" → #cfcfcf. Use normalizeHex on blur for #RGB shorthand.
 */
export function parseHexInputLive(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const body = trimmed.replace(/^#/, "");
  if (body.length === 6 && /^[0-9a-fA-F]{6}$/.test(body)) {
    return `#${body.toLowerCase()}`;
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

export type HsvColor = { h: number; s: number; v: number };

export function rgbToHsv(r: number, g: number, b: number): HsvColor {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta > 1e-9) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }
  if (h < 0) h += 360;
  const s = max < 1e-9 ? 0 : delta / max;
  return { h, s, v: max };
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp01(s);
  const vv = clamp01(v);
  const c = vv * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = vv - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hh < 60) [rp, gp, bp] = [c, x, 0];
  else if (hh < 120) [rp, gp, bp] = [x, c, 0];
  else if (hh < 180) [rp, gp, bp] = [0, c, x];
  else if (hh < 240) [rp, gp, bp] = [0, x, c];
  else if (hh < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

export function hexToHsv(hex: string): HsvColor {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 0, v: 0.53 };
  return rgbToHsv(rgb.r, rgb.g, rgb.b);
}

export function hsvToHex(h: number, s: number, v: number): string {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export type HslColor = { h: number; s: number; l: number };

export function rgbToHsl(r: number, g: number, b: number): HslColor {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  return { h: h * 360, s, l };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hh = (((h % 360) + 360) % 360) / 360;
  const ss = clamp01(s);
  const ll = clamp01(l);
  if (ss < 1e-9) {
    const v = Math.round(ll * 255);
    return { r: v, g: v, b: v };
  }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const hue = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return {
    r: Math.round(hue(hh + 1 / 3) * 255),
    g: Math.round(hue(hh) * 255),
    b: Math.round(hue(hh - 1 / 3) * 255),
  };
}

export function hexToHsl(hex: string): HslColor {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 0, l: 0.53 };
  return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

/** CSS color string for inspector display (rgba when alpha < 1). */
export function colorToCssString(hex: string, opacity = 1): string {
  const normalized = normalizeHex(hex);
  if (!normalized) return "transparent";
  const rgb = hexToRgb(normalized);
  if (!rgb) return normalized;
  const a = clamp01(opacity);
  if (a >= 1 - 1e-6) return normalized;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Number(a.toFixed(3))})`;
}

export function parseCssColor(raw: string): { hex: string; opacity?: number } | null {
  const trimmed = raw.trim();
  const hex = normalizeHex(trimmed) ?? parseHexInputLive(trimmed);
  if (hex) return { hex };

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+%?)\s*)?\)$/i,
  );
  if (rgbMatch) {
    const r = parseFloat(rgbMatch[1]!);
    const g = parseFloat(rgbMatch[2]!);
    const b = parseFloat(rgbMatch[3]!);
    if (![r, g, b].every(Number.isFinite)) return null;
    const h = rgbToHex(r, g, b);
    let opacity: number | undefined;
    if (rgbMatch[4] != null && rgbMatch[4] !== "") {
      const aRaw = rgbMatch[4]!.trim();
      const aNum = parseFloat(aRaw.replace(/%$/, ""));
      if (!Number.isFinite(aNum)) return null;
      opacity = aRaw.endsWith("%") ? aNum / 100 : aNum;
    }
    return { hex: h, opacity };
  }
  return null;
}

/** CSS color string with alpha for solid fills (hex, rgb, rgba). */
export function fillCss(hex: string | undefined, opacity: number | undefined, enabled: boolean | undefined): string {
  if (enabled === false) return "transparent";
  const o = clamp01(opacity ?? 1);
  if (!hex) return o < 1 ? `rgba(0,0,0,${o})` : "#e5e5e5";
  const parsed = parseCssColor(hex);
  if (!parsed) return "transparent";
  const rgb = hexToRgb(parsed.hex);
  if (!rgb) return "transparent";
  const combined = clamp01(o * (parsed.opacity ?? 1));
  if (combined >= 1 - 1e-6) return parsed.hex;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${combined})`;
}
