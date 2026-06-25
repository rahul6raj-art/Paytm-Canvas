import { worldToNodeLocalFromChildOrder } from "@/lib/editorGraph";
import { hitTestPenPathAtZoom, type PenHitTarget } from "@/lib/penTool";
import type { EditorState } from "@/stores/useEditorStore";

export function resolvePathEditTargetNodeId(
  st: Pick<EditorState, "pathEditModeNodeId" | "selectedIds" | "nodes">,
): string | null {
  if (st.pathEditModeNodeId) return st.pathEditModeNodeId;
  if (st.selectedIds.length !== 1) return null;
  const id = st.selectedIds[0]!;
  return st.nodes[id]?.type === "path" ? id : null;
}

export function hitTestPathEditTargetAtWorld(
  worldX: number,
  worldY: number,
  st: Pick<EditorState, "pathEditModeNodeId" | "selectedIds" | "nodes" | "childOrder" | "zoom">,
): { pathId: string; hit: PenHitTarget } | null {
  const pathId = resolvePathEditTargetNodeId(st);
  if (!pathId) return null;
  const node = st.nodes[pathId];
  if (!node?.pathPoints?.length) return null;
  const local = worldToNodeLocalFromChildOrder(worldX, worldY, pathId, st.nodes, st.childOrder);
  const hit = hitTestPenPathAtZoom(
    local.x,
    local.y,
    node.pathPoints,
    node.pathClosed ?? false,
    st.zoom,
  );
  return hit ? { pathId, hit } : null;
}

export function selectedPathPointIdFromHit(hit: PenHitTarget): string | null {
  if (hit.kind === "segment") return null;
  return hit.pointId;
}

export function hitTestPathAtWorld(
  pathId: string,
  worldX: number,
  worldY: number,
  st: Pick<EditorState, "nodes" | "childOrder" | "zoom">,
): PenHitTarget | null {
  const node = st.nodes[pathId];
  if (!node?.pathPoints?.length) return null;
  const local = worldToNodeLocalFromChildOrder(worldX, worldY, pathId, st.nodes, st.childOrder);
  return hitTestPenPathAtZoom(
    local.x,
    local.y,
    node.pathPoints,
    node.pathClosed ?? false,
    st.zoom,
  );
}

/** Hit-test and select a specific path node (pen tool clicks on path body). */
export function applyPathPointHitOnPath(
  pathId: string,
  worldX: number,
  worldY: number,
  st: Pick<EditorState, "pathEditModeNodeId" | "nodes" | "childOrder" | "zoom">,
  actions: {
    setPathEditMode: (nodeId: string | null) => void;
    setSelectedPathPointIds: (ids: string[]) => void;
    select: (nodeId: string) => void;
  },
): boolean {
  const hit = hitTestPathAtWorld(pathId, worldX, worldY, st);
  if (!hit) return false;
  actions.select(pathId);
  if (st.pathEditModeNodeId !== pathId) actions.setPathEditMode(pathId);
  actions.setSelectedPathPointIds(
    hit.kind === "segment" ? [] : [selectedPathPointIdFromHit(hit)!],
  );
  return true;
}

/** Apply anchor/handle/segment hit to path edit selection state. Returns true when consumed. */
export function applyPathEditHitSelection(
  worldX: number,
  worldY: number,
  st: Pick<EditorState, "pathEditModeNodeId" | "selectedIds" | "nodes" | "childOrder" | "zoom">,
  actions: {
    setPathEditMode: (nodeId: string | null) => void;
    setSelectedPathPointIds: (ids: string[]) => void;
    select: (nodeId: string) => void;
  },
): boolean {
  const result = hitTestPathEditTargetAtWorld(worldX, worldY, st);
  if (!result) return false;
  const { pathId, hit } = result;
  actions.select(pathId);
  if (st.pathEditModeNodeId !== pathId) actions.setPathEditMode(pathId);
  actions.setSelectedPathPointIds(
    hit.kind === "segment" ? [] : [selectedPathPointIdFromHit(hit)!],
  );
  return true;
}
