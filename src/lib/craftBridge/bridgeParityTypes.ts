/** Per-character box from Chromium getBoundingClientRect (element-local px). */
export type BrowserCaptureGlyphBox = {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** One visual line from browser layout (element-local px). */
export type BrowserCaptureTextLine = {
  text: string;
  startIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  baselineY?: number;
};

/**
 * Text layout captured in Playwright from live DOM geometry.
 * Used for editable bridge push — Craft paints at these positions instead of remeasuring.
 */
export type BrowserCaptureTextLayout = {
  content: string;
  lines: BrowserCaptureTextLine[];
  glyphs?: BrowserCaptureGlyphBox[];
};

export type BridgeParityMismatch = {
  category: "text" | "svg" | "effect" | "geometry" | "color" | "image";
  nodeId?: string;
  nodeName?: string;
  codeClassName?: string;
  message: string;
  /** 0–100 severity for sorting fixes */
  impact: number;
};

export type BridgeParityPixelReport = {
  width: number;
  height: number;
  /** Percent of pixels that differ (0 = perfect) */
  diffPercent: number;
  /** Pixels compared */
  totalPixels: number;
  /** Pixels that differ beyond threshold */
  diffPixels: number;
  /** Mean absolute RGB channel delta on differing pixels */
  meanDelta: number;
};

export type BridgeParityReport = {
  screenLabel: string;
  previewUrl: string;
  /** Overall score 0–100 (100 = perfect pixel match) */
  score: number;
  pixel?: BridgeParityPixelReport;
  mismatches: BridgeParityMismatch[];
};
