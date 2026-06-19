import { CANVAS_VISUAL } from "@/lib/canvasVisual";
import { readThemePreference, resolveTheme } from "@/lib/theme";

export const CANVAS_FOREGROUND_LIGHT = "#000000";
export const CANVAS_FOREGROUND_DARK = "#ffffff";

export type CanvasChromeForeground = {
  frameLabel: string;
  frameLabelMuted: string;
  defaultText: string;
  renameInputBg: string;
  renameInputText: string;
  renameInputBorder: string;
  rulerBg: string;
  rulerBorder: string;
  rulerLabel: string;
  rulerTick: string;
};

function parseHexRgb(input: string | undefined): [number, number, number] | null {
  if (!input || typeof input !== "string") return null;
  let h = input.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** True when the pasteboard background reads as dark (use light chrome text). */
export function isDarkCanvasBackground(backgroundColor: string): boolean {
  const rgb = parseHexRgb(backgroundColor);
  if (!rgb) return false;
  return relativeLuminance(rgb) < 0.45;
}

const LIGHT_CHROME: CanvasChromeForeground = {
  frameLabel: CANVAS_VISUAL.frameLabel,
  frameLabelMuted: CANVAS_VISUAL.frameLabelMuted,
  defaultText: CANVAS_FOREGROUND_LIGHT,
  renameInputBg: "#ffffff",
  renameInputText: "#111111",
  renameInputBorder: "rgba(13,153,255,0.55)",
  rulerBg: "#ececec",
  rulerBorder: "rgba(0, 0, 0, 0.12)",
  rulerLabel: "#5c5c5c",
  rulerTick: "rgba(0, 0, 0, 0.25)",
};

const DARK_CHROME: CanvasChromeForeground = {
  frameLabel: "#e8e8e8",
  frameLabelMuted: "#a3a3a3",
  defaultText: CANVAS_FOREGROUND_DARK,
  renameInputBg: "#2c2c2c",
  renameInputText: "#f8fafc",
  renameInputBorder: "rgba(24,160,251,0.65)",
  rulerBg: "#2c2c2c",
  rulerBorder: "rgba(255, 255, 255, 0.12)",
  rulerLabel: "#a3a3a3",
  rulerTick: "rgba(255, 255, 255, 0.25)",
};

export function canvasChromeForeground(backgroundColor: string): CanvasChromeForeground {
  return isDarkCanvasBackground(backgroundColor) ? DARK_CHROME : LIGHT_CHROME;
}

/** Resolved app theme from `<html class="dark">` (falls back to stored preference on SSR). */
export function readResolvedAppTheme(): "light" | "dark" {
  if (typeof document !== "undefined") {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  }
  return resolveTheme(readThemePreference());
}

/** Default stroke/text on canvas: black in light UI, white in dark UI. */
export function defaultCanvasForegroundColor(theme: "light" | "dark" = readResolvedAppTheme()): string {
  return theme === "dark" ? CANVAS_FOREGROUND_DARK : CANVAS_FOREGROUND_LIGHT;
}
