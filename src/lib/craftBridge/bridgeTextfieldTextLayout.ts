import { textLayoutPatchForNode } from "@/lib/text/textLayout";
import { textResizePatch } from "@/lib/text/textNodeModel";
import type { EditorNode } from "@/stores/useEditorStore";

const TEXTFIELD_SHELL_RE = /\btextfield(?:__box|__input|-input)?\b|\btextfield\b/i;
const TEXTFIELD_INPUT_TEXT_RE = /\btextfield__input\b/i;

export function isBridgeTextfieldShell(node: EditorNode): boolean {
  if (node.type !== "frame") return false;
  const cls = node.codeClassName ?? "";
  return (
    TEXTFIELD_SHELL_RE.test(cls) ||
    node.codeJsxTag === "input" ||
    node.codeJsxTag === "textarea"
  );
}

/** Captured form input text (value / placeholder) living under a textfield host. */
export function isBridgeTextInsideTextfield(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
): boolean {
  if (node.type !== "text") return false;
  if (TEXTFIELD_INPUT_TEXT_RE.test(node.codeClassName ?? "")) return true;
  let cur = node.parentId ? nodes[node.parentId] : undefined;
  while (cur) {
    if (isBridgeTextfieldShell(cur)) return true;
    cur = cur.parentId ? nodes[cur.parentId] : undefined;
  }
  return false;
}

/** Bridge textfields should grow with typed content instead of clipping in fixed boxes. */
export function bridgeTextfieldTextResizePatch(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
): Partial<EditorNode> {
  if (!isBridgeTextInsideTextfield(node, nodes)) return {};
  return textResizePatch("auto-width");
}

/** Widen textfield host frames when edited value text exceeds the captured inner width. */
export function bridgeTextfieldHostWidthPatches(
  textNode: EditorNode,
  nodes: Record<string, EditorNode>,
): Record<string, Partial<EditorNode>> {
  if (textNode.type !== "text") return {};
  if (!isBridgeTextInsideTextfield(textNode, nodes)) return {};

  const patches: Record<string, Partial<EditorNode>> = {};
  const textRight = textNode.x + textNode.width;
  const padRight = 16;
  let curId = textNode.parentId;

  while (curId) {
    const host = nodes[curId];
    if (!host || host.type !== "frame") break;
    if (!isBridgeTextfieldShell(host) && host.name !== "Input" && host.codeJsxTag !== "input") {
      curId = host.parentId ?? null;
      continue;
    }
    const needed = Math.ceil(textRight + padRight);
    const prev = patches[curId]?.width ?? host.width;
    if (needed > prev) {
      patches[curId] = { width: needed };
    }
    curId = host.parentId ?? null;
  }

  return patches;
}

/** Layout patch for live typing in captured textfields — width hugs content. */
export function bridgeTextfieldTextLayoutPatchForContent(
  node: EditorNode,
  content: string,
  nodes: Record<string, EditorNode>,
): Partial<EditorNode> | null {
  if (!isBridgeTextInsideTextfield(node, nodes)) return null;
  const withMode = { ...node, ...textResizePatch("auto-width") };
  return textLayoutPatchForNode(withMode, content);
}
