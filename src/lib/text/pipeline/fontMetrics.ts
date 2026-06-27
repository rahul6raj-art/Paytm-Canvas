import type { ResolvedTextTypo } from "@/lib/textTypography";
import { buildFontString, getTextMeasureContext } from "../textMeasure";
import {
  lineHeightUnitFromNode,
  resolveLineHeightPx,
} from "../lineHeight";
import type { TextFontMetrics } from "./types";

export { lineHeightUnitFromNode, resolveLineHeightPx } from "../lineHeight";

const metricsCache = new Map<string, TextFontMetrics>();
const METRICS_CACHE_MAX = 256;

function metricsCacheKey(typo: ResolvedTextTypo, lineHeightPx: number): string {
  return [
    typo.fontFamily,
    typo.fontSize,
    typo.fontWeight,
    lineHeightPx,
  ].join("|");
}

function pruneMetricsCache(): void {
  if (metricsCache.size <= METRICS_CACHE_MAX) return;
  const drop = metricsCache.size - METRICS_CACHE_MAX;
  for (const key of [...metricsCache.keys()].slice(0, drop)) {
    metricsCache.delete(key);
  }
}

/** Measure font ascender/descender/cap height from the browser when WASM metrics are unavailable. */
export function measureFontMetricsFromCanvas(
  typo: ResolvedTextTypo,
  lineHeightPx: number,
): TextFontMetrics {
  const key = metricsCacheKey(typo, lineHeightPx);
  const hit = metricsCache.get(key);
  if (hit) return hit;

  let ascender = typo.fontSize * 0.88;
  let descender = typo.fontSize * 0.22;
  let capHeight = typo.fontSize * 0.72;
  let xHeight = typo.fontSize * 0.52;
  let lineGap = Math.max(0, lineHeightPx - ascender - descender);

  if (typeof document !== "undefined") {
    const ctx = getTextMeasureContext();
    ctx.font = buildFontString(typo);
    const m = ctx.measureText("Hgpx");
    if (m.fontBoundingBoxAscent != null && m.fontBoundingBoxDescent != null) {
      ascender = m.fontBoundingBoxAscent;
      descender = m.fontBoundingBoxDescent;
      capHeight = m.fontBoundingBoxAscent * 0.82;
      xHeight = m.actualBoundingBoxAscent * 0.58;
      lineGap = Math.max(0, lineHeightPx - ascender - descender);
    } else if (m.actualBoundingBoxAscent != null && m.actualBoundingBoxDescent != null) {
      ascender = m.actualBoundingBoxAscent;
      descender = m.actualBoundingBoxDescent;
      capHeight = ascender * 0.82;
      xHeight = ascender * 0.58;
      lineGap = Math.max(0, lineHeightPx - ascender - descender);
    }
  }

  const baselineOffset = ascender;
  const out: TextFontMetrics = {
    ascender,
    descender,
    capHeight,
    xHeight,
    lineGap,
    baselineOffset,
    lineHeightPx,
  };
  metricsCache.set(key, out);
  pruneMetricsCache();
  return out;
}

/** Merge WASM canonical metrics when present; otherwise measure from canvas. */
export function resolveTextFontMetrics(
  typo: ResolvedTextTypo,
  lineHeightPx: number,
  wasmMetrics?: Partial<TextFontMetrics> | null,
): TextFontMetrics {
  if (
    wasmMetrics &&
    wasmMetrics.ascender != null &&
    wasmMetrics.baselineOffset != null
  ) {
    return {
      ascender: wasmMetrics.ascender,
      descender: wasmMetrics.descender ?? typo.fontSize * 0.22,
      capHeight: wasmMetrics.capHeight ?? typo.fontSize * 0.72,
      xHeight: wasmMetrics.xHeight ?? typo.fontSize * 0.52,
      lineGap: wasmMetrics.lineGap ?? Math.max(0, lineHeightPx - (wasmMetrics.ascender ?? 0) - (wasmMetrics.descender ?? 0)),
      baselineOffset: wasmMetrics.baselineOffset,
      lineHeightPx: wasmMetrics.lineHeightPx ?? lineHeightPx,
    };
  }
  return measureFontMetricsFromCanvas(typo, lineHeightPx);
}

/** Optical center offset for vertically centering glyph bounds (not em-box center). */
export function opticalVerticalCenterOffset(metrics: TextFontMetrics): number {
  const glyphCenter = (metrics.ascender - metrics.descender) / 2;
  const boxCenter = metrics.lineHeightPx / 2;
  return boxCenter - glyphCenter;
}

export function clearFontMetricsCache(): void {
  metricsCache.clear();
}
