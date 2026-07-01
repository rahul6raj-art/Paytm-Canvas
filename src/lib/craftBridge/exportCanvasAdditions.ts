import { nodeToJsx } from "@/lib/codeRoundTrip/reactExport";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  getRenderedWorldBounds,
  nodeWithWorldBoundsAsParentLocal,
} from "@/lib/editorGraph";
import { isWebImportNodeId } from "@/lib/webImport/webImportNodeIdentity";
import type { DesignToken, CanvasColorMode } from "@/lib/designTokens";
import type { EditorNode } from "@/stores/useEditorStore";

export const CANVAS_ADDITIONS_START = "{/* @craft-canvas-additions:start */}";
export const CANVAS_ADDITIONS_END = "{/* @craft-canvas-additions:end */}";

const BRIDGE_SCREEN_ROOT_CLASS =
  /className="(?:pml-more|pml-home|pml-stocks|pml-signup|ob-flow(?:[^"]*)?|pml-onboarding(?:[^"]*)?)"/;

/** Screen roots need a positioning context for absolute canvas additions. */
export function ensureBridgeScreenPositionContext(sourceCode: string): string {
  return sourceCode.replace(
    new RegExp(`(<div\\s+${BRIDGE_SCREEN_ROOT_CLASS.source}[^>]*)(>)`),
    (full, open: string, close: string) => {
      if (/position\s*:\s*["']relative["']/.test(open)) return full;
      if (/style=\{\{/.test(open)) {
        return (
          open.replace(
            /style=\{\{([\s\S]*?)\}\}/,
            (_m, inner: string) => `style={{ ${inner.trim().replace(/,\s*$/, "")}, position: "relative" }}`,
          ) + close
        );
      }
      return `${open} style={{ position: "relative" }}${close}`;
    },
  );
}

/** Layers drawn in Craft after a live bridge push (ids are not `web-*`). */
export function isCanvasAddedNode(id: string, node: EditorNode | undefined): boolean {
  if (!node || node.visible === false || node.locked) return false;
  return !isWebImportNodeId(id);
}

function isManualAdditionExportNode(node: EditorNode): boolean {
  return (
    node.type === "rectangle" ||
    node.type === "ellipse" ||
    node.type === "path" ||
    node.type === "line" ||
    node.type === "arrow" ||
    node.type === "text"
  );
}

export function findBridgeScreenRootForSource(
  nodes: Record<string, EditorNode>,
  sourcePath: string,
): string | null {
  const normalized = sourcePath.replace(/\\/g, "/").trim();
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "frame") continue;
    const tagged = node.bridgeSourcePath?.replace(/\\/g, "/").trim();
    if (tagged && tagged === normalized) return id;
  }
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type === "frame" && node.manualScreenLayout) return id;
  }
  return null;
}

function pointInsideBounds(
  x: number,
  y: number,
  bounds: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    x >= bounds.x &&
    x <= bounds.x + bounds.width &&
    y >= bounds.y &&
    y <= bounds.y + bounds.height
  );
}

/** Top-level canvas-added layers belonging to a bridge screen (including orphan overlays). */
export function collectCanvasAdditionRootIds(
  screenRootId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string[] {
  const roots = new Set<string>();

  const walkImported = (parentId: string) => {
    for (const kid of childOrder[parentId] ?? []) {
      const node = nodes[kid];
      if (!node) continue;
      if (isCanvasAddedNode(kid, node)) {
        roots.add(kid);
        continue;
      }
      if (isWebImportNodeId(kid)) walkImported(kid);
    }
  };
  walkImported(screenRootId);

  const screenBounds = getRenderedWorldBounds(screenRootId, nodes, childOrder);
  for (const kid of childOrder[EDITOR_ROOT_KEY] ?? []) {
    if (roots.has(kid) || !isCanvasAddedNode(kid, nodes[kid])) continue;
    const wb = getRenderedWorldBounds(kid, nodes, childOrder);
    const cx = wb.x + wb.width / 2;
    const cy = wb.y + wb.height / 2;
    if (pointInsideBounds(cx, cy, screenBounds)) roots.add(kid);
  }

  return [...roots].sort(
    (a, b) => (nodes[a]?.y ?? 0) - (nodes[b]?.y ?? 0) || (nodes[a]?.x ?? 0) - (nodes[b]?.x ?? 0),
  );
}

/** Export manual shapes only — skip wrapper frames so code keeps real components. */
export function collectCanvasAdditionLeafIds(
  screenRootId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string[] {
  const leaves: string[] = [];

  const walkManual = (nodeId: string) => {
    const node = nodes[nodeId];
    if (!node || !isCanvasAddedNode(nodeId, node)) return;
    const kids = (childOrder[nodeId] ?? []).filter(
      (kid) => nodes[kid] && isCanvasAddedNode(kid, nodes[kid]),
    );
    if ((node.type === "frame" || node.type === "group") && kids.length > 0) {
      for (const kid of kids) walkManual(kid);
      return;
    }
    if (isManualAdditionExportNode(node)) leaves.push(nodeId);
  };

  for (const rootId of collectCanvasAdditionRootIds(screenRootId, nodes, childOrder)) {
    walkManual(rootId);
  }

  return leaves.sort(
    (a, b) => (nodes[a]?.y ?? 0) - (nodes[b]?.y ?? 0) || (nodes[a]?.x ?? 0) - (nodes[b]?.x ?? 0),
  );
}

function nodeForScreenExport(
  nodeId: string,
  screenRootId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): EditorNode {
  const node = nodes[nodeId];
  if (!node) return node;
  // Always map through world bounds — manual shapes may live under nested imported
  // frames while exported JSX is injected at the screen root.
  const world = getRenderedWorldBounds(nodeId, nodes, childOrder);
  return nodeWithWorldBoundsAsParentLocal(node, screenRootId, world, nodes, childOrder);
}

export function buildCanvasAdditionsJsx(
  rootIds: string[],
  screenRootId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  designTokens: Record<string, DesignToken>,
  canvasColorMode: CanvasColorMode = "light",
  cssSources: string[] = [],
): string {
  if (rootIds.length === 0) return "";

  const exportNodes: Record<string, EditorNode> = { ...nodes };
  for (const id of rootIds) {
    exportNodes[id] = nodeForScreenExport(id, screenRootId, nodes, childOrder);
  }

  return rootIds
    .map((id) => {
      const node = exportNodes[id];
      if (!node) return "";
      return nodeToJsx(node, exportNodes, childOrder, designTokens, 2, {
        portable: true,
        canvasAddition: true,
        themeSafeColors: true,
        canvasColorMode,
        cssSources,
      });
    })
    .join("");
}

function injectBeforeScreenRootClose(sourceCode: string, inner: string): string | null {
  const rootRe = new RegExp(`<div\\s+${BRIDGE_SCREEN_ROOT_CLASS.source}[^>]*>`);
  const rootMatch = rootRe.exec(sourceCode);
  if (!rootMatch || rootMatch.index === undefined) return null;

  let depth = 1;
  let i = rootMatch.index + rootMatch[0].length;
  while (i < sourceCode.length && depth > 0) {
    const nextOpen = sourceCode.indexOf("<div", i);
    const nextClose = sourceCode.indexOf("</div>", i);
    if (nextClose === -1) return null;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      const lineStart = sourceCode.lastIndexOf("\n", nextClose) + 1;
      const indent = sourceCode.slice(lineStart, nextClose).match(/^\s*/)?.[0] ?? "    ";
      const formatted = inner
        .split("\n")
        .map((line) => (line.trim() ? `${indent}${line}` : line))
        .join("\n");
      const block = `${indent}${CANVAS_ADDITIONS_START}\n${formatted}\n${indent}${CANVAS_ADDITIONS_END}\n${indent}`;
      return `${sourceCode.slice(0, nextClose)}${block}${sourceCode.slice(nextClose)}`;
    }
    i = nextClose + 6;
  }
  return null;
}

export function patchCanvasAdditionsIntoReactSource(
  sourceCode: string,
  additionsJsx: string,
): string {
  const inner = additionsJsx.trim();
  const block = inner
    ? `${CANVAS_ADDITIONS_START}\n${inner}\n${CANVAS_ADDITIONS_END}`
    : `${CANVAS_ADDITIONS_START}\n${CANVAS_ADDITIONS_END}`;

  const existingRe =
    /\{\/\* @craft-canvas-additions:start \*\/\}[\s\S]*?\{\/\* @craft-canvas-additions:end \*\/\}/;
  let result = sourceCode;
  if (existingRe.test(result)) {
    result = result.replace(existingRe, block);
  } else if (inner) {
    const injected = injectBeforeScreenRootClose(result, inner);
    if (!injected) return result;
    result = injected;
  }
  if (!inner) return result;
  return ensureBridgeScreenPositionContext(result);
}
