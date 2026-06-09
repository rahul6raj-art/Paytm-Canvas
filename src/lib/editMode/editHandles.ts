import type { EditorNode } from "@/stores/useEditorStore";
import {
  clampCornerRadii,
  getNodeCornerRadii,
  supportsCornerRadiusHandles,
} from "@/lib/cornerRadius";
import type { CornerIndex } from "@/lib/cornerRadiusDrag";
import { cornerRadiusHandlePosition, radiusFromRelativeCornerDrag } from "@/lib/shapes/shapeToPath";
import {
  effectiveEllipseArc,
  ellipseRatioHandleLocal,
  ellipseStartHandleLocal,
  ellipseSweepHandleLocal,
} from "@/lib/shapes/ellipseArc";
import { ellipseArcPatchFromDrag } from "@/lib/shapes/ellipseArcEdit";
import {
  effectivePolygonParams,
  isPolygonNode,
  polygonCornerRadiusFromLocalPoint,
  polygonCornerRadiusHandleLocal,
  polygonGeometryPatch,
  polygonSidesFromLocalPoint,
  polygonSidesHandleLocal,
} from "@/lib/shapes/polygonGeometry";
import {
  effectiveStarParams,
  isStarNode,
  starCornerRadiusHandleLocal,
  starGeometryPatch,
  starRatioFromLocalPoint,
  starRatioHandleLocal,
} from "@/lib/shapes/starGeometry";
import { lineEndpointsFromNode, lineMidpoint } from "@/lib/shapes/lineGeometry";
import {
  arrowEndCapHandleLocal,
  arrowHeadSizeHandleLocal,
  arrowStartCapHandleLocal,
  isArrowNode,
} from "@/lib/shapes/arrowEditGeometry";
import type { EditHandle, EditHandleContext, EditHandleDragInput } from "./types";

/** Returns shape-specific edit handles for `node` (local coordinates). */
export function getEditHandles(
  node: EditorNode,
  _ctx?: EditHandleContext,
): EditHandle[] {
  const handles: EditHandle[] = [];

  if (supportsCornerRadiusHandles(node)) {
    const radii = getNodeCornerRadii(node);
    const corners: CornerIndex[] = [0, 1, 2, 3];
    for (const ci of corners) {
      handles.push({
        id: `corner-${ci}`,
        kind: "cornerRadius",
        local: cornerRadiusHandlePosition(node.width, node.height, radii, ci),
        meta: { cornerIndex: ci },
      });
    }
  }

  if (node.type === "ellipse") {
    const arc = effectiveEllipseArc(node);
    handles.push(
      {
        id: "arc-start",
        kind: "ellipseArcStart",
        local: ellipseStartHandleLocal(node.width, node.height, arc.startDeg),
      },
      {
        id: "arc-sweep",
        kind: "ellipseArcEnd",
        local: ellipseSweepHandleLocal(
          node.width,
          node.height,
          arc.startDeg,
          arc.sweepDeg,
        ),
      },
      {
        id: "arc-ratio",
        kind: "ellipseArcRatio",
        local: ellipseRatioHandleLocal(
          node.width,
          node.height,
          arc.startDeg,
          arc.sweepDeg,
          arc.innerRadiusRatio,
        ),
      },
    );
  }

  if (isPolygonNode(node)) {
    const params = effectivePolygonParams(node);
    handles.push(
      {
        id: "poly-sides",
        kind: "polygonSides",
        local: polygonSidesHandleLocal(params.sides, node.width, node.height),
        meta: { sides: params.sides },
      },
      {
        id: "poly-corner",
        kind: "polygonCornerRadius",
        local: polygonCornerRadiusHandleLocal(
          params.sides,
          node.width,
          node.height,
          params.cornerRadius,
        ),
      },
    );
  }

  if (isStarNode(node)) {
    const params = effectiveStarParams(node);
    handles.push(
      {
        id: "star-ratio",
        kind: "starRatio",
        local: starRatioHandleLocal(
          params.pointCount,
          params.ratio,
          node.width,
          node.height,
        ),
      },
      {
        id: "star-corner",
        kind: "starCornerRadius",
        local: starCornerRadiusHandleLocal(
          params.pointCount,
          params.ratio,
          node.width,
          node.height,
          params.cornerRadius,
        ),
      },
    );
  }

  if (node.type === "line" || node.type === "arrow") {
    const ep = lineEndpointsFromNode(node);
    handles.push(
      { id: "line-start", kind: "lineStart", local: { x: ep.x1, y: ep.y1 } },
      { id: "line-end", kind: "lineEnd", local: { x: ep.x2, y: ep.y2 } },
      { id: "line-body", kind: "lineBody", local: lineMidpoint(ep) },
    );
    if (isArrowNode(node)) {
      handles.push(
        {
          id: "arrow-start-cap",
          kind: "arrowStartCap",
          local: arrowStartCapHandleLocal(node),
        },
        {
          id: "arrow-end-cap",
          kind: "arrowEndCap",
          local: arrowEndCapHandleLocal(node),
        },
        {
          id: "arrow-head-size",
          kind: "arrowHeadSize",
          local: arrowHeadSizeHandleLocal(node),
        },
      );
    }
  }

  if (node.type === "path" && node.pathPoints) {
    for (const pt of node.pathPoints) {
      handles.push({
        id: `anchor-${pt.id}`,
        kind: "pathAnchor",
        local: { x: pt.x, y: pt.y },
        meta: { pointId: pt.id },
      });
      if (pt.handleIn) {
        handles.push({
          id: `in-${pt.id}`,
          kind: "pathHandleIn",
          local: { x: pt.x + pt.handleIn.x, y: pt.y + pt.handleIn.y },
          meta: { pointId: pt.id },
        });
      }
      if (pt.handleOut) {
        handles.push({
          id: `out-${pt.id}`,
          kind: "pathHandleOut",
          local: { x: pt.x + pt.handleOut.x, y: pt.y + pt.handleOut.y },
          meta: { pointId: pt.id },
        });
      }
    }
  }

  return handles;
}

/**
 * Applies a handle drag sample to produce a node patch (geometry only).
 * Live drags in the UI use dedicated drag modules with preview + undo; this is the shared API.
 */
export function updateFromHandle(
  node: EditorNode,
  input: EditHandleDragInput,
  session?: { grabRadius?: number; grabLocalX?: number; grabLocalY?: number },
): Partial<EditorNode> | null {
  const { kind, localX, localY } = input;
  const cornerIndex = input.meta?.cornerIndex as CornerIndex | undefined;

  switch (kind) {
    case "cornerRadius": {
      if (!supportsCornerRadiusHandles(node) || cornerIndex == null) return null;
      const maxR = Math.min(node.width, node.height) / 2;
      const raw = radiusFromRelativeCornerDrag(
        cornerIndex,
        session?.grabRadius ?? 0,
        session?.grabLocalX ?? 0,
        session?.grabLocalY ?? 0,
        localX,
        localY,
        node.width,
        node.height,
        maxR,
      );
      const start = getNodeCornerRadii(node);
      const next: [number, number, number, number] = input.shiftKey
        ? [raw, raw, raw, raw]
        : [...start];
      if (!input.shiftKey) next[cornerIndex] = raw;
      const clamped = clampCornerRadii(next, node.width, node.height);
      const allSame =
        clamped[0] === clamped[1] && clamped[1] === clamped[2] && clamped[2] === clamped[3];
      if (allSame) return { cornerRadius: clamped[0], cornerRadii: undefined };
      return { cornerRadius: undefined, cornerRadii: clamped };
    }
    case "polygonSides": {
      if (!isPolygonNode(node)) return null;
      const sides = polygonSidesFromLocalPoint(localX, localY, node.width, node.height);
      return polygonGeometryPatch(node, { polygonSides: sides });
    }
    case "polygonCornerRadius": {
      if (!isPolygonNode(node)) return null;
      const params = effectivePolygonParams(node);
      const cr = polygonCornerRadiusFromLocalPoint(
        localX,
        localY,
        params.sides,
        node.width,
        node.height,
      );
      return polygonGeometryPatch(node, { cornerRadius: cr });
    }
    case "starRatio": {
      if (!isStarNode(node)) return null;
      const params = effectiveStarParams(node);
      const ratio = starRatioFromLocalPoint(
        localX,
        localY,
        params.pointCount,
        node.width,
        node.height,
      );
      return starGeometryPatch(node, { starInnerRadius: ratio });
    }
    case "ellipseArcStart":
    case "ellipseArcEnd":
    case "ellipseArcSweep":
    case "ellipseArcRatio":
      if (node.type !== "ellipse") return null;
      return ellipseArcPatchFromDrag(node, kind, localX, localY);
    default:
      return null;
  }
}
