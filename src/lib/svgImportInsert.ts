import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorAsset } from "@/lib/documentPersistence";
import {
  importSvgFileToEditorGraph,
  isSvgLayerImportFile,
  readSvg,
  scaleImportedEditorGraph,
  type SvgImportResult,
} from "@/lib/svgFileImport";
import { insertNodeWithFrameParenting, worldCenteredRootPoint } from "@/lib/tree";
import type { EditorNode } from "@/stores/useEditorStore";

export type InsertImportedNodesInput = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  assets: Record<string, EditorAsset>;
  selectedIds: string[];
};

export type InsertImportedNodesResult = InsertImportedNodesInput & {
  rootId: string;
};

const DEFAULT_MAX_IMPORT_DIMENSION = 480;

/**
 * Merge an imported SVG subgraph into the canvas at a world drop point.
 * Scales large artwork down and parents the root frame under the frame at the drop location.
 */
export function insertImportedNodes(
  imported: SvgImportResult,
  worldX: number,
  worldY: number,
  existing: InsertImportedNodesInput,
  opts?: { placeIndex?: number; maxDimension?: number },
): InsertImportedNodesResult {
  const placeIndex = opts?.placeIndex ?? 0;
  const maxDimension = opts?.maxDimension ?? DEFAULT_MAX_IMPORT_DIMENSION;
  const root = imported.nodes[imported.rootId];
  if (!root) {
    return { ...existing, rootId: imported.rootId };
  }

  let nodes = { ...existing.nodes };
  let childOrder = { ...existing.childOrder };
  const assets = { ...existing.assets };
  let selectedIds = existing.selectedIds;

  const iw = root.width > 0 ? root.width : 100;
  const ih = root.height > 0 ? root.height : 100;
  const scale = Math.min(1, maxDimension / iw, maxDimension / ih);
  const w = Math.max(16, Math.round(iw * scale));
  const h = Math.max(16, Math.round(ih * scale));
  const cx = worldX + placeIndex * 12;
  const cy = worldY + placeIndex * 12;
  const { x, y } = worldCenteredRootPoint(cx, cy, w, h);

  const scaledNodes = scaleImportedEditorGraph(
    imported.nodes,
    imported.childOrder,
    imported.rootId,
    scale,
  );
  for (const [id, node] of Object.entries(scaledNodes)) {
    nodes[id] = node;
  }
  for (const [key, list] of Object.entries(imported.childOrder)) {
    if (key === EDITOR_ROOT_KEY) continue;
    childOrder[key] = list;
  }
  Object.assign(assets, imported.assets);

  const rootNode = {
    ...scaledNodes[imported.rootId]!,
    width: w,
    height: h,
  };
  const inserted = insertNodeWithFrameParenting(
    rootNode,
    { x, y, width: w, height: h },
    nodes,
    childOrder,
    selectedIds,
  );

  return {
    nodes: inserted.nodes,
    childOrder: inserted.childOrder,
    assets,
    selectedIds: [imported.rootId],
    rootId: imported.rootId,
  };
}

/** Drop a single SVG file onto the canvas at a world point. Returns imported root id or null. */
export async function dropSvgFile(
  file: File,
  worldX: number,
  worldY: number,
  existing: InsertImportedNodesInput,
): Promise<InsertImportedNodesResult | null> {
  if (!isSvgLayerImportFile(file)) return null;
  const imported = await importSvgFileToEditorGraph(file);
  if (!imported) return null;
  return insertImportedNodes(imported, worldX, worldY, existing);
}

export { readSvg, isSvgLayerImportFile };
