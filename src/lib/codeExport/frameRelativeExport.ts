import type { EditorNode } from "@/stores/useEditorStore";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { PC_ROOT_ATTR } from "./pcMetadata";
import { PML_PHONE_VIEWPORT } from "@/lib/craftBridge/pmlScreenMetrics";

/** Nearest ancestor frame (or the node itself if it is a frame). */
export function findEnclosingFrameId(
  nodeId: string,
  nodes: Record<string, EditorNode>,
): string | null {
  let id: string | null = nodeId;
  let lastFrame: string | null = null;
  while (id) {
    const n: EditorNode | undefined = nodes[id];
    if (!n) break;
    if (n.type === "frame") lastFrame = id;
    id = n.parentId;
  }
  return lastFrame;
}

/** Code panel always exports the enclosing screen frame, not arbitrary layer offsets on canvas. */
export function pickCodeExportRootIds(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string[] {
  if (selectedIds.length > 0) {
    const frameId = findEnclosingFrameId(selectedIds[0]!, nodes);
    if (frameId) return [frameId];
  }

  const roots = childOrder[EDITOR_ROOT_KEY] ?? [];
  const firstFrame = roots.find((id) => nodes[id]?.type === "frame");
  if (firstFrame) return [firstFrame];

  return roots.filter((id) => nodes[id]?.visible !== false).slice(0, 1);
}

export function frameDimensionsForExport(
  rootId: string,
  nodes: Record<string, EditorNode>,
): { width: number; height: number } {
  const n = nodes[rootId];
  if (!n) return { width: PML_PHONE_VIEWPORT.width, height: PML_PHONE_VIEWPORT.height };
  return {
    width: Math.max(1, Math.ceil(n.width)),
    height: Math.max(1, Math.ceil(n.height)),
  };
}

export function pcRootAttr(rootId: string): string {
  return ` ${PC_ROOT_ATTR}="${rootId}"`;
}

/** Canvas artboard position for the screen frame after code → canvas import */
export const CANVAS_FRAME_ORIGIN = { x: 80, y: 80 };

export function placeScreenFrameOnCanvas(
  nodes: Record<string, EditorNode>,
  rootIds: string[],
): Record<string, EditorNode> {
  const next = { ...nodes };
  for (const rid of rootIds) {
    const r = next[rid];
    if (r && (r.type === "frame" || r.type === "group")) {
      next[rid] = { ...r, x: CANVAS_FRAME_ORIGIN.x, y: CANVAS_FRAME_ORIGIN.y };
    }
  }
  return next;
}
