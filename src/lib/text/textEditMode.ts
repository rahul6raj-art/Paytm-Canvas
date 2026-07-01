import { getCursorPositionFromPoint } from "@/lib/text/textCursor";
import { bridgeTextfieldTextResizePatch } from "@/lib/craftBridge/bridgeTextfieldTextLayout";
import { pickDeepestNodeAtWorldPoint, worldToLocalForNode } from "@/lib/tree";
import type { EditorNode } from "@/stores/useEditorStore";
import { useEditorStore } from "@/stores/useEditorStore";
import { normalizeTextResizeMode } from "@/lib/text/textNodeModel";

export type TextEditSelection = { anchor: number; focus: number };

const TEXTFIELD_HOST_RE = /\btextfield(?:__box|__input|-input)?\b|\binput\b/i;
const TEXTFIELD_FLOAT_LABEL_RE = /\btextfield__label--float\b/i;

function isEditableTextNode(node: EditorNode | undefined): node is EditorNode {
  return Boolean(node?.type === "text" && node.visible !== false && !node.locked);
}

function collectTextDescendants(
  rootId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): EditorNode[] {
  const out: EditorNode[] = [];
  const walk = (id: string) => {
    const n = nodes[id];
    if (!n?.visible || n.locked) return;
    if (n.type === "text") out.push(n);
    for (const kid of childOrder[id] ?? []) walk(kid);
  };
  walk(rootId);
  return out;
}

function textfieldValueTextId(
  hostId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string | null {
  const texts = collectTextDescendants(hostId, nodes, childOrder);
  const valueLike = texts.find(
    (t) =>
      !TEXTFIELD_FLOAT_LABEL_RE.test(t.codeClassName ?? "") &&
      (/value|placeholder|input/i.test(t.name) || Boolean(t.content?.trim())),
  );
  if (valueLike) return valueLike.id;
  const notLabel = texts.find((t) => !TEXTFIELD_FLOAT_LABEL_RE.test(t.codeClassName ?? ""));
  return notLabel?.id ?? texts[0]?.id ?? null;
}

function textfieldHostAncestor(
  nodeId: string,
  nodes: Record<string, EditorNode>,
): string | null {
  let cur = nodes[nodeId];
  while (cur) {
    if (cur.type === "frame" && TEXTFIELD_HOST_RE.test(cur.codeClassName ?? "")) {
      return cur.id;
    }
    cur = cur.parentId ? nodes[cur.parentId] : undefined;
  }
  return null;
}

/** Resolve which text layer to edit on double-click (including captured input / textfield hosts). */
export function resolveTextEditTargetOnDoubleClick(
  hitId: string,
  worldX: number,
  worldY: number,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string | null {
  const atPoint = pickDeepestNodeAtWorldPoint(worldX, worldY, nodes, childOrder, {
    types: ["text"],
  });
  if (atPoint && isEditableTextNode(nodes[atPoint])) return atPoint;

  const hit = nodes[hitId];
  if (!hit) return null;
  if (isEditableTextNode(hit)) return hitId;

  const hostId =
    hit.type === "frame" && TEXTFIELD_HOST_RE.test(hit.codeClassName ?? "")
      ? hitId
      : textfieldHostAncestor(hitId, nodes);
  if (hostId) return textfieldValueTextId(hostId, nodes, childOrder);

  return null;
}

/** Map a world click to a caret index inside a text layer. */
export function resolveTextCaretAtWorldPoint(
  nodeId: string,
  worldX: number,
  worldY: number,
): number | null {
  const st = useEditorStore.getState();
  const node = st.nodes[nodeId];
  if (!node || node.type !== "text") return null;
  const local = worldToLocalForNode(worldX, worldY, nodeId, st.nodes, st.childOrder);
  if (!local) return null;
  return getCursorPositionFromPoint(local.x, local.y, node);
}

/** Enter inline text editing for a layer. */
export function enterTextEditMode(
  nodeId: string,
  selection?: TextEditSelection,
): void {
  const st = useEditorStore.getState();
  let n = st.nodes[nodeId];
  if (!n || n.type !== "text" || n.locked || !n.visible) return;

  const resizeFix = bridgeTextfieldTextResizePatch(n, st.nodes);
  if (
    Object.keys(resizeFix).length > 0 &&
    normalizeTextResizeMode(n.textResizeMode, n.autoResize) === "fixed"
  ) {
    st.updateNodeStyle(nodeId, resizeFix, { skipHistory: true });
    n = { ...n, ...resizeFix };
  }

  st.select(nodeId);
  st.setEditingTextId(nodeId, selection);
}

/** Enter inline text editing with the caret at a world-space click. */
export function enterTextEditModeAtWorldPoint(
  nodeId: string,
  worldX: number,
  worldY: number,
): void {
  const st = useEditorStore.getState();
  let n = st.nodes[nodeId];
  if (!n || n.type !== "text" || n.locked || !n.visible) return;

  const resizeFix = bridgeTextfieldTextResizePatch(n, st.nodes);
  if (
    Object.keys(resizeFix).length > 0 &&
    normalizeTextResizeMode(n.textResizeMode, n.autoResize) === "fixed"
  ) {
    st.updateNodeStyle(nodeId, resizeFix, { skipHistory: true });
    n = { ...n, ...resizeFix };
  }

  const index = resolveTextCaretAtWorldPoint(nodeId, worldX, worldY) ?? (n.content?.length ?? 0);
  st.select(nodeId);
  st.setEditingTextId(nodeId, { anchor: index, focus: index });
}

/** Exit inline text editing. */
export function exitTextEditMode(): void {
  useEditorStore.getState().setEditingTextId(null);
}
