import { roundedRectBorderFills } from "@/lib/borderGeometry";
import { effectiveStrokeType } from "@/lib/fillGradient";
import { resolveShapeStrokeAttr } from "@/lib/gradient/svgSceneFill";
import {
  resolveStrokeSideWidths,
  resolveStrokeSides,
  resolveStrokeSidePaint,
  strokeEdgeRects,
  usesPerEdgeStroke,
} from "@/lib/strokeAlign";
import { strokeIsVisible } from "@/lib/stroke";
import { escXml, svgSafeId } from "@/lib/svgMarkupCore";
import type { EditorNode, StrokePosition } from "@/stores/useEditorStore";

export type SvgPerSideStrokeInput = Pick<
  EditorNode,
  | "type"
  | "width"
  | "height"
  | "strokeWidth"
  | "strokeSides"
  | "strokeSidesCustom"
  | "strokeSidesCustomColors"
  | "strokePosition"
  | "strokeStyle"
  | "strokeType"
  | "strokeGradient"
  | "strokeImageAssetId"
  | "strokeVideoAssetId"
  | "strokeColor"
  | "strokeOpacity"
  | "strokeEnabled"
  | "cornerRadius"
  | "cornerRadii"
  | "strokeLinecap"
  | "strokeLinejoin"
  | "strokeDashLength"
  | "strokeDashGap"
>;

export function shouldRenderSvgPerSideStroke(node: SvgPerSideStrokeInput): boolean {
  if (!strokeIsVisible(node)) return false;
  if (!usesPerEdgeStroke(node)) return false;
  if (effectiveStrokeType(node) === "video") return false;
  return true;
}

function resolvePerSideBandPaint(
  node: SvgPerSideStrokeInput,
  side: "top" | "right" | "bottom" | "left",
  opts: {
    nodeId: string;
    width: number;
    height: number;
    registerGradient: (id: string, markup: string) => void;
  },
): string {
  if (effectiveStrokeType(node) === "solid") {
    return resolveStrokeSidePaint(node, side);
  }
  const stroke = resolveShapeStrokeAttr({
    node,
    width: opts.width,
    height: opts.height,
    nodeId: opts.nodeId,
    registerGradient: opts.registerGradient,
  });
  return stroke.strokeAttr !== "none" ? stroke.strokeAttr : resolveStrokeSidePaint(node, side);
}

/**
 * SVG markup for Figma-style individual strokes (per-side weights / partial sides).
 * Returns null when the caller should use a single outline stroke on the shape.
 */
export function svgPerSideStrokeMarkup(
  node: SvgPerSideStrokeInput,
  opts: {
    nodeId: string;
    width: number;
    height: number;
    /** Closed outline for inside-clip (rounded partial strokes). */
    clipPathD: string;
    strokeColor: string;
    strokeAttrs: string;
    filterAttr?: string;
    registerGradient?: (id: string, markup: string) => void;
    assets?: Record<string, import("@/lib/documentPersistence").EditorAsset>;
    renderScale?: number;
  },
): string | null {
  if (!shouldRenderSvgPerSideStroke(node)) return null;

  const w = Math.max(1, opts.width);
  const h = Math.max(1, opts.height);
  const position: StrokePosition = node.strokePosition ?? "center";
  const filter = opts.filterAttr ?? "";
  const sides = resolveStrokeSides(node);
  const sideWidths = resolveStrokeSideWidths(node);
  const gradientDefs: string[] = [];
  const registerGradient =
    opts.registerGradient ??
    ((_id: string, markup: string) => {
      gradientDefs.push(markup);
    });
  const strokeNodeId = `pc-sg-${svgSafeId(opts.nodeId)}`;
  const paintOpts = {
    nodeId: strokeNodeId,
    width: w,
    height: h,
    registerGradient,
    assets: opts.assets,
    renderScale: opts.renderScale,
  };

  const borderFills = roundedRectBorderFills(node);
  let body = "";
  if (borderFills?.length) {
    body = borderFills
      .map((fill) => {
        const paint = escXml(resolvePerSideBandPaint(node, fill.side, paintOpts));
        return `<path d="${escXml(fill.pathD)}" fill="${paint}"${filter}/>`;
      })
      .join("");
  } else {
    const rects = strokeEdgeRects(w, h, position, sides, sideWidths);
    if (!rects.length) return null;
    body = rects
      .map((r) => {
        const paint = escXml(resolvePerSideBandPaint(node, r.side, paintOpts));
        return `<rect x="${r.x}" y="${r.y}" width="${Math.max(0, r.width)}" height="${Math.max(0, r.height)}" fill="${paint}"${filter}/>`;
      })
      .join("");
  }

  if (!body) return null;
  const defs = gradientDefs.length ? `<defs>${gradientDefs.join("")}</defs>` : "";
  return `${defs}${body}`;
}

/** Outside individual strokes paint below fill; inside/center paint above. */
export function svgPerSideStrokeBeforeFill(position: StrokePosition | undefined): boolean {
  return (position ?? "center") === "outside";
}
