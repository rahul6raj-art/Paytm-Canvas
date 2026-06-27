import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { LayoutMode } from "@/lib/autoLayout";
import { layoutAutoNodeDeep } from "@/lib/layoutEngine/layoutAutoNode";
import { sortIdsForAutoLayoutFlow } from "@/lib/layoutEngine/flowOrder";
import type { LayoutEngineNode } from "@/lib/layoutEngine/types";
import type { EditorNode } from "@/stores/useEditorStore";
import { isPhoneShellBottomChrome } from "@/lib/webImport/phoneShellBottomChrome";
import { isPhoneShellClassName } from "@/lib/webImport/phoneShellViewport";
import { isManualScreenFrame, rootFrameIds } from "@/lib/webImport/manualScreenFrames";
import { isManualComponentFrame } from "@/lib/webImport/enforceManualComponentComposition";

const GAP_VARIANCE_MAX = 6;
const AXIS_ALIGN_TOLERANCE = 4;
const FIDELITY_TOLERANCE_PX = 2;

type Bounds = { x: number; y: number; width: number; height: number };

function isAutoLayoutParent(node: EditorNode | undefined): boolean {
  return (
    !!node &&
    (node.type === "frame" || node.type === "group") &&
    (node.layoutMode ?? "none") !== "none"
  );
}

function isScreenManualFrame(
  node: EditorNode,
  rootIds: ReadonlySet<string>,
): boolean {
  return isManualScreenFrame(node, rootIds);
}

function shouldStayAbsoluteChild(child: EditorNode): boolean {
  if (child.layoutPositioning === "absolute") return true;
  const cls = (child.codeClassName ?? "").toLowerCase();
  if (/\bfixed\b/.test(cls)) return true;
  if (/\babsolute\b/.test(cls) && !/\brelative\b/.test(cls)) return true;
  if (isPhoneShellBottomChrome(child.codeClassName, child.codeJsxTag)) return true;
  return false;
}

function visibleChildIds(
  parentId: string,
  childOrder: Record<string, string[]>,
  nodes: Record<string, EditorNode>,
): string[] {
  return (childOrder[parentId] ?? []).filter((id) => {
    const n = nodes[id];
    return Boolean(n && n.visible !== false);
  });
}

function measureUniformGap(
  kids: EditorNode[],
  mode: Exclude<LayoutMode, "none">,
): number | null {
  if (kids.length < 2) return 0;
  const sorted = [...kids].sort((a, b) =>
    mode === "horizontal" ? a.x - b.x : a.y - b.y,
  );
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const gap =
      mode === "horizontal"
        ? cur.x - (prev.x + prev.width)
        : cur.y - (prev.y + prev.height);
    if (gap >= -1 && gap < 240) gaps.push(Math.max(0, Math.round(gap)));
  }
  if (gaps.length === 0) return 0;
  const min = Math.min(...gaps);
  const max = Math.max(...gaps);
  if (max - min > GAP_VARIANCE_MAX) return null;
  return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
}

function crossAxisAligned(
  kids: EditorNode[],
  mode: Exclude<LayoutMode, "none">,
): boolean {
  if (kids.length < 2) return true;
  if (mode === "horizontal") {
    const ys = kids.map((k) => k.y);
    return Math.max(...ys) - Math.min(...ys) <= AXIS_ALIGN_TOLERANCE;
  }
  const xs = kids.map((k) => k.x);
  return Math.max(...xs) - Math.min(...xs) <= AXIS_ALIGN_TOLERANCE;
}

function snapshotBounds(nodes: Record<string, EditorNode>, ids: string[]): Map<string, Bounds> {
  const out = new Map<string, Bounds>();
  for (const id of ids) {
    const n = nodes[id];
    if (!n) continue;
    out.set(id, { x: n.x, y: n.y, width: n.width, height: n.height });
  }
  return out;
}

function withinTolerance(a: number, b: number, tol = FIDELITY_TOLERANCE_PX): boolean {
  return Math.abs(a - b) <= tol;
}

function layoutMatchesCapture(
  nodes: Record<string, EditorNode>,
  capture: Map<string, Bounds>,
): boolean {
  for (const [id, before] of capture) {
    const after = nodes[id];
    if (!after) return false;
    if (
      !withinTolerance(before.x, after.x) ||
      !withinTolerance(before.y, after.y) ||
      !withinTolerance(before.width, after.width) ||
      !withinTolerance(before.height, after.height)
    ) {
      return false;
    }
  }
  return true;
}

function pinAbsoluteSubtree(
  ids: string[],
  capture: Map<string, Bounds>,
  nodes: Record<string, EditorNode>,
): void {
  for (const id of ids) {
    const snap = capture.get(id);
    const node = nodes[id];
    if (!snap || !node) continue;
    nodes[id] = {
      ...node,
      x: snap.x,
      y: snap.y,
      width: snap.width,
      height: snap.height,
      layoutPositioning: "absolute",
      layoutSizingHorizontal: node.layoutSizingHorizontal ?? "fixed",
      layoutSizingVertical: node.layoutSizingVertical ?? "fixed",
      layoutDirty: false,
    };
  }
}

function depthOf(nodeId: string, nodes: Record<string, EditorNode>): number {
  let d = 0;
  let cur = nodes[nodeId]?.parentId ?? null;
  while (cur) {
    d++;
    cur = nodes[cur]?.parentId ?? null;
  }
  return d;
}

function calibratePaddingFromCapture(
  parent: EditorNode,
  flowNodes: EditorNode[],
): {
  padLeft: number;
  padTop: number;
  padRight: number;
  padBottom: number;
} {
  if (flowNodes.length === 0) {
    return { padLeft: 0, padTop: 0, padRight: 0, padBottom: 0 };
  }
  const padLeft = Math.max(0, Math.min(...flowNodes.map((c) => c.x)));
  const padTop = Math.max(0, Math.min(...flowNodes.map((c) => c.y)));
  const maxRight = Math.max(...flowNodes.map((c) => c.x + c.width));
  const maxBottom = Math.max(...flowNodes.map((c) => c.y + c.height));
  const padRight = Math.max(0, Math.round(parent.width - maxRight));
  const padBottom = Math.max(0, Math.round(parent.height - maxBottom));
  return { padLeft, padTop, padRight, padBottom };
}

function normalizeFlowOrigins(
  flowIds: string[],
  nodes: Record<string, EditorNode>,
  padLeft: number,
  padTop: number,
): void {
  for (const id of flowIds) {
    const child = nodes[id]!;
    nodes[id] = {
      ...child,
      x: child.x - padLeft,
      y: child.y - padTop,
    };
  }
}

function shouldSkipAutoLayoutSynthesis(parent: EditorNode): boolean {
  if (isManualComponentFrame(parent)) return true;
  if (isPhoneShellClassName(parent.codeClassName)) return true;
  if (parent.codeJsxTag === "ListItem") return true;
  const cls = parent.codeClassName ?? "";
  if (/\bli-item\b/.test(cls) && !/\bli-item__/.test(cls)) return true;
  return false;
}

function trySynthesizeContainer(
  parentId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  const parent = nodes[parentId];
  if (!isAutoLayoutParent(parent)) return;
  if (shouldSkipAutoLayoutSynthesis(parent!)) {
    const kidIds = visibleChildIds(parentId, childOrder, nodes);
    const capture = snapshotBounds(nodes, kidIds);
    pinAbsoluteSubtree(kidIds, capture, nodes);
    nodes[parentId] = { ...parent!, layoutDirty: false };
    return;
  }

  const mode = parent!.layoutMode as Exclude<LayoutMode, "none">;
  const kidIds = visibleChildIds(parentId, childOrder, nodes);
  if (kidIds.length === 0) return;

  const flowIds = kidIds.filter((id) => !shouldStayAbsoluteChild(nodes[id]!));
  const absIds = kidIds.filter((id) => shouldStayAbsoluteChild(nodes[id]!));
  if (flowIds.length === 0) return;

  const flowNodes = flowIds.map((id) => nodes[id]!);
  const capture = snapshotBounds(nodes, [...flowIds, ...absIds]);

  if (flowIds.length >= 2) {
    const measuredGap = measureUniformGap(flowNodes, mode);
    const aligned = crossAxisAligned(flowNodes, mode);
    if (measuredGap == null || !aligned) {
      pinAbsoluteSubtree([...flowIds, ...absIds], capture, nodes);
      nodes[parentId] = { ...nodes[parentId]!, layoutDirty: false };
      return;
    }
    const padding = calibratePaddingFromCapture(parent!, flowNodes);
    nodes[parentId] = {
      ...parent!,
      layoutGap: measuredGap,
      paddingLeft: padding.padLeft,
      paddingTop: padding.padTop,
      paddingRight: padding.padRight,
      paddingBottom: padding.padBottom,
      primaryAxisAlign: parent!.primaryAxisAlign ?? "start",
      counterAxisAlign: parent!.counterAxisAlign ?? "start",
      layoutDirty: true,
    };
    normalizeFlowOrigins(flowIds, nodes, padding.padLeft, padding.padTop);
  } else if (flowIds.length === 1) {
    const only = flowNodes[0]!;
    const padding = calibratePaddingFromCapture(parent!, [only]);
    nodes[parentId] = {
      ...parent!,
      paddingLeft: padding.padLeft,
      paddingTop: padding.padTop,
      paddingRight: padding.padRight,
      paddingBottom: padding.padBottom,
      layoutDirty: false,
    };
    normalizeFlowOrigins(flowIds, nodes, padding.padLeft, padding.padTop);
    pinAbsoluteSubtree(flowIds, capture, nodes);
    nodes[parentId] = { ...nodes[parentId]!, layoutDirty: false };
    return;
  }

  childOrder[parentId] = sortIdsForAutoLayoutFlow(
    kidIds,
    nodes as Record<string, LayoutEngineNode>,
    mode,
  );

  for (const id of flowIds) {
    const child = nodes[id]!;
    nodes[id] = {
      ...child,
      layoutPositioning: "auto",
      layoutSizingHorizontal: child.layoutSizingHorizontal ?? "fixed",
      layoutSizingVertical: child.layoutSizingVertical ?? "fixed",
      layoutDirty: true,
    };
  }
  for (const id of absIds) {
    const child = nodes[id]!;
    nodes[id] = { ...child, layoutPositioning: "absolute", layoutDirty: false };
  }

  const laidOut = layoutAutoNodeDeep(
    nodes as Record<string, LayoutEngineNode>,
    childOrder,
    parentId,
  ) as Record<string, EditorNode>;
  for (const [id, node] of Object.entries(laidOut)) {
    nodes[id] = node;
  }

  if (!layoutMatchesCapture(nodes, capture)) {
    pinAbsoluteSubtree([...flowIds, ...absIds], capture, nodes);
  }

  nodes[parentId] = { ...nodes[parentId]!, layoutDirty: false };
}

/**
 * Build editable auto layout from captured CSS + geometry, then verify 1:1 fidelity.
 * Falls back to absolute positioning per container when synthesis cannot match the browser.
 */
export function synthesizeWebImportAutoLayout(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  const rootIds = rootFrameIds(childOrder);
  const manualScreenIds = new Set<string>(rootIds);
  for (const node of Object.values(nodes)) {
    if (isScreenManualFrame(node, rootIds)) manualScreenIds.add(node.id);
  }

  for (const screenId of manualScreenIds) {
    const screen = nodes[screenId];
    if (!screen) continue;
    nodes[screenId] = {
      ...screen,
      manualScreenLayout: true,
      layoutMode: "none",
      layoutGap: 0,
      layoutDirty: false,
    };
  }

  const autoParents = Object.keys(childOrder)
    .filter((parentId) => isAutoLayoutParent(nodes[parentId]))
    .sort((a, b) => depthOf(b, nodes) - depthOf(a, nodes));

  for (const parentId of autoParents) {
    trySynthesizeContainer(parentId, nodes, childOrder);
  }

  for (const [parentId, kidIds] of Object.entries(childOrder)) {
    const parent = nodes[parentId];
    if (!parent || isAutoLayoutParent(parent)) continue;
    for (const kidId of kidIds) {
      const child = nodes[kidId];
      if (!child || child.visible === false) continue;
      nodes[kidId] = {
        ...child,
        layoutPositioning: "absolute",
        layoutDirty: false,
      };
    }
  }
}
