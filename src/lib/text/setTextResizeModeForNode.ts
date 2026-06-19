import type { EditorNode } from "@/stores/useEditorStore";
import { findInstanceRoot } from "@/lib/componentModel";
import {
  availableWrapWidthForNode,
  nodeForTextLayout,
  normalizeTextResizeMode,
  type TextResizeMode,
} from "./textNodeModel";
import { textLayoutForEditorNode } from "./canonicalTextLayout";
import { setTextResizeMode } from "./setTextResizeMode";

export type TextResizeModeSnapshot = {
  textResizeMode: TextResizeMode;
  autoResize: string | undefined;
  width: number;
  height: number;
};

export type TextResizeLayoutSnapshot = {
  lineCount: number;
  width: number;
  height: number;
  wrapWidth: number;
};

export type TextResizeModeClickLog = {
  clickedMode: TextResizeMode;
  selectedNodeId: string;
  before: TextResizeModeSnapshot;
  afterPatch: Partial<EditorNode>;
  afterStoreNode: TextResizeModeSnapshot;
  layout: TextResizeLayoutSnapshot;
};

/** Resolve the effective text node (instance overrides merged) from store nodes. */
export function resolveTextNodeFromStore(
  nodes: Record<string, EditorNode>,
  nodeId: string,
): EditorNode | null {
  const raw = nodes[nodeId];
  if (!raw || raw.type !== "text") return null;
  const instRoot = findInstanceRoot(nodes, nodeId);
  if (instRoot && instRoot !== nodeId) {
    const ov = nodes[instRoot]?.instanceOverrides?.[nodeId];
    if (ov && typeof ov === "object" && !Array.isArray(ov)) {
      return { ...raw, ...(ov as Partial<EditorNode>) };
    }
  }
  return raw;
}

export function textResizeModeSnapshot(node: EditorNode): TextResizeModeSnapshot {
  const mode = normalizeTextResizeMode(node.textResizeMode, node.autoResize);
  return {
    textResizeMode: mode,
    autoResize: node.autoResize,
    width: node.width,
    height: node.height,
  };
}

export function textResizeLayoutSnapshot(node: EditorNode): TextResizeLayoutSnapshot {
  const layoutNode = nodeForTextLayout(node);
  const prepared = textLayoutForEditorNode(node);
  return {
    lineCount: prepared?.layout.lines.length ?? 0,
    width: prepared?.layout.width ?? node.width,
    height: prepared?.layout.height ?? node.height,
    wrapWidth: availableWrapWidthForNode(layoutNode),
  };
}

function readTextDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("textDebug") === "1";
}

/**
 * Canonical text resize mode change for one node: sync textResizeMode + autoResize,
 * run layout, patch dimensions, invalidate layout cache.
 */
export function computeTextResizeModePatch(
  node: EditorNode,
  mode: TextResizeMode,
): Partial<EditorNode> {
  return setTextResizeMode(node, mode);
}

/** Build the style patch consumed by updateNodeStyle / buildUpdateNodeStyleResult. */
export function textResizeModeStylePatch(
  node: EditorNode,
  mode: TextResizeMode,
): Partial<EditorNode> {
  return computeTextResizeModePatch(node, mode);
}

/** Canonical entry: sync mode fields, layout, and dimensions for one text node. */
export function setTextResizeModeForNode(
  node: EditorNode,
  mode: TextResizeMode,
): Partial<EditorNode> {
  return textResizeModeStylePatch(node, mode);
}

export function logTextResizeModeClick(log: TextResizeModeClickLog): void {
  if (!readTextDebugEnabled()) return;
  console.info("[text-resize-button]", log);
}
