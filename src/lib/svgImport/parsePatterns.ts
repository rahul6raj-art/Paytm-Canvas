import { normalizeColor, parseOpacity } from "@/lib/svgImport/parseStyles";
import type { SvgElement } from "@/lib/svgImport/parseSvg";
import { parseLength } from "@/lib/svgImport/svgMatrix";

export type ParsedPattern = {
  id: string;
  width: number;
  height: number;
  viewBox?: { minX: number; minY: number; width: number; height: number };
  patternTransform?: string;
  patternUnits: "userSpaceOnUse" | "objectBoundingBox";
  /** Fallback solid when rasterization is unavailable (tests / SSR). */
  fallbackColor: string;
  /** Serialized inner SVG for browser rasterization. */
  innerMarkup: string;
};

function patternChildMarkup(el: SvgElement): string {
  const parts: string[] = [];
  for (const child of el.childElements()) {
    const tag = child.tagLower;
    if (tag === "defs" || tag === "style") continue;
    parts.push(`<${tag}/>`);
  }
  return parts.join("");
}

function fallbackColorFromPattern(el: SvgElement): string {
  for (const child of el.childElements()) {
    const fill =
      normalizeColor(child.getAttr("fill")) ??
      normalizeColor(child.getAttr("style")?.match(/fill:\s*([^;]+)/)?.[1]);
    if (fill) return fill;
    const stroke = normalizeColor(child.getAttr("stroke"));
    if (stroke) return stroke;
  }
  return "#cccccc";
}

export function parsePatternElement(el: SvgElement, id: string): ParsedPattern | null {
  const w = parseLength(el.getAttr("width"), 8);
  const h = parseLength(el.getAttr("height"), 8);
  if (w <= 0 || h <= 0) return null;

  const vb = el.getAttr("viewBox");
  let viewBox: ParsedPattern["viewBox"];
  if (vb) {
    const nums = vb.split(/[\s,]+/).map(parseFloat);
    if (nums.length >= 4 && nums.every(Number.isFinite)) {
      viewBox = { minX: nums[0]!, minY: nums[1]!, width: nums[2]!, height: nums[3]! };
    }
  }

  const units = el.getAttr("patternUnits") === "objectBoundingBox"
    ? "objectBoundingBox"
    : "userSpaceOnUse";

  return {
    id,
    width: w,
    height: h,
    viewBox,
    patternTransform: el.getAttr("patternTransform") ?? el.getAttr("transform"),
    patternUnits: units,
    fallbackColor: fallbackColorFromPattern(el),
    innerMarkup: patternChildMarkup(el),
  };
}

/** 1×1 PNG data URL for a solid color (pattern fallback in tests). */
export function solidColorPatternDataUrl(color: string, opacity = 1): string {
  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(1, 1)
    : typeof document !== "undefined"
      ? document.createElement("canvas")
      : null;
  if (!canvas) {
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${color}" fill-opacity="${opacity}"/></svg>`)}`;
  }
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${color}"/></svg>`)}`;
  }
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 8, 8);
  if ("convertToBlob" in canvas) {
    // sync path unavailable; use svg data url
  }
  const dataUrl = (canvas as HTMLCanvasElement).toDataURL?.("image/png");
  return dataUrl ?? `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${color}"/></svg>`)}`;
}

export function patternFillOpacity(el: SvgElement): number {
  return parseOpacity(el.getAttr("opacity") ?? el.getAttr("fill-opacity"), 1);
}
