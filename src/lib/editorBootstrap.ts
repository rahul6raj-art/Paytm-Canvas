import { readLocalDocument, documentToEditorPatch } from "@/lib/documentPersistence";
import { initialPagesFromCanvas, createEmptyPage } from "@/lib/editorPages";
import { ROOT } from "@/lib/editorPages";
import { DEFAULT_CANVAS_ZOOM } from "@/lib/canvasZoom";
import type { EditorPersistSlice } from "@/lib/documentPersistence";

/** Document fields used to seed the editor store on first client init. */
export type InitialDocumentFields = Pick<
  EditorPersistSlice,
  | "nodes"
  | "childOrder"
  | "pages"
  | "pageOrder"
  | "activePageId"
  | "activeSubPageId"
  | "zoom"
  | "pan"
  | "showGrid"
  | "showRulers"
  | "canvasBackgroundColor"
  | "canvasColorMode"
  | "selectedIds"
  | "assets"
  | "fontAssets"
  | "designTokens"
  | "fileName"
  | "comments"
  | "codeRoundTripLink"
>;

export function readInitialDocumentFields(): InitialDocumentFields | null {
  if (typeof window === "undefined") return null;
  const doc = readLocalDocument();
  if (!doc) return null;
  return documentToEditorPatch(doc);
}

export function createEmptyDocumentFields(): InitialDocumentFields {
  const pageId = `page-${Date.now()}`;
  const page = createEmptyPage(pageId, "Page 1");
  return {
    nodes: page.nodes,
    childOrder: page.childOrder,
    pages: { [pageId]: page },
    pageOrder: [pageId],
    activePageId: pageId,
    activeSubPageId: page.activeSubPageId ?? `${pageId}-sp-1`,
    zoom: page.zoom,
    pan: page.pan,
    showGrid: page.showGrid,
    showRulers: page.showRulers,
    canvasBackgroundColor: page.canvasBackgroundColor,
    canvasColorMode: "light",
    selectedIds: [],
    assets: {},
    fontAssets: {},
    designTokens: {},
    fileName: "Untitled",
    comments: [],
    codeRoundTripLink: null,
  };
}

export function mergeSampleDocumentFields(
  mock: Pick<InitialDocumentFields, "nodes" | "childOrder">,
  fileName: string,
): InitialDocumentFields {
  const pageInit = initialPagesFromCanvas(mock.nodes, mock.childOrder, {
    zoom: DEFAULT_CANVAS_ZOOM,
    pan: { x: 40, y: 24 },
    showGrid: false,
  });
  const activeId = pageInit.activePageId;
  const active = pageInit.pages[activeId]!;
  return {
    nodes: active.nodes,
    childOrder: active.childOrder,
    pages: pageInit.pages,
    pageOrder: pageInit.pageOrder,
    activePageId: activeId,
    activeSubPageId: pageInit.activeSubPageId ?? active.activeSubPageId ?? `${activeId}-sp-1`,
    zoom: active.zoom,
    pan: active.pan,
    showGrid: active.showGrid,
    showRulers: active.showRulers,
    canvasBackgroundColor: active.canvasBackgroundColor,
    canvasColorMode: "light",
    selectedIds: [],
    assets: {},
    fontAssets: {},
    designTokens: {},
    fileName,
    comments: [],
    codeRoundTripLink: null,
  };
}

/** Empty canvases always start with the layout grid hidden. */
export function preferLayoutGridOffWhenEmpty<T extends InitialDocumentFields>(fields: T): T {
  if (!isWorkspaceEmpty(fields)) return fields;
  const { activePageId, pages } = fields;
  const active = pages[activePageId];
  if (!active) return { ...fields, showGrid: false };
  return {
    ...fields,
    showGrid: false,
    pages: { ...pages, [activePageId]: { ...active, showGrid: false } },
  };
}

/** True when the canvas has no root-level content (safe to replace with the sample doc). */
export function isWorkspaceEmpty(fields: Pick<InitialDocumentFields, "childOrder">): boolean {
  return (fields.childOrder[ROOT] ?? []).length === 0;
}
