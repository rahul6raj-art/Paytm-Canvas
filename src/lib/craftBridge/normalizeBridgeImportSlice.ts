import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorPersistSlice } from "@/lib/documentPersistence";
import { wrapPersistSliceWithPages } from "@/lib/documentPersistence";
import { editorPatchFromPage } from "@/lib/editorPages";
import { repairNodeHierarchyIfNeeded } from "@/lib/editorGraph";
import { prepareImportedSliceForCanvas } from "@/lib/prepareImportedSliceForCanvas";

function sliceHasPages(slice: EditorPersistSlice): boolean {
  return Boolean(
    slice.pages &&
      slice.pageOrder?.length &&
      slice.activePageId &&
      slice.pages[slice.activePageId],
  );
}

function hydrateSliceCanvasFromActivePage(slice: EditorPersistSlice): EditorPersistSlice {
  const roots = slice.childOrder[EDITOR_ROOT_KEY] ?? [];
  if (roots.length > 0 && Object.keys(slice.nodes).length > 0) return slice;

  const active = slice.pages?.[slice.activePageId ?? ""];
  if (!active) return slice;

  const pageRoots = active.childOrder[EDITOR_ROOT_KEY] ?? [];
  if (pageRoots.length === 0 && Object.keys(active.nodes).length === 0) return slice;

  return {
    ...slice,
    ...editorPatchFromPage(active),
  };
}

/** Repair bridge pending slices before applying to the canvas store. */
export function normalizeBridgeImportSlice(slice: EditorPersistSlice): EditorPersistSlice {
  let next = hydrateSliceCanvasFromActivePage(slice);
  const repaired = repairNodeHierarchyIfNeeded(next.nodes, next.childOrder);
  next = {
    ...next,
    nodes: repaired.nodes,
    childOrder: repaired.childOrder,
  };

  const roots = next.childOrder[EDITOR_ROOT_KEY] ?? [];
  if (!sliceHasPages(next) || roots.length === 0) {
    next = wrapPersistSliceWithPages({
      nodes: next.nodes,
      childOrder: next.childOrder,
      assets: next.assets ?? {},
      designTokens: next.designTokens ?? {},
      fileName: next.fileName || "Imported screen",
      selectedIds: roots.length ? roots : next.selectedIds,
      zoom: next.zoom ?? 1,
      pan: next.pan ?? { x: 0, y: 0 },
      showGrid: next.showGrid ?? false,
      showRulers: next.showRulers ?? false,
      canvasBackgroundColor: next.canvasBackgroundColor ?? "#e5e5e5",
      comments: next.comments ?? [],
      codeRoundTripLink: next.codeRoundTripLink,
    });
  }

  return prepareImportedSliceForCanvas(next, { preserveCaptureGeometry: true });
}
