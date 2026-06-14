import { buildParentMapFromChildOrder, getNodeWorldInverseMatrixFromChildOrder } from "@/lib/editorGraph";
import { buildMaskClipPathForGroup } from "@/lib/mask/buildExactMaskPath";
import { isMaskGroup } from "@/lib/mask/isMaskGroup";
import { hitTestShapePath } from "@/lib/geometry/hitTestRoundedShape";
import { tessellateSvgPathD } from "@/lib/outlineStroke";
import { pointInPolygon } from "@/lib/shapes/polygonGeometry";
import { applyMatrixToPoint } from "@/lib/transformMath";
import type { EditorNode } from "@/stores/useEditorStore";

let hitCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
let hitCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

function hitContext(): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
  if (hitCtx) return hitCtx;
  if (typeof OffscreenCanvas !== "undefined") {
    hitCanvas = new OffscreenCanvas(8, 8);
  } else if (typeof document !== "undefined") {
    hitCanvas = document.createElement("canvas");
    hitCanvas.width = 8;
    hitCanvas.height = 8;
  }
  if (!hitCanvas) return null;
  hitCtx = hitCanvas.getContext("2d");
  return hitCtx;
}

function pathFromPathD(d: string): Path2D | null {
  if (typeof Path2D === "undefined") return null;
  try {
    return new Path2D(d);
  } catch {
    return null;
  }
}

function splitPathSubpaths(pathD: string): string[] {
  const parts = pathD
    .split(/(?=M)/i)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [pathD];
}

/** Software fill hit-test when Path2D / canvas is unavailable (Node tests). */
function hitTestPathDFilled(
  pathD: string,
  localX: number,
  localY: number,
  fillRule: "nonzero" | "evenodd",
): boolean {
  const subpaths = splitPathSubpaths(pathD);
  if (fillRule === "evenodd") {
    let count = 0;
    for (const sp of subpaths) {
      const pts = tessellateSvgPathD(sp);
      if (pts.length >= 3 && pointInPolygon(localX, localY, pts)) count++;
    }
    return count % 2 === 1;
  }
  const pts = tessellateSvgPathD(pathD);
  if (pts.length < 3) return false;
  return pointInPolygon(localX, localY, pts);
}

function hitTestClipPath(
  clipD: string,
  localX: number,
  localY: number,
  fillRule: "nonzero" | "evenodd",
): boolean {
  const ctx = hitContext();
  const path = pathFromPathD(clipD);
  if (ctx && path) {
    if (fillRule === "evenodd") {
      try {
        return ctx.isPointInPath(path, localX, localY, "evenodd");
      } catch {
        /* fall through */
      }
    }
    return hitTestShapePath(ctx, path, localX, localY, { filled: true });
  }
  return hitTestPathDFilled(clipD, localX, localY, fillRule);
}

/** Point-in-mask test in group-local coordinates. */
export function isLocalPointInsideMaskPath(
  localX: number,
  localY: number,
  groupId: string,
  maskChildId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  const clip = buildMaskClipPathForGroup(groupId, maskChildId, nodes, childOrder);
  if (!clip) return true;
  return hitTestClipPath(clip.clipD, localX, localY, clip.clipRule);
}

/** Figma: clicks outside the mask path pass through masked children. */
export function isWorldPointVisibleThroughMaskAncestors(
  worldX: number,
  worldY: number,
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  const parentOf = buildParentMapFromChildOrder(childOrder);
  let cur: string | null = nodeId;

  while (cur) {
    const parentId: string | null = parentOf.get(cur) ?? null;
    if (!parentId) break;
    const parent = nodes[parentId];
    if (parent && isMaskGroup(parent) && parent.maskId) {
      const maskChildId = parent.maskId;
      if (cur !== maskChildId) {
        const inv = getNodeWorldInverseMatrixFromChildOrder(parentId, nodes, childOrder);
        if (!inv) return false;
        const local = applyMatrixToPoint(inv, { x: worldX, y: worldY });
        if (!isLocalPointInsideMaskPath(local.x, local.y, parentId, maskChildId, nodes, childOrder)) {
          return false;
        }
      }
    }
    cur = parentId;
  }
  return true;
}
