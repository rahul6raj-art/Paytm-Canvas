import type { EditorComment } from "@/lib/comments";
import { parseCommentsArray } from "@/lib/comments";
import type { DesignToken } from "@/lib/designTokens";
import {
  captureActivePage,
  createEmptyPage,
  initialPagesFromCanvas,
  pageFromSnapshot,
  pageToSnapshot,
  pagesFromDocumentSnapshots,
  type EditorPage,
  type EditorPageSnapshot,
} from "@/lib/editorPages";
import { DEFAULT_CANVAS_BACKGROUND } from "@/lib/canvasVisual";
import { repairNodeHierarchyIfNeeded } from "@/lib/editorGraph";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode, LayoutGuide } from "@/stores/useEditorStore";

export type { EditorPage, EditorPageSnapshot };

export const PAYTM_CRAFT_DOCUMENT_STORAGE_KEY = "paytm-craft-document-v1";

export interface EditorAsset {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  createdAt: string;
  width?: number;
  height?: number;
}

export interface PaytmCraftDocument {
  version: 1;
  name: string;
  savedAt: string;
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  /** Multi-page documents (Figma-style). Legacy files omit this. */
  pages?: EditorPageSnapshot[];
  activePageId?: string;
  /** Embedded library images (data URLs). */
  assets?: Record<string, EditorAsset>;
  /** Reusable color, typography, spacing, and effect styles. */
  designTokens?: Record<string, DesignToken>;
  selectedIds?: string[];
  comments?: EditorComment[];
  canvas?: {
    zoom: number;
    panX: number;
    panY: number;
    showGrid: boolean;
    showRulers?: boolean;
    backgroundColor?: string;
  };
}

export interface EditorPersistSlice {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  assets: Record<string, EditorAsset>;
  designTokens: Record<string, DesignToken>;
  fileName: string;
  selectedIds: string[];
  zoom: number;
  pan: { x: number; y: number };
  showGrid: boolean;
  showRulers: boolean;
  canvasBackgroundColor: string;
  comments: EditorComment[];
  pages: Record<string, EditorPage>;
  pageOrder: string[];
  activePageId: string;
  /** Active page layout guides (mirrored from `pages[activePageId]`). */
  layoutGuides?: LayoutGuide[];
}

export function wrapPersistSliceWithPages(
  slice: Omit<EditorPersistSlice, "pages" | "pageOrder" | "activePageId">,
): EditorPersistSlice {
  const pageMeta = initialPagesFromCanvas(slice.nodes, slice.childOrder, {
    zoom: slice.zoom,
    pan: slice.pan,
    showGrid: slice.showGrid,
    showRulers: slice.showRulers,
    canvasBackgroundColor: slice.canvasBackgroundColor,
  });
  const page: EditorPage = {
    ...pageMeta.pages[pageMeta.activePageId]!,
    selectedIds: slice.selectedIds,
  };
  return {
    ...slice,
    pages: { ...pageMeta.pages, [pageMeta.activePageId]: page },
    pageOrder: pageMeta.pageOrder,
    activePageId: pageMeta.activePageId,
  };
}

function sliceWithCapturedActivePage(slice: EditorPersistSlice): EditorPersistSlice {
  const active = captureActivePage({
    activePageId: slice.activePageId,
    pages: slice.pages,
    pageOrder: slice.pageOrder,
    nodes: slice.nodes,
    childOrder: slice.childOrder,
    zoom: slice.zoom,
    pan: slice.pan,
    showGrid: slice.showGrid,
    showRulers: slice.showRulers,
    canvasBackgroundColor: slice.canvasBackgroundColor,
    selectedIds: slice.selectedIds,
    layoutGuides: slice.layoutGuides ?? slice.pages[slice.activePageId]?.layoutGuides ?? [],
  });
  return {
    ...slice,
    pages: { ...slice.pages, [slice.activePageId]: active },
  };
}

export function serializePersistStable(slice: EditorPersistSlice): string {
  const synced = sliceWithCapturedActivePage(slice);
  return JSON.stringify({
    name: synced.fileName,
    pages: synced.pageOrder.map((id) => pageToSnapshot(synced.pages[id]!)),
    activePageId: synced.activePageId,
    nodes: synced.nodes,
    childOrder: synced.childOrder,
    assets: synced.assets,
    designTokens: synced.designTokens,
    selectedIds: synced.selectedIds,
    zoom: synced.zoom,
    pan: synced.pan,
    showGrid: synced.showGrid,
    showRulers: synced.showRulers,
    canvasBackgroundColor: synced.canvasBackgroundColor,
    comments: synced.comments,
  });
}

export function editorStateToDocument(slice: EditorPersistSlice): PaytmCraftDocument {
  const synced = sliceWithCapturedActivePage(slice);
  const active = synced.pages[synced.activePageId]!;
  return {
    version: 1,
    name: synced.fileName,
    savedAt: new Date().toISOString(),
    nodes: active.nodes,
    childOrder: active.childOrder,
    pages: synced.pageOrder.map((id) => pageToSnapshot(synced.pages[id]!)),
    activePageId: synced.activePageId,
    assets: synced.assets,
    designTokens: synced.designTokens,
    selectedIds: active.selectedIds,
    comments: synced.comments,
    canvas: {
      zoom: active.zoom,
      panX: active.pan.x,
      panY: active.pan.y,
      showGrid: active.showGrid,
      showRulers: active.showRulers,
      backgroundColor: active.canvasBackgroundColor,
    },
  };
}

export function documentToEditorPatch(doc: PaytmCraftDocument): EditorPersistSlice {
  const base = {
    assets: doc.assets ?? {},
    designTokens: doc.designTokens ?? {},
    fileName: doc.name,
    comments: parseCommentsArray(doc.comments),
  };

  if (doc.pages && doc.pages.length > 0) {
    const { pages, pageOrder, activePageId, activePage } = pagesFromDocumentSnapshots(
      doc.pages,
      doc.activePageId,
    );
    return {
      ...base,
      pages,
      pageOrder,
      activePageId,
      nodes: activePage.nodes,
      childOrder: activePage.childOrder,
      selectedIds: activePage.selectedIds,
      zoom: activePage.zoom,
      pan: activePage.pan,
      showGrid: activePage.showGrid,
      showRulers: activePage.showRulers,
      canvasBackgroundColor: activePage.canvasBackgroundColor,
      layoutGuides: activePage.layoutGuides ?? [],
    };
  }

  const repaired = repairNodeHierarchyIfNeeded(doc.nodes, doc.childOrder);
  const pageMeta = initialPagesFromCanvas(repaired.nodes, repaired.childOrder, {
    zoom: doc.canvas?.zoom ?? 0.55,
    pan: { x: doc.canvas?.panX ?? 40, y: doc.canvas?.panY ?? 24 },
    showGrid: doc.canvas?.showGrid ?? true,
    showRulers: doc.canvas?.showRulers ?? true,
    canvasBackgroundColor: doc.canvas?.backgroundColor ?? DEFAULT_CANVAS_BACKGROUND,
  });
  const legacyPage: EditorPage = {
    ...pageMeta.pages[pageMeta.activePageId]!,
    selectedIds: doc.selectedIds ?? [],
  };
  return {
    ...base,
    pages: { ...pageMeta.pages, [pageMeta.activePageId]: legacyPage },
    pageOrder: pageMeta.pageOrder,
    activePageId: pageMeta.activePageId,
    nodes: repaired.nodes,
    childOrder: repaired.childOrder,
    selectedIds: doc.selectedIds ?? [],
    zoom: doc.canvas?.zoom ?? 0.55,
    pan: { x: doc.canvas?.panX ?? 40, y: doc.canvas?.panY ?? 24 },
    showGrid: doc.canvas?.showGrid ?? true,
    showRulers: doc.canvas?.showRulers ?? true,
    canvasBackgroundColor: doc.canvas?.backgroundColor ?? DEFAULT_CANVAS_BACKGROUND,
    layoutGuides: legacyPage.layoutGuides ?? [],
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function validatePaytmCraftDocument(v: unknown): v is PaytmCraftDocument {
  if (!isRecord(v)) return false;
  if (v.version !== 1) return false;
  if (typeof v.name !== "string" || v.name.length === 0) return false;
  if (typeof v.savedAt !== "string") return false;
  if (!isRecord(v.nodes)) return false;
  if (!isRecord(v.childOrder)) return false;
  for (const k of Object.keys(v.childOrder)) {
    if (!Array.isArray((v.childOrder as Record<string, unknown>)[k])) return false;
  }
  if (v.selectedIds !== undefined && !Array.isArray(v.selectedIds)) return false;
  if (v.selectedIds !== undefined && !(v.selectedIds as unknown[]).every((x) => typeof x === "string")) return false;
  if (v.canvas !== undefined) {
    if (!isRecord(v.canvas)) return false;
    const c = v.canvas;
    if (typeof c.zoom !== "number") return false;
    if (typeof c.panX !== "number") return false;
    if (typeof c.panY !== "number") return false;
    if (typeof c.showGrid !== "boolean") return false;
    if (c.backgroundColor !== undefined && typeof c.backgroundColor !== "string") return false;
  }
  if (v.pages !== undefined) {
    if (!Array.isArray(v.pages)) return false;
    for (const p of v.pages) {
      if (!isRecord(p)) return false;
      if (typeof p.id !== "string" || typeof p.name !== "string") return false;
      if (!isRecord(p.nodes) || !isRecord(p.childOrder)) return false;
    }
  }
  if (v.activePageId !== undefined && typeof v.activePageId !== "string") return false;
  if (v.assets !== undefined) {
    if (!isRecord(v.assets)) return false;
    for (const [ak, av] of Object.entries(v.assets)) {
      if (typeof ak !== "string" || ak.length === 0) return false;
      if (!isRecord(av)) return false;
      const a = av as Record<string, unknown>;
      if (typeof a.id !== "string") return false;
      if (typeof a.name !== "string") return false;
      if (typeof a.mimeType !== "string") return false;
      if (typeof a.dataUrl !== "string" || !a.dataUrl.startsWith("data:")) return false;
      if (typeof a.createdAt !== "string") return false;
      if (a.width !== undefined && typeof a.width !== "number") return false;
      if (a.height !== undefined && typeof a.height !== "number") return false;
    }
  }
  if (v.designTokens !== undefined) {
    if (!isRecord(v.designTokens)) return false;
    const TOKEN_TYPES = new Set(["color", "gradient", "typography", "spacing", "effect"]);
    for (const [tk, tv] of Object.entries(v.designTokens)) {
      if (typeof tk !== "string" || tk.length === 0) return false;
      if (!isRecord(tv)) return false;
      const t = tv as Record<string, unknown>;
      if (typeof t.id !== "string") return false;
      if (typeof t.name !== "string") return false;
      if (typeof t.type !== "string" || !TOKEN_TYPES.has(t.type)) return false;
      if (typeof t.createdAt !== "string") return false;
      if (typeof t.updatedAt !== "string") return false;
    }
  }
  return true;
}

export function parsePaytmCraftDocumentJson(raw: string): PaytmCraftDocument | null {
  try {
    const v = JSON.parse(raw) as unknown;
    if (!validatePaytmCraftDocument(v)) return null;
    return v;
  } catch {
    return null;
  }
}

export function readLocalDocument(): PaytmCraftDocument | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PAYTM_CRAFT_DOCUMENT_STORAGE_KEY);
    if (!raw) return null;
    return parsePaytmCraftDocumentJson(raw);
  } catch {
    return null;
  }
}

export function clearLocalDocument(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PAYTM_CRAFT_DOCUMENT_STORAGE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Fig/import glitches can leave thousands of nodes with an empty canvas root — loading that freezes the editor. */
export function isBrokenOrphanedLocalDocument(doc: PaytmCraftDocument): boolean {
  const activeSnap =
    doc.pages?.find((p) => p.id === doc.activePageId) ?? doc.pages?.[0];
  const nodes = activeSnap?.nodes ?? doc.nodes;
  const childOrder = activeSnap?.childOrder ?? doc.childOrder;
  const rootCount = (childOrder[EDITOR_ROOT_KEY] ?? []).length;
  const nodeCount = Object.keys(nodes).length;
  return nodeCount > 400 && rootCount === 0;
}

export function writeLocalDocument(doc: PaytmCraftDocument): void {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(doc);
  window.localStorage.setItem(PAYTM_CRAFT_DOCUMENT_STORAGE_KEY, json);
}

export function downloadJsonFile(filename: string, data: unknown): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function sanitizeDocumentFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").trim() || "Untitled";
}
