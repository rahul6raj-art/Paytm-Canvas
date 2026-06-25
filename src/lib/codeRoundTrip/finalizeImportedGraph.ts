import { applyDeepAutoLayoutAll, type LayoutNode } from "@/lib/autoLayout";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";

/** Mobile screen width for imported React screens (PML, etc.). */
export const IMPORT_SCREEN_WIDTH = 390;

function editorNodesToLayoutMap(nodes: Record<string, EditorNode>): Record<string, LayoutNode> {
  const m: Record<string, LayoutNode> = {};
  for (const [id, n] of Object.entries(nodes)) {
    m[id] = {
      id: n.id,
      type: n.type,
      parentId: n.parentId,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      visible: n.visible,
      locked: n.locked,
      layoutMode: n.layoutMode,
      layoutGap: n.layoutGap,
      paddingTop: n.paddingTop,
      paddingRight: n.paddingRight,
      paddingBottom: n.paddingBottom,
      paddingLeft: n.paddingLeft,
      primaryAxisAlign: n.primaryAxisAlign,
      counterAxisAlign: n.counterAxisAlign,
      constraintsHorizontal: n.constraintsHorizontal,
      constraintsVertical: n.constraintsVertical,
      layoutSizingHorizontal: n.layoutSizingHorizontal,
      layoutSizingVertical: n.layoutSizingVertical,
    };
  }
  return m;
}

function mergeLayoutIntoEditorNodes(
  nodes: Record<string, EditorNode>,
  layoutNodes: Record<string, LayoutNode>,
): Record<string, EditorNode> {
  const next = { ...nodes };
  for (const [id, ln] of Object.entries(layoutNodes)) {
    const en = next[id];
    if (!en) continue;
    next[id] = {
      ...en,
      x: ln.x,
      y: ln.y,
      width: ln.width,
      height: ln.height,
    };
  }
  return next;
}

function isPmlScreenRootClass(className: string): boolean {
  return /\bpml-(?:home|more|signup|onboarding|stocks)\b/.test(className) && !className.includes("__");
}

function isFullBleedContainer(n: EditorNode): boolean {
  if (n.type !== "frame" && n.type !== "group") return false;
  const cc = n.codeClassName ?? "";
  const tag = n.codeJsxTag ?? "";
  if (isPmlScreenRootClass(cc) || cc.includes("sh-section")) return true;
  if (tag === "section" || tag === "main" || tag === "article") return true;
  // Intrinsic layout wrappers (div.pml-signup__*) — not imported leaf components.
  if (n.codeJsxIntrinsic) {
    if (cc.includes("pml-") || cc.includes("sh-")) return true;
  }
  return false;
}

/** Prevent frames from collapsing to the width of narrow text children. */
function enforceScreenWidths(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  screenW = IMPORT_SCREEN_WIDTH,
): Record<string, EditorNode> {
  const next = { ...nodes };

  for (const [id, n] of Object.entries(next)) {
    if (isFullBleedContainer(n) && n.width < screenW) {
      next[id] = { ...n, width: screenW };
    }
  }

  for (const rootId of childOrder[EDITOR_ROOT_KEY] ?? []) {
    const walk = (parentId: string) => {
      const parent = next[parentId];
      const parentW = parent?.width ?? screenW;
      const targetW = Math.max(screenW, parentW);
      for (const cid of childOrder[parentId] ?? []) {
        const c = next[cid];
        if (!c) continue;
        if (
          (c.type === "frame" || c.type === "group") &&
          isFullBleedContainer(c) &&
          c.width < targetW
        ) {
          next[cid] = { ...c, width: targetW };
        }
        if (c.type === "frame" || c.type === "group") {
          walk(cid);
        }
      }
    };
    walk(rootId);
  }

  return next;
}

/** Grow frame/group height to contain positioned children (CSS flex min-height:0 safe). */
function expandFrameHeightsToFitDescendants(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Record<string, EditorNode> {
  const next = { ...nodes };

  const walk = (parentId: string): void => {
    for (const cid of childOrder[parentId] ?? []) {
      walk(cid);
    }
    const parent = next[parentId];
    const kids = childOrder[parentId] ?? [];
    if (!parent || kids.length === 0) return;
    if (parent.type !== "frame" && parent.type !== "group") return;

    let maxBottom = 0;
    for (const cid of kids) {
      const c = next[cid];
      if (!c?.visible) continue;
      maxBottom = Math.max(maxBottom, c.y + c.height);
    }
    const needH = maxBottom + (parent.paddingBottom ?? 0);
    if (needH > parent.height) {
      next[parentId] = { ...parent, height: needH, clipChildren: false };
    } else if (parent.clipChildren !== false) {
      next[parentId] = { ...parent, clipChildren: false };
    }
  };

  for (const rootId of childOrder[EDITOR_ROOT_KEY] ?? []) {
    walk(rootId);
  }
  return next;
}

/** Grow auto-layout frame height to fit children; never shrink width. */
function hugFrameHeights(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Record<string, EditorNode> {
  const next = { ...nodes };
  for (const [parentId, kids] of Object.entries(childOrder)) {
    if (parentId === EDITOR_ROOT_KEY) continue;
    const parent = next[parentId];
    if (!parent || (parent.type !== "frame" && parent.type !== "group")) continue;
    if ((parent.layoutMode ?? "none") === "none") continue;
    if (kids.length === 0) continue;

    const pb = parent.paddingBottom ?? 0;
    let maxY = 0;
    for (const cid of kids) {
      const c = next[cid];
      if (!c?.visible) continue;
      maxY = Math.max(maxY, c.y + c.height);
    }
    const needH = maxY + pb;
    if (needH > parent.height) {
      next[parentId] = { ...parent, height: needH };
    }
  }
  return next;
}

/** Grow export roots so children are never clipped by an undersized screen frame. */
function fitRootToChildrenBounds(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  rootIds: string[],
): Record<string, EditorNode> {
  const next = { ...nodes };

  for (const rootId of rootIds) {
    const root = next[rootId];
    if (!root) continue;

    let maxW = root.width;
    let maxH = root.height;

    const walk = (parentId: string, offsetX: number, offsetY: number) => {
      for (const cid of childOrder[parentId] ?? []) {
        const c = next[cid];
        if (!c?.visible) continue;
        const x = offsetX + c.x;
        const y = offsetY + c.y;
        maxW = Math.max(maxW, x + c.width);
        maxH = Math.max(maxH, y + c.height);
        walk(cid, x, y);
      }
    };
    walk(rootId, 0, 0);

    next[rootId] = {
      ...root,
      width: isPmlScreenRootClass(root.codeClassName ?? "")
        ? IMPORT_SCREEN_WIDTH
        : Math.min(Math.max(maxW, IMPORT_SCREEN_WIDTH), IMPORT_SCREEN_WIDTH * 2),
      height: Math.max(maxH, 600),
    };
  }

  return next;
}

/**
 * Run Paytm Craft auto-layout on imported JSX graph so canvas matches flex/stack semantics.
 * Use `preserveAbsoluteLayout` when page CSS already defines positions (bridge page bundles).
 */
export function finalizeImportedGraph(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  opts?: { preserveAbsoluteLayout?: boolean },
): Record<string, EditorNode> {
  let next = { ...nodes };

  next = enforceScreenWidths(next, childOrder);

  if (opts?.preserveAbsoluteLayout) {
    const exportRootIds = childOrder[EDITOR_ROOT_KEY] ?? [];
    next = expandFrameHeightsToFitDescendants(next, childOrder);
    next = hugFrameHeights(next, childOrder);
    next = fitRootToChildrenBounds(next, childOrder, exportRootIds);
    for (const rootId of exportRootIds) {
      const root = next[rootId];
      if (!root) continue;
      next[rootId] = {
        ...root,
        x: 0,
        y: 0,
        parentId: null,
        width: Math.max(root.width, IMPORT_SCREEN_WIDTH),
        height: Math.max(root.height, 600),
        layoutMode: "none",
        clipChildren: false,
        fillEnabled: root.fillEnabled !== false,
        strokeColor: root.strokeColor ?? "#4a5568",
        strokeWidth: root.strokeWidth ?? 1,
      };
    }
    next = expandFrameHeightsToFitDescendants(next, childOrder);
    return next;
  }

  let layoutMap = editorNodesToLayoutMap(next);
  layoutMap = applyDeepAutoLayoutAll(layoutMap, childOrder);
  next = mergeLayoutIntoEditorNodes(next, layoutMap);

  next = enforceScreenWidths(next, childOrder);
  layoutMap = editorNodesToLayoutMap(next);
  layoutMap = applyDeepAutoLayoutAll(layoutMap, childOrder);
  next = mergeLayoutIntoEditorNodes(next, layoutMap);

  next = hugFrameHeights(next, childOrder);

  layoutMap = editorNodesToLayoutMap(next);
  layoutMap = applyDeepAutoLayoutAll(layoutMap, childOrder);
  next = mergeLayoutIntoEditorNodes(next, layoutMap);

  const exportRootIds = childOrder[EDITOR_ROOT_KEY] ?? [];
  next = fitRootToChildrenBounds(next, childOrder, exportRootIds);

  for (const rootId of exportRootIds) {
    const root = next[rootId];
    if (!root) continue;
    next[rootId] = {
      ...root,
      x: 0,
      y: 0,
      width: Math.max(root.width, IMPORT_SCREEN_WIDTH),
      height: Math.max(root.height, 600),
      layoutMode: root.layoutMode ?? "vertical",
      counterAxisAlign: root.counterAxisAlign ?? "stretch",
      strokeColor: root.strokeColor ?? "#4a5568",
      strokeWidth: root.strokeWidth ?? 1,
    };
  }

  return next;
}
