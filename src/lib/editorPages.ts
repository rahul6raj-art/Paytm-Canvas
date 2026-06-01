import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { DEFAULT_CANVAS_BACKGROUND } from "@/lib/canvasVisual";
import type { EditorNode } from "@/stores/useEditorStore";

export const ROOT = EDITOR_ROOT_KEY;

export interface EditorPage {
  id: string;
  name: string;
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  zoom: number;
  pan: { x: number; y: number };
  showGrid: boolean;
  canvasBackgroundColor: string;
  selectedIds: string[];
}

export interface EditorPageSnapshot {
  id: string;
  name: string;
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  selectedIds?: string[];
  canvas?: {
    zoom: number;
    panX: number;
    panY: number;
    showGrid: boolean;
    backgroundColor?: string;
  };
}

type ActivePageSlice = {
  activePageId: string;
  pages: Record<string, EditorPage>;
  pageOrder: string[];
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  zoom: number;
  pan: { x: number; y: number };
  showGrid: boolean;
  canvasBackgroundColor: string;
  selectedIds: string[];
};

export function captureActivePage(state: ActivePageSlice): EditorPage {
  const existing = state.pages[state.activePageId];
  return {
    id: state.activePageId,
    name: existing?.name ?? "Page 1",
    nodes: state.nodes,
    childOrder: state.childOrder,
    zoom: state.zoom,
    pan: state.pan,
    showGrid: state.showGrid,
    canvasBackgroundColor: state.canvasBackgroundColor,
    selectedIds: state.selectedIds,
  };
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

export function editorPatchFromPage(page: EditorPage): Pick<
  ActivePageSlice,
  "nodes" | "childOrder" | "zoom" | "pan" | "showGrid" | "canvasBackgroundColor" | "selectedIds"
> {
  return {
    nodes: page.nodes,
    childOrder: page.childOrder,
    zoom: page.zoom,
    pan: page.pan,
    showGrid: page.showGrid,
    canvasBackgroundColor: page.canvasBackgroundColor,
    selectedIds: page.selectedIds,
  };
}

export function createEmptyPage(id: string, name: string): EditorPage {
  return {
    id,
    name,
    nodes: {},
    childOrder: { [ROOT]: [] },
    zoom: 0.55,
    pan: { x: 40, y: 24 },
    showGrid: false,
    canvasBackgroundColor: DEFAULT_CANVAS_BACKGROUND,
    selectedIds: [],
  };
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

export function pageToSnapshot(page: EditorPage): EditorPageSnapshot {
  return {
    id: page.id,
    name: page.name,
    nodes: page.nodes,
    childOrder: page.childOrder,
    selectedIds: page.selectedIds,
    canvas: {
      zoom: page.zoom,
      panX: page.pan.x,
      panY: page.pan.y,
      showGrid: page.showGrid,
      backgroundColor: page.canvasBackgroundColor,
    },
  };
}

export function pageFromSnapshot(snap: EditorPageSnapshot): EditorPage {
  return {
    id: snap.id,
    name: snap.name,
    nodes: snap.nodes,
    childOrder: snap.childOrder,
    selectedIds: snap.selectedIds ?? [],
    zoom: snap.canvas?.zoom ?? 0.55,
    pan: { x: snap.canvas?.panX ?? 40, y: snap.canvas?.panY ?? 24 },
    showGrid: snap.canvas?.showGrid ?? false,
    canvasBackgroundColor: snap.canvas?.backgroundColor ?? DEFAULT_CANVAS_BACKGROUND,
  };
}

export function initialPagesFromCanvas(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  opts?: {
    zoom?: number;
    pan?: { x: number; y: number };
    showGrid?: boolean;
    canvasBackgroundColor?: string;
  },
): Pick<ActivePageSlice, "pages" | "pageOrder" | "activePageId"> {
  const id = `page-${Date.now()}`;
  const page: EditorPage = {
    id,
    name: "Page 1",
    nodes,
    childOrder,
    zoom: opts?.zoom ?? 0.55,
    pan: opts?.pan ?? { x: 40, y: 24 },
    showGrid: opts?.showGrid ?? false,
    canvasBackgroundColor: opts?.canvasBackgroundColor ?? DEFAULT_CANVAS_BACKGROUND,
    selectedIds: [],
  };
  return {
    pages: { [id]: page },
    pageOrder: [id],
    activePageId: id,
  };
}

export function pagesFromDocumentSnapshots(
  snapshots: EditorPageSnapshot[],
  activePageId?: string,
): {
  pages: Record<string, EditorPage>;
  pageOrder: string[];
  activePageId: string;
  activePage: EditorPage;
} {
  const pages: Record<string, EditorPage> = {};
  for (const snap of snapshots) {
    pages[snap.id] = pageFromSnapshot(snap);
  }
  const pageOrder = snapshots.map((s) => s.id);
  const activeId =
    activePageId && pages[activePageId] ? activePageId : pageOrder[0] ?? `page-${Date.now()}`;
  if (!pages[activeId]) {
    const empty = createEmptyPage(activeId, "Page 1");
    pages[activeId] = empty;
    if (!pageOrder.includes(activeId)) pageOrder.push(activeId);
  }
  return {
    pages,
    pageOrder,
    activePageId: activeId,
    activePage: pages[activeId]!,
  };
}
