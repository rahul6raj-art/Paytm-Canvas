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

function isFullBleedContainer(n: EditorNode): boolean {
  if (n.type !== "frame" && n.type !== "group") return false;
  const cc = n.codeClassName ?? "";
  const tag = n.codeJsxTag ?? "";
  if (cc.includes("pml-home") || cc.includes("sh-section")) return true;
  if (tag === "section" || tag === "main" || tag === "article") return true;
  if (!n.codeJsxIntrinsic && n.type === "frame") return true;
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
        if (c.type === "frame" || c.type === "group") {
          if (c.width < targetW) {
            next[cid] = { ...c, width: targetW };
          }
          walk(cid);
        }
      }
    };
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

/**
 * Run Paytm Craft auto-layout on imported JSX graph so canvas matches flex/stack semantics.
 */
export function finalizeImportedGraph(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): Record<string, EditorNode> {
  let next = { ...nodes };

  next = enforceScreenWidths(next, childOrder);

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

  for (const rootId of childOrder[EDITOR_ROOT_KEY] ?? []) {
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
    };
  }

  return next;
}
