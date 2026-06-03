import type { EditorComment } from "@/lib/comments";
import type { EditorAsset } from "@/lib/documentPersistence";
import type { DesignToken } from "@/lib/designTokens";
import type { EditorNode, LayoutGuide } from "@/stores/useEditorStore";

/** Persisted document slice for undo/redo (not written to localStorage). */
export interface PersistedEditorSnapshot {
  documentName: string;
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  assets: Record<string, EditorAsset>;
  /** Omitted on snapshots from older editor builds; treated as `{}`. */
  designTokens?: Record<string, DesignToken>;
  selectedIds: string[];
  zoom: number;
  pan: { x: number; y: number };
  showGrid: boolean;
  showRulers?: boolean;
  canvasBackgroundColor: string;
  comments: EditorComment[];
  layoutGuides?: LayoutGuide[];
}

export type HistorySnapshotInput = Pick<
  PersistedEditorSnapshot,
  | "nodes"
  | "childOrder"
  | "assets"
  | "designTokens"
  | "selectedIds"
  | "zoom"
  | "pan"
  | "showGrid"
  | "showRulers"
  | "canvasBackgroundColor"
  | "comments"
  | "layoutGuides"
> & { fileName: string };

export function editorStateToHistorySnapshot(s: HistorySnapshotInput): PersistedEditorSnapshot {
  return {
    documentName: s.fileName,
    nodes: structuredClone(s.nodes),
    childOrder: structuredClone(s.childOrder),
    assets: structuredClone(s.assets),
    designTokens: structuredClone(s.designTokens),
    selectedIds: [...s.selectedIds],
    zoom: s.zoom,
    pan: { ...s.pan },
    showGrid: s.showGrid,
    showRulers: s.showRulers,
    canvasBackgroundColor: s.canvasBackgroundColor,
    comments: structuredClone(s.comments),
    layoutGuides: structuredClone(s.layoutGuides),
  };
}

export function clonePersistedEditorSnapshot(s: PersistedEditorSnapshot): PersistedEditorSnapshot {
  return editorStateToHistorySnapshot({
    fileName: s.documentName,
    nodes: s.nodes,
    childOrder: s.childOrder,
    assets: s.assets,
    designTokens: s.designTokens ?? {},
    selectedIds: s.selectedIds,
    zoom: s.zoom,
    pan: s.pan,
    showGrid: s.showGrid,
    showRulers: s.showRulers,
    canvasBackgroundColor: s.canvasBackgroundColor,
    comments: s.comments,
    layoutGuides: s.layoutGuides ?? [],
  });
}

export function filterSelectedIdsToExisting(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): string[] {
  return selectedIds.filter((id) => nodes[id] != null);
}

/** Maps a snapshot into editor store fields (deep clone + safe selection). */
export function historySnapshotToEditorPatch(snap: PersistedEditorSnapshot) {
  const nodes = structuredClone(snap.nodes);
  const childOrder = structuredClone(snap.childOrder);
  const assets = structuredClone(snap.assets);
  const designTokens = structuredClone(snap.designTokens ?? {});
  const selectedIds = filterSelectedIdsToExisting(snap.selectedIds, nodes);
  const comments = structuredClone(snap.comments);
  return {
    fileName: snap.documentName,
    nodes,
    childOrder,
    assets,
    designTokens,
    selectedIds,
    zoom: snap.zoom,
    pan: { ...snap.pan },
    showGrid: snap.showGrid,
    showRulers: snap.showRulers ?? true,
    canvasBackgroundColor: snap.canvasBackgroundColor,
    comments,
    layoutGuides: structuredClone(snap.layoutGuides ?? []),
  };
}
