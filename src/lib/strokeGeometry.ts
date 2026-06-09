import { clampCornerRadii, getNodeCornerRadii } from "@/lib/cornerRadius";
import { polygonVertices, clampPolygonSides } from "@/lib/shapes/polygonGeometry";
import { starVertices, clampStarPointCount, clampStarRatio } from "@/lib/shapes/starGeometry";
import type { StrokeLinejoin } from "@/lib/stroke";
import { offsetContourPathD, strokeCenterlineOffset } from "@/lib/strokeOffset";
import type { StrokeAlign, StrokeSpec } from "@/lib/strokeSpec";
import type { EditorNode } from "@/stores/useEditorStore";

export type ShapeContourKind = "sharpRect" | "roundedRect" | "ellipse" | "polygon";

export type ShapeContour = {
  kind: ShapeContourKind;
  width: number;
  height: number;
  radii?: ReturnType<typeof clampCornerRadii>;
  points?: { x: number; y: number }[];
};

export function shapeContourForNode(
  node: Pick<
    EditorNode,
    | "type"
    | "width"
    | "height"
    | "cornerRadius"
    | "cornerRadii"
    | "polygonSides"
    | "starPoints"
    | "starInnerRadius"
  >,
): ShapeContour | null {
  const w = node.width;
  const h = node.height;
  if (node.type === "rectangle" || node.type === "frame") {
    const radii = clampCornerRadii(getNodeCornerRadii(node), w, h);
    const sharp = radii.every((r) => r === 0);
    return { kind: sharp ? "sharpRect" : "roundedRect", width: w, height: h, radii };
  }
  if (node.type === "ellipse") {
    return { kind: "ellipse", width: w, height: h };
  }
  if (node.type === "polygon") {
    const sides = clampPolygonSides(node.polygonSides ?? 6);
    const r = Math.max(0, node.cornerRadius ?? 0);
    const verts = polygonVertices(sides, w, h);
    return { kind: "polygon", width: w, height: h, points: verts };
  }
  if (node.type === "path" && node.starPoints != null) {
    const spikes = clampStarPointCount(node.starPoints);
    const ratio = clampStarRatio(node.starInnerRadius ?? 0.4);
    const verts = starVertices(spikes, ratio, w, h);
    return { kind: "polygon", width: w, height: h, points: verts };
  }
  return null;
}

/** Stroke centerline path for align + width; null → use original path (center on outline). */
export function strokeCenterlinePathD(
  contour: ShapeContour | null,
  basePathD: string,
  align: StrokeAlign,
  strokeWidth: number,
  join: StrokeLinejoin,
): string {
  if (!contour || align === "center") return basePathD;
  const offset = strokeCenterlineOffset(align, strokeWidth);
  if (Math.abs(offset) < 1e-9) return basePathD;

  const d = offsetContourPathD(
    contour.kind,
    {
      width: contour.width,
      height: contour.height,
      radii: contour.radii,
      points: contour.points,
      join,
    },
    align,
    strokeWidth,
  );
  return d ?? basePathD;
}

export function strokeRenderPaths(
  contour: ShapeContour | null,
  basePathD: string,
  spec: Pick<StrokeSpec, "align" | "width" | "join">,
): { fillPathD: string; strokePathD: string } {
  const strokePathD = strokeCenterlinePathD(
    contour,
    basePathD,
    spec.align,
    spec.width,
    spec.join,
  );
  return { fillPathD: basePathD, strokePathD };
}
