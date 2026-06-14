import { getRenderedWorldBounds } from "@/lib/editorGraph";
import type { EditorNode } from "@/stores/useEditorStore";

export type WorldRect = { x: number; y: number; width: number; height: number };

export type ViewportCullContext = {
  enabled: boolean;
  worldViewport: WorldRect;
  pinnedIds: ReadonlySet<string>;
};

const DEFAULT_PADDING_PX = 128;

/** Viewport culling is on by default; set NEXT_PUBLIC_PAYTM_CRAFT_VIEWPORT_CULL=false to disable. */
export function isViewportCullingEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_PAYTM_CRAFT_VIEWPORT_CULL;
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return v !== "false";
}

export function rectsIntersect(a: WorldRect, b: WorldRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Visible world-space rectangle for the canvas viewport (with optional screen padding). */
export function computeWorldViewportRect(
  viewportW: number,
  viewportH: number,
  pan: { x: number; y: number },
  zoom: number,
  paddingPx = DEFAULT_PADDING_PX,
): WorldRect {
  const z = zoom > 0 ? zoom : 1;
  const pad = paddingPx / z;
  const x0 = (0 - pan.x) / z;
  const y0 = (0 - pan.y) / z;
  const x1 = (viewportW - pan.x) / z;
  const y1 = (viewportH - pan.y) / z;
  const minX = Math.min(x0, x1) - pad;
  const minY = Math.min(y0, y1) - pad;
  const maxX = Math.max(x0, x1) + pad;
  const maxY = Math.max(y0, y1) + pad;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function addNodeAndAncestors(ids: Set<string>, nodeId: string, nodes: Record<string, EditorNode>): void {
  let cur: string | null = nodeId;
  while (cur) {
    ids.add(cur);
    cur = nodes[cur]?.parentId ?? null;
  }
}

export function buildPinnedSceneIds(input: {
  selectedIds: readonly string[];
  hoveredId: string | null;
  objectEditModeNodeId: string | null;
  pathEditModeNodeId: string | null;
  editingTextId: string | null;
  penDrawingNodeId: string | null;
  pencilDrawingNodeId: string | null;
  shapeDrawingNodeId: string | null;
  frameDrawingNodeId: string | null;
  textDrawingNodeId: string | null;
  placingComponentMasterId: string | null;
  dragMovingIds: readonly string[];
  nodes: Record<string, EditorNode>;
}): Set<string> {
  const pinned = new Set<string>();
  for (const id of input.selectedIds) addNodeAndAncestors(pinned, id, input.nodes);
  if (input.hoveredId) addNodeAndAncestors(pinned, input.hoveredId, input.nodes);
  if (input.objectEditModeNodeId) addNodeAndAncestors(pinned, input.objectEditModeNodeId, input.nodes);
  if (input.pathEditModeNodeId) addNodeAndAncestors(pinned, input.pathEditModeNodeId, input.nodes);
  if (input.editingTextId) addNodeAndAncestors(pinned, input.editingTextId, input.nodes);
  if (input.penDrawingNodeId) addNodeAndAncestors(pinned, input.penDrawingNodeId, input.nodes);
  if (input.pencilDrawingNodeId) addNodeAndAncestors(pinned, input.pencilDrawingNodeId, input.nodes);
  if (input.shapeDrawingNodeId) addNodeAndAncestors(pinned, input.shapeDrawingNodeId, input.nodes);
  if (input.frameDrawingNodeId) addNodeAndAncestors(pinned, input.frameDrawingNodeId, input.nodes);
  if (input.textDrawingNodeId) addNodeAndAncestors(pinned, input.textDrawingNodeId, input.nodes);
  if (input.placingComponentMasterId) addNodeAndAncestors(pinned, input.placingComponentMasterId, input.nodes);
  for (const id of input.dragMovingIds) addNodeAndAncestors(pinned, id, input.nodes);
  return pinned;
}

export function nodeIntersectsViewport(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  worldViewport: WorldRect,
  dragOffset?: { dx: number; dy: number },
): boolean {
  const bounds = getRenderedWorldBounds(nodeId, nodes, childOrder);
  const rect: WorldRect =
    dragOffset && (dragOffset.dx !== 0 || dragOffset.dy !== 0)
      ? { ...bounds, x: bounds.x + dragOffset.dx, y: bounds.y + dragOffset.dy }
      : bounds;
  if (rect.width <= 0 && rect.height <= 0) return false;
  return rectsIntersect(rect, worldViewport);
}

export function shouldRenderCanvasNode(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  ctx: ViewportCullContext,
  opts?: {
    skipViewportCull?: boolean;
    dragOffset?: { dx: number; dy: number };
  },
): boolean {
  if (!ctx.enabled || opts?.skipViewportCull) return true;
  if (ctx.pinnedIds.has(nodeId)) return true;
  return nodeIntersectsViewport(nodeId, nodes, childOrder, ctx.worldViewport, opts?.dragOffset);
}
