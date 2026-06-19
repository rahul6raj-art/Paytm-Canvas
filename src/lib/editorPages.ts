import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { DEFAULT_CANVAS_BACKGROUND } from "@/lib/canvasVisual";
import { DEFAULT_CANVAS_ZOOM } from "@/lib/canvasZoom";
import type { EditorNode, LayoutGuide } from "@/stores/useEditorStore";

export const ROOT = EDITOR_ROOT_KEY;

export interface EditorSubPage {
  id: string;
  name: string;
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  zoom: number;
  pan: { x: number; y: number };
  showGrid: boolean;
  showRulers: boolean;
  canvasBackgroundColor: string;
  selectedIds: string[];
  layoutGuides: LayoutGuide[];
}

export interface EditorPage {
  id: string;
  name: string;
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  zoom: number;
  pan: { x: number; y: number };
  showGrid: boolean;
  showRulers: boolean;
  canvasBackgroundColor: string;
  selectedIds: string[];
  layoutGuides: LayoutGuide[];
  /** Canvas screens within this master page (sidebar Pages list). */
  subPages?: Record<string, EditorSubPage>;
  subPageOrder?: string[];
  activeSubPageId?: string;
}

export interface EditorSubPageSnapshot {
  id: string;
  name: string;
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  selectedIds?: string[];
  layoutGuides?: LayoutGuide[];
  canvas?: {
    zoom: number;
    panX: number;
    panY: number;
    showGrid: boolean;
    showRulers?: boolean;
    backgroundColor?: string;
  };
}

export interface EditorPageSnapshot {
  id: string;
  name: string;
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  selectedIds?: string[];
  layoutGuides?: LayoutGuide[];
  subPages?: EditorSubPageSnapshot[];
  activeSubPageId?: string;
  canvas?: {
    zoom: number;
    panX: number;
    panY: number;
    showGrid: boolean;
    showRulers?: boolean;
    backgroundColor?: string;
  };
}

type CanvasPatch = Pick<
  ActivePageSlice,
  | "nodes"
  | "childOrder"
  | "zoom"
  | "pan"
  | "showGrid"
  | "showRulers"
  | "canvasBackgroundColor"
  | "selectedIds"
  | "layoutGuides"
>;

type ActivePageSlice = {
  activePageId: string;
  activeSubPageId?: string;
  pages: Record<string, EditorPage>;
  pageOrder: string[];
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  zoom: number;
  pan: { x: number; y: number };
  showGrid: boolean;
  showRulers: boolean;
  canvasBackgroundColor: string;
  selectedIds: string[];
  layoutGuides: LayoutGuide[];
};

function canvasFieldsFromSub(sub: EditorSubPage): CanvasPatch {
  return {
    nodes: sub.nodes,
    childOrder: sub.childOrder,
    zoom: sub.zoom,
    pan: sub.pan,
    showGrid: sub.showGrid,
    showRulers: sub.showRulers,
    canvasBackgroundColor: sub.canvasBackgroundColor,
    selectedIds: sub.selectedIds,
    layoutGuides: sub.layoutGuides ?? [],
  };
}

function mirrorSubToPageRoot(page: EditorPage, sub: EditorSubPage): EditorPage {
  return {
    ...page,
    ...canvasFieldsFromSub(sub),
    subPages: page.subPages,
    subPageOrder: page.subPageOrder,
    activeSubPageId: sub.id,
  };
}

export function createEmptySubPage(id: string, name: string): EditorSubPage {
  return {
    id,
    name,
    nodes: {},
    childOrder: { [EDITOR_ROOT_KEY]: [] },
    zoom: DEFAULT_CANVAS_ZOOM,
    pan: { x: 40, y: 24 },
    showGrid: false,
    showRulers: false,
    canvasBackgroundColor: DEFAULT_CANVAS_BACKGROUND,
    selectedIds: [],
    layoutGuides: [],
  };
}

export function ensurePageHasSubPages(page: EditorPage): EditorPage {
  if (page.subPageOrder?.length && page.subPages && page.activeSubPageId) {
    const activeSub = page.subPages[page.activeSubPageId];
    if (activeSub) return mirrorSubToPageRoot(page, activeSub);
  }

  const subId = `${page.id}-sp-1`;
  const sub = createEmptySubPage(subId, "Page 1");
  sub.nodes = page.nodes;
  sub.childOrder = page.childOrder;
  sub.zoom = page.zoom;
  sub.pan = { ...page.pan };
  sub.showGrid = page.showGrid;
  sub.showRulers = page.showRulers;
  sub.canvasBackgroundColor = page.canvasBackgroundColor;
  sub.selectedIds = page.selectedIds;
  sub.layoutGuides = page.layoutGuides ?? [];

  return {
    ...page,
    subPages: { [subId]: sub },
    subPageOrder: [subId],
    activeSubPageId: subId,
    ...canvasFieldsFromSub(sub),
  };
}

export function resolveActiveSubPage(page: EditorPage, activeSubPageId?: string): EditorSubPage {
  const ensured = ensurePageHasSubPages(page);
  const subId = activeSubPageId ?? ensured.activeSubPageId ?? ensured.subPageOrder?.[0];
  if (!subId) {
    return createEmptySubPage(`${page.id}-sp-fallback`, "Page 1");
  }
  return ensured.subPages?.[subId] ?? createEmptySubPage(subId, "Page 1");
}

export function captureActivePage(state: ActivePageSlice): EditorPage {
  const existing = state.pages[state.activePageId];
  const base = existing
    ? ensurePageHasSubPages(existing)
    : createEmptyPage(state.activePageId, "Page 1");
  const subId = state.activeSubPageId ?? base.activeSubPageId ?? base.subPageOrder?.[0];
  if (!subId) return base;

  const updatedSub: EditorSubPage = {
    id: subId,
    name: base.subPages?.[subId]?.name ?? "Page 1",
    nodes: state.nodes,
    childOrder: state.childOrder,
    zoom: state.zoom,
    pan: state.pan,
    showGrid: state.showGrid,
    showRulers: state.showRulers,
    canvasBackgroundColor: state.canvasBackgroundColor,
    selectedIds: state.selectedIds,
    layoutGuides: state.layoutGuides,
  };

  return mirrorSubToPageRoot(
    {
      ...base,
      id: state.activePageId,
      name: existing?.name ?? base.name,
      subPages: { ...base.subPages, [subId]: updatedSub },
      subPageOrder: base.subPageOrder ?? [subId],
    },
    updatedSub,
  );
}

export function pagesWithActiveCaptured(state: ActivePageSlice): {
  pages: Record<string, EditorPage>;
  pageOrder: string[];
} {
  const active = captureActivePage(state);
  return {
    pages: { ...state.pages, [state.activePageId]: active },
    pageOrder: state.pageOrder,
  };
}

export function editorPatchFromPage(page: EditorPage): CanvasPatch {
  const sub = resolveActiveSubPage(page, page.activeSubPageId);
  return canvasFieldsFromSub(sub);
}

export function editorPatchFromSubPage(sub: EditorSubPage): CanvasPatch {
  return canvasFieldsFromSub(sub);
}

export function createEmptyPage(id: string, name: string): EditorPage {
  const sub = createEmptySubPage(`${id}-sp-1`, "Page 1");
  return mirrorSubToPageRoot(
    {
      id,
      name,
      subPages: { [sub.id]: sub },
      subPageOrder: [sub.id],
      activeSubPageId: sub.id,
      nodes: {},
      childOrder: { [EDITOR_ROOT_KEY]: [] },
      zoom: DEFAULT_CANVAS_ZOOM,
      pan: { x: 40, y: 24 },
      showGrid: false,
      showRulers: false,
      canvasBackgroundColor: DEFAULT_CANVAS_BACKGROUND,
      selectedIds: [],
      layoutGuides: [],
    },
    sub,
  );
}

export function nextPageName(pages: Record<string, EditorPage>, pageOrder: string[]): string {
  const used = new Set(pageOrder.map((id) => pages[id]?.name).filter(Boolean));
  let n = pageOrder.length + 1;
  let candidate = `Page ${n}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `Page ${n}`;
  }
  return candidate;
}

export function nextSubPageName(
  subPages: Record<string, EditorSubPage>,
  subPageOrder: string[],
): string {
  const used = new Set(subPageOrder.map((id) => subPages[id]?.name).filter(Boolean));
  let n = subPageOrder.length + 1;
  let candidate = `Page ${n}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `Page ${n}`;
  }
  return candidate;
}

function subPageToSnapshot(sub: EditorSubPage): EditorSubPageSnapshot {
  return {
    id: sub.id,
    name: sub.name,
    nodes: sub.nodes,
    childOrder: sub.childOrder,
    selectedIds: sub.selectedIds,
    layoutGuides: sub.layoutGuides?.length ? sub.layoutGuides : undefined,
    canvas: {
      zoom: sub.zoom,
      panX: sub.pan.x,
      panY: sub.pan.y,
      showGrid: sub.showGrid,
      showRulers: sub.showRulers,
      backgroundColor: sub.canvasBackgroundColor,
    },
  };
}

export function pageToSnapshot(page: EditorPage): EditorPageSnapshot {
  const ensured = ensurePageHasSubPages(page);
  const activeSub = resolveActiveSubPage(ensured, ensured.activeSubPageId);
  const subPages =
    ensured.subPageOrder?.map((id) => ensured.subPages?.[id]).filter(Boolean) ?? [];
  return {
    id: ensured.id,
    name: ensured.name,
    nodes: activeSub.nodes,
    childOrder: activeSub.childOrder,
    selectedIds: activeSub.selectedIds,
    layoutGuides: activeSub.layoutGuides?.length ? activeSub.layoutGuides : undefined,
    subPages: subPages.length > 0 ? subPages.map((sub) => subPageToSnapshot(sub!)) : undefined,
    activeSubPageId: ensured.activeSubPageId,
    canvas: {
      zoom: activeSub.zoom,
      panX: activeSub.pan.x,
      panY: activeSub.pan.y,
      showGrid: activeSub.showGrid,
      showRulers: activeSub.showRulers,
      backgroundColor: activeSub.canvasBackgroundColor,
    },
  };
}

export type PageFromSnapshotOptions = {
  /** Skip expensive geometry repair (Figma import already ran light reconcile). */
  skipHierarchyRepair?: boolean;
};

function repairPageHierarchy(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]> } {
  // Lazy load breaks editorPages ↔ editorGraph ↔ useEditorStore circular import at module init.
  const { repairNodeHierarchyIfNeeded } = require("@/lib/editorGraph") as typeof import("@/lib/editorGraph");
  return repairNodeHierarchyIfNeeded(nodes, childOrder);
}

function subPageFromSnapshot(
  snap: EditorSubPageSnapshot,
  opts?: PageFromSnapshotOptions,
): EditorSubPage {
  const repaired = opts?.skipHierarchyRepair
    ? { nodes: snap.nodes, childOrder: snap.childOrder }
    : repairPageHierarchy(snap.nodes, snap.childOrder);
  return {
    id: snap.id,
    name: snap.name,
    nodes: repaired.nodes,
    childOrder: repaired.childOrder,
    selectedIds: snap.selectedIds ?? [],
    zoom: snap.canvas?.zoom ?? DEFAULT_CANVAS_ZOOM,
    pan: { x: snap.canvas?.panX ?? 40, y: snap.canvas?.panY ?? 24 },
    showGrid: snap.canvas?.showGrid ?? false,
    showRulers: snap.canvas?.showRulers ?? false,
    canvasBackgroundColor: snap.canvas?.backgroundColor ?? DEFAULT_CANVAS_BACKGROUND,
    layoutGuides: snap.layoutGuides ?? [],
  };
}

export function pageFromSnapshot(
  snap: EditorPageSnapshot,
  opts?: PageFromSnapshotOptions,
): EditorPage {
  if (snap.subPages && snap.subPages.length > 0) {
    const subPages: Record<string, EditorSubPage> = {};
    for (const subSnap of snap.subPages) {
      subPages[subSnap.id] = subPageFromSnapshot(subSnap, opts);
    }
    const subPageOrder = snap.subPages.map((s) => s.id);
    const activeSubPageId =
      snap.activeSubPageId && subPages[snap.activeSubPageId]
        ? snap.activeSubPageId
        : subPageOrder[0]!;
    const activeSub = subPages[activeSubPageId]!;
    return mirrorSubToPageRoot(
      {
        id: snap.id,
        name: snap.name,
        subPages,
        subPageOrder,
        activeSubPageId,
        nodes: {},
        childOrder: { [EDITOR_ROOT_KEY]: [] },
        zoom: activeSub.zoom,
        pan: activeSub.pan,
        showGrid: activeSub.showGrid,
        showRulers: activeSub.showRulers,
        canvasBackgroundColor: activeSub.canvasBackgroundColor,
        selectedIds: activeSub.selectedIds,
        layoutGuides: activeSub.layoutGuides,
      },
      activeSub,
    );
  }

  const repaired = opts?.skipHierarchyRepair
    ? { nodes: snap.nodes, childOrder: snap.childOrder }
    : repairPageHierarchy(snap.nodes, snap.childOrder);
  const legacyPage: EditorPage = {
    id: snap.id,
    name: snap.name,
    nodes: repaired.nodes,
    childOrder: repaired.childOrder,
    selectedIds: snap.selectedIds ?? [],
    zoom: snap.canvas?.zoom ?? DEFAULT_CANVAS_ZOOM,
    pan: { x: snap.canvas?.panX ?? 40, y: snap.canvas?.panY ?? 24 },
    showGrid: snap.canvas?.showGrid ?? false,
    showRulers: snap.canvas?.showRulers ?? false,
    canvasBackgroundColor: snap.canvas?.backgroundColor ?? DEFAULT_CANVAS_BACKGROUND,
    layoutGuides: snap.layoutGuides ?? [],
  };
  return ensurePageHasSubPages(legacyPage);
}

export function initialPagesFromCanvas(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  opts?: {
    zoom?: number;
    pan?: { x: number; y: number };
    showGrid?: boolean;
    showRulers?: boolean;
    canvasBackgroundColor?: string;
  },
): {
  pages: Record<string, EditorPage>;
  pageOrder: string[];
  activePageId: string;
  activeSubPageId: string;
} {
  const id = `page-${Date.now()}`;
  const subId = `${id}-sp-1`;
  const sub: EditorSubPage = {
    ...createEmptySubPage(subId, "Page 1"),
    nodes,
    childOrder,
    zoom: opts?.zoom ?? DEFAULT_CANVAS_ZOOM,
    pan: opts?.pan ?? { x: 40, y: 24 },
    showGrid: opts?.showGrid ?? false,
    showRulers: opts?.showRulers ?? false,
    canvasBackgroundColor: opts?.canvasBackgroundColor ?? DEFAULT_CANVAS_BACKGROUND,
  };
  const page = mirrorSubToPageRoot(
    {
      id,
      name: "Page 1",
      subPages: { [subId]: sub },
      subPageOrder: [subId],
      activeSubPageId: subId,
      nodes,
      childOrder,
      zoom: sub.zoom,
      pan: sub.pan,
      showGrid: sub.showGrid,
      showRulers: sub.showRulers,
      canvasBackgroundColor: sub.canvasBackgroundColor,
      selectedIds: [],
      layoutGuides: [],
    },
    sub,
  );
  return {
    pages: { [id]: page },
    pageOrder: [id],
    activePageId: id,
    activeSubPageId: subId,
  };
}

export function pagesFromDocumentSnapshots(
  snapshots: EditorPageSnapshot[],
  activePageId?: string,
  opts?: PageFromSnapshotOptions,
): {
  pages: Record<string, EditorPage>;
  pageOrder: string[];
  activePageId: string;
  activeSubPageId: string;
  activePage: EditorPage;
} {
  const pages: Record<string, EditorPage> = {};
  for (const snap of snapshots) {
    pages[snap.id] = pageFromSnapshot(snap, opts);
  }
  const pageOrder = snapshots.map((s) => s.id);
  const activeId =
    activePageId && pages[activePageId] ? activePageId : pageOrder[0] ?? `page-${Date.now()}`;
  if (!pages[activeId]) {
    const empty = createEmptyPage(activeId, "Page 1");
    pages[activeId] = empty;
    if (!pageOrder.includes(activeId)) pageOrder.push(activeId);
  }
  const activePage = ensurePageHasSubPages(pages[activeId]!);
  pages[activeId] = activePage;
  return {
    pages,
    pageOrder,
    activePageId: activeId,
    activeSubPageId: activePage.activeSubPageId ?? activePage.subPageOrder?.[0] ?? `${activeId}-sp-1`,
    activePage,
  };
}
