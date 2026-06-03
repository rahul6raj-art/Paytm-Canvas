import type { EditorNode } from "@/stores/useEditorStore";
import {
  effectiveEllipseArc,
  ellipseArcPathD,
  hasEllipseArcInnerHole,
  isFullEllipseArc,
} from "@/lib/shapes/ellipseArc";

export const PC_ARC_START_ATTR = "data-pc-arc-start";
export const PC_ARC_SWEEP_ATTR = "data-pc-arc-sweep";
export const PC_ARC_RATIO_ATTR = "data-pc-arc-ratio";

export type EllipseArcExportStyle = Record<string, string | number>;

export function ellipseHasCustomArc(
  node: Pick<EditorNode, "type" | "arcStartDeg" | "arcSweepDeg" | "arcInnerRadiusRatio">,
): boolean {
  if (node.type !== "ellipse") return false;
  const arc = effectiveEllipseArc(node);
  return !isFullEllipseArc(arc.sweepDeg) || hasEllipseArcInnerHole(arc.innerRadiusRatio);
}

function escapeCssPathD(d: string): string {
  return d.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** CSS `clip-path` value matching canvas `ellipseArcPathD`. */
export function ellipseArcClipPathCss(
  width: number,
  height: number,
  startDeg: number,
  sweepDeg: number,
  innerRadiusRatio: number,
): string {
  const d = ellipseArcPathD(width, height, startDeg, sweepDeg, innerRadiusRatio);
  const escaped = escapeCssPathD(d);
  const useEvenodd =
    hasEllipseArcInnerHole(innerRadiusRatio) && isFullEllipseArc(sweepDeg);
  return useEvenodd ? `path(evenodd, '${escaped}')` : `path('${escaped}')`;
}

/** Inline styles for HTML/React export (clip-path pie, ring, donut; oval otherwise). */
export function ellipseArcExportStyle(node: EditorNode): EllipseArcExportStyle {
  if (node.type !== "ellipse") return {};
  const arc = effectiveEllipseArc(node);
  const w = Math.max(1, node.width);
  const h = Math.max(1, node.height);

  if (!ellipseHasCustomArc(node)) {
    return { borderRadius: "50%" };
  }

  return {
    clipPath: ellipseArcClipPathCss(
      w,
      h,
      arc.startDeg,
      arc.sweepDeg,
      arc.innerRadiusRatio,
    ),
    overflow: "hidden",
    borderRadius: 0,
  };
}

export function ellipseArcPcAttrParts(node: EditorNode): string[] {
  if (!ellipseHasCustomArc(node)) return [];
  const arc = effectiveEllipseArc(node);
  return [
    `${PC_ARC_START_ATTR}="${arc.startDeg}"`,
    `${PC_ARC_SWEEP_ATTR}="${arc.sweepDeg}"`,
    `${PC_ARC_RATIO_ATTR}="${arc.innerRadiusRatio}"`,
  ];
}

/** JSX/HTML data attributes for arc round-trip. */
export function ellipseArcJsxAttrs(node: EditorNode): string {
  return ellipseArcPcAttrParts(node)
    .map((part) => {
      const eq = part.indexOf("=");
      if (eq < 0) return "";
      const key = part.slice(0, eq);
      const raw = part.slice(eq + 2, -1);
      return ` ${key}=${JSON.stringify(raw)}`;
    })
    .join("");
}

export function parseEllipseArcPcAttrs(attrs: {
  arcStart?: string | null;
  arcSweep?: string | null;
  arcRatio?: string | null;
}): Pick<EditorNode, "arcStartDeg" | "arcSweepDeg" | "arcInnerRadiusRatio"> | null {
  const { arcStart, arcSweep, arcRatio } = attrs;
  if (arcStart == null && arcSweep == null && arcRatio == null) return null;
  const patch: Pick<EditorNode, "arcStartDeg" | "arcSweepDeg" | "arcInnerRadiusRatio"> = {};
  if (arcStart != null) {
    const n = Number(arcStart);
    if (Number.isFinite(n)) patch.arcStartDeg = ((n % 360) + 360) % 360;
  }
  if (arcSweep != null) {
    const n = Number(arcSweep);
    if (Number.isFinite(n)) patch.arcSweepDeg = Math.min(360, Math.max(0.5, n));
  }
  if (arcRatio != null) {
    const n = Number(arcRatio);
    if (Number.isFinite(n)) patch.arcInnerRadiusRatio = Math.min(0.999, Math.max(0, n));
  }
  return patch;
}
