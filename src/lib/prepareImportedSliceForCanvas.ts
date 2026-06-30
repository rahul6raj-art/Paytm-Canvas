import type { EditorPersistSlice } from "@/lib/documentPersistence";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { captureActivePage } from "@/lib/editorPages";
import { parseCssColor } from "@/lib/color";
import type { EditorNode } from "@/stores/useEditorStore";
import { enforceManualScreenFrames } from "@/lib/webImport/enforceManualScreenFrames";
import {
  normalizeBottomNavTextNodes,
  normalizeImportedLabelTextNodes,
  normalizeListItemTextNodes,
  normalizeWebImportTextNodes,
} from "@/lib/webImport/normalizeWebImportLayers";
import { isPhoneShellClassName } from "@/lib/webImport/phoneShellViewport";

function hasUnresolvableCssColor(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  if (!value.includes("var(")) return false;
  return !parseCssColor(value.trim());
}

function patchPaint(node: EditorNode, field: "fill" | "strokeColor" | "textColor"): EditorNode {
  const raw = node[field];
  if (!hasUnresolvableCssColor(raw)) return node;

  if (field === "fill") {
    return {
      ...node,
      fill: node.type === "text" ? undefined : "#FFFFFF",
      fillEnabled: node.type !== "text",
    };
  }
  if (field === "textColor") {
    return { ...node, textColor: "#111111" };
  }
  return { ...node, strokeColor: undefined, strokeEnabled: false };
}

function sanitizeNodePaints(node: EditorNode): EditorNode {
  let next = node;
  next = patchPaint(next, "fill");
  next = patchPaint(next, "strokeColor");
  next = patchPaint(next, "textColor");

  if ((next.type === "frame" || next.type === "group") && next.clipChildren !== true) {
    next = { ...next, clipChildren: false };
  }

  return next;
}

function sanitizeNodesRecord(nodes: Record<string, EditorNode>): Record<string, EditorNode> {
  const out: Record<string, EditorNode> = {};
  for (const [id, node] of Object.entries(nodes)) {
    out[id] = sanitizeNodePaints(node);
  }
  return out;
}

/** Live web capture often omits root fills — give artboards a visible backdrop on the canvas. */
function ensureRootFrameVisible(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Record<string, EditorNode> {
  const roots = childOrder[EDITOR_ROOT_KEY] ?? [];
  if (roots.length === 0) return nodes;

  const next = { ...nodes };
  for (const rootId of roots) {
    const node = next[rootId];
    if (!node || node.type === "text") continue;
    if (node.fillEnabled && node.fill) continue;
    next[rootId] = {
      ...node,
      fill: "#FFFFFF",
      fillEnabled: true,
      clipChildren:
        node.clipChildren === true || isPhoneShellClassName(node.codeClassName) ? true : false,
    };
  }
  return next;
}

function syncPagesWithCanvas(slice: EditorPersistSlice): EditorPersistSlice {
  if (!slice.pages || !slice.activePageId) return slice;
  const active = captureActivePage({
    activePageId: slice.activePageId,
    activeSubPageId: slice.activeSubPageId,
    pages: slice.pages,
    pageOrder: slice.pageOrder ?? [],
    nodes: slice.nodes,
    childOrder: slice.childOrder,
    zoom: slice.zoom,
    pan: slice.pan,
    showGrid: slice.showGrid,
    showRulers: slice.showRulers,
    canvasBackgroundColor: slice.canvasBackgroundColor,
    selectedIds: slice.selectedIds,
    layoutGuides: slice.layoutGuides ?? [],
  });
  return {
    ...slice,
    pages: { ...slice.pages, [slice.activePageId]: active },
  };
}

/** Ensure bridge/import slices paint on SVG (no var() fills, no clip hiding children). */
export function prepareImportedSliceForCanvas(
  slice: EditorPersistSlice,
  opts?: { preserveCaptureGeometry?: boolean },
): EditorPersistSlice {
  const freezeGeometry = opts?.preserveCaptureGeometry === true;
  let nodes = sanitizeNodesRecord(slice.nodes);
  if (!freezeGeometry) {
    normalizeWebImportTextNodes(nodes);
    normalizeImportedLabelTextNodes(nodes);
    normalizeListItemTextNodes(nodes, slice.childOrder);
    normalizeBottomNavTextNodes(nodes);
  }
  nodes = ensureRootFrameVisible(nodes, slice.childOrder);
  enforceManualScreenFrames(nodes, slice.childOrder);

  let next: EditorPersistSlice = { ...slice, nodes };
  if (next.pages && next.activePageId) {
    const pages = { ...next.pages };
    for (const [pageId, page] of Object.entries(pages)) {
      let pageNodes = sanitizeNodesRecord(page.nodes);
      if (!freezeGeometry) {
        normalizeWebImportTextNodes(pageNodes);
        normalizeImportedLabelTextNodes(pageNodes);
        normalizeListItemTextNodes(pageNodes, page.childOrder);
        normalizeBottomNavTextNodes(pageNodes);
      }
      pageNodes = ensureRootFrameVisible(pageNodes, page.childOrder);
      enforceManualScreenFrames(pageNodes, page.childOrder);
      pages[pageId] = { ...page, nodes: pageNodes };
    }
    next = { ...next, pages };
    next = syncPagesWithCanvas(next);
  }

  return next;
}
