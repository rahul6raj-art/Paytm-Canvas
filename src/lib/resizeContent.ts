import { cornerRadiiMax, getNodeCornerRadii, hasIndependentCornerRadii, type CornerRadii } from "@/lib/cornerRadius";
import { applyMatrixToPathD } from "@/lib/mask/buildExactMaskPath";
import { clonePathPoints, scalePathPoints, type PathPoint } from "@/lib/pathGeometry";
import { isPolygonNode, polygonGeometryPatch } from "@/lib/shapes/polygonGeometry";
import { isStarNode, starGeometryPatch } from "@/lib/shapes/starGeometry";
import { scaleSvgPathD } from "@/lib/svgImport/parseSvgPath";
import { scaleMatrix } from "@/lib/transformMath";
import type { EditorNode } from "@/stores/useEditorStore";
import type { Bounds, ResizeHandle, ResizeModifiers } from "@/lib/resize";
import { isProportionalResize } from "@/lib/resize";
import { isCornerHandle } from "@/lib/resizeTransform";

function scaleFlattenedPathD(d: string, sx: number, sy: number): string {
  if (Math.abs(sx - sy) < 1e-12) return scaleSvgPathD(d, sx);
  return applyMatrixToPathD(d, scaleMatrix(sx, sy)) ?? d;
}

function patchPathGeometryFromScale(
  node: Pick<EditorNode, "pathPoints" | "flattenedPathData">,
  sx: number,
  sy: number,
): Partial<EditorNode> {
  const patch: Partial<EditorNode> = {};
  if (node.pathPoints?.length) {
    patch.pathPoints = scalePathPoints(node.pathPoints, sx, sy);
  }
  const baked = node.flattenedPathData?.trim();
  if (baked) {
    patch.flattenedPathData = scaleFlattenedPathD(baked, sx, sy);
  }
  return patch;
}

function uniformScaleFactor(
  sx: number,
  sy: number,
  handle: ResizeHandle,
  modifiers: ResizeModifiers,
): number {
  if (isProportionalResize(handle, modifiers)) return Math.max(sx, sy);
  if (isCornerHandle(handle)) return Math.sqrt(Math.max(0, sx * sy));
  return Math.max(sx, sy);
}

function shouldScaleTextContent(handle: ResizeHandle, modifiers: ResizeModifiers): boolean {
  // Reflow/wrap on box resize; only scale glyphs on explicit proportional resize (Shift+Option).
  return isProportionalResize(handle, modifiers);
}

/** Corner radius stays fixed in px during proportional scale (Figma-style). */
function shouldScaleCornerRadius(handle: ResizeHandle, modifiers: ResizeModifiers): boolean {
  if (isProportionalResize(handle, modifiers)) return false;
  return isCornerHandle(handle);
}

/** Scale nested content when proportional resize is applied to a container. */
export function scaleSubtreeContentPatches(
  rootId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  sx: number,
  sy: number,
  uniform: number,
  startNodes?: Record<string, EditorNode>,
): Record<string, Partial<EditorNode>> {
  const out: Record<string, Partial<EditorNode>> = {};
  const stack = [...(childOrder[rootId] ?? [])];

  while (stack.length > 0) {
    const id = stack.pop()!;
    const n = nodes[id];
    if (!n || !n.visible || n.locked) continue;
    const base = startNodes?.[id] ?? n;

    const patch: Partial<EditorNode> = {
      x: base.x * sx,
      y: base.y * sy,
      width: Math.max(1, base.width * sx),
      height: Math.max(1, base.height * sy),
    };

    if (n.type === "text") {
      const fs = base.fontSize ?? 14;
      const ls = base.letterSpacing ?? 0;
      patch.fontSize = Math.max(1, Math.round(fs * uniform * 100) / 100);
      if (ls !== 0) patch.letterSpacing = ls * uniform;
    }

    if (isPolygonNode(base)) {
      Object.assign(
        patch,
        polygonGeometryPatch(
          { ...base, width: patch.width!, height: patch.height! },
          { polygonSides: base.polygonSides, cornerRadius: base.cornerRadius },
        ),
      );
    } else if (isStarNode(base)) {
      Object.assign(
        patch,
        starGeometryPatch(
          { ...base, width: patch.width!, height: patch.height! },
          {
            starPoints: base.starPoints,
            starInnerRadius: base.starInnerRadius,
            cornerRadius: base.cornerRadius,
          },
        ),
      );
    } else if (base.type === "path") {
      Object.assign(patch, patchPathGeometryFromScale(base, sx, sy));
    }

    out[id] = patch;
    for (const cid of childOrder[id] ?? []) stack.push(cid);
  }

  return out;
}

export type ResizeContentOpts = {
  /** Drag-start anchors; live resize must scale from this snapshot, not current pathPoints. */
  startPathPoints?: PathPoint[];
  /** Drag-start baked path geometry for imported/outlined vectors. */
  startFlattenedPathData?: string;
  /** Drag-start typography for proportional text scale (live preview). */
  startFontSize?: number;
  startLetterSpacing?: number;
};

export function pathContentPatchFromBoxResize(
  node: Pick<EditorNode, "type" | "width" | "height" | "pathPoints" | "flattenedPathData">,
  nextWidth: number,
  nextHeight: number,
): Partial<EditorNode> {
  if (node.type !== "path") return {};
  if (!node.pathPoints?.length && !node.flattenedPathData?.trim()) return {};
  const sx = node.width > 0 ? nextWidth / node.width : 1;
  const sy = node.height > 0 ? nextHeight / node.height : 1;
  if (Math.abs(sx - 1) < 1e-12 && Math.abs(sy - 1) < 1e-12) return {};
  return patchPathGeometryFromScale(node, sx, sy);
}

/** Scale editable vector path anchors when only the node box changes (inspector, align, etc.). */
export function syncEditablePathAfterBoxChange(
  before: Pick<EditorNode, "type" | "width" | "height" | "pathPoints" | "polygonSides" | "starPoints">,
  after: Pick<EditorNode, "type" | "width" | "height" | "pathPoints" | "polygonSides" | "starPoints">,
): Partial<EditorNode> {
  if (after.type !== "path" || isPolygonNode(after) || isStarNode(after) || !before.pathPoints?.length) {
    return {};
  }
  return pathContentPatchFromBoxResize(before, after.width, after.height);
}

export function buildResizeContentOpts(
  nodeId: string,
  opts?: { startPathPoints?: PathPoint[]; startNodesSnapshot?: Record<string, EditorNode> },
): ResizeContentOpts | undefined {
  if (!opts?.startPathPoints && !opts?.startNodesSnapshot) return undefined;
  const snap = opts.startNodesSnapshot?.[nodeId];
  return {
    startPathPoints:
      opts.startPathPoints ??
      (snap?.pathPoints?.length ? clonePathPoints(snap.pathPoints) : undefined),
    startFlattenedPathData: snap?.flattenedPathData,
    startFontSize: snap?.fontSize,
    startLetterSpacing: snap?.letterSpacing,
  };
}

export function buildResizeContentPatches(
  node: EditorNode,
  start: Bounds,
  next: Bounds,
  handle: ResizeHandle,
  modifiers: ResizeModifiers,
  opts?: ResizeContentOpts,
): Partial<EditorNode> {
  const sx = start.width > 0 ? next.width / start.width : 1;
  const sy = start.height > 0 ? next.height / start.height : 1;
  if (sx === 1 && sy === 1) return {};

  const uniform = uniformScaleFactor(sx, sy, handle, modifiers);
  const patches: Partial<EditorNode> = {};

  if (node.type === "text" && shouldScaleTextContent(handle, modifiers)) {
    const fs = opts?.startFontSize ?? node.fontSize ?? 14;
    const ls = opts?.startLetterSpacing ?? node.letterSpacing ?? 0;
    patches.fontSize = Math.max(1, Math.round(fs * uniform * 100) / 100);
    if (ls !== 0) patches.letterSpacing = ls * uniform;
  }

  if (isPolygonNode(node)) {
    Object.assign(
      patches,
      polygonGeometryPatch(
        { ...node, width: next.width, height: next.height },
        { polygonSides: node.polygonSides, cornerRadius: node.cornerRadius },
      ),
    );
  } else if (isStarNode(node)) {
    Object.assign(
      patches,
      starGeometryPatch(
        { ...node, width: next.width, height: next.height },
        {
          starPoints: node.starPoints,
          starInnerRadius: node.starInnerRadius,
          cornerRadius: node.cornerRadius,
        },
      ),
    );
  } else if (
    node.type === "path" &&
    (node.pathPoints?.length || node.flattenedPathData?.trim())
  ) {
    const base = opts?.startPathPoints ?? node.pathPoints;
    const refWidth = opts?.startPathPoints ? start.width : node.width;
    const refHeight = opts?.startPathPoints ? start.height : node.height;
    const refFlattened = opts?.startFlattenedPathData ?? node.flattenedPathData;
    Object.assign(
      patches,
      pathContentPatchFromBoxResize(
        {
          type: "path",
          width: refWidth,
          height: refHeight,
          pathPoints: base,
          flattenedPathData: refFlattened,
        },
        next.width,
        next.height,
      ),
    );
  }

  if (node.type === "rectangle" || node.type === "frame") {
    const radii = getNodeCornerRadii(node);
    if (cornerRadiiMax(radii) > 0 && shouldScaleCornerRadius(handle, modifiers)) {
      const scaled = radii.map((r) => Math.max(0, r * uniform)) as CornerRadii;
      if (hasIndependentCornerRadii(node) || node.cornerRadii) {
        patches.cornerRadii = scaled;
        patches.cornerRadius = undefined;
      } else {
        patches.cornerRadius = scaled[0];
      }
    }
  }

  return patches;
}

export function shouldProportionalFrameScale(handle: ResizeHandle, modifiers: ResizeModifiers): boolean {
  return isProportionalResize(handle, modifiers);
}
