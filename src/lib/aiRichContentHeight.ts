import type { EditorNode } from "@/stores/useEditorStore";

const MIN_FRAME_HEIGHT = 280;
const BOTTOM_INSET = 20;

function worldBottom(nodeId: string, nodes: Record<string, EditorNode>): number {
  const n = nodes[nodeId];
  if (!n) return 0;
  let y = n.y + n.height;
  return y;
}

function maxDescendantBottom(
  parentId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): number {
  let max = 0;
  const walk = (id: string, offsetY: number) => {
    const n = nodes[id];
    if (!n) return;
    const bottom = offsetY + n.y + n.height;
    max = Math.max(max, bottom);
    for (const cid of childOrder[id] ?? []) {
      walk(cid, offsetY + n.y);
    }
  };
  for (const cid of childOrder[parentId] ?? []) {
    walk(cid, 0);
  }
  return max;
}

/** Resize the screen frame to fit generated content instead of a fixed phone height. */
export function fitRichFrameToContent(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  frameId: string,
  shellMaxHeight?: number,
): number {
  const contentBottom = maxDescendantBottom(frameId, nodes, childOrder);
  const frame = nodes[frameId];
  if (!frame) return MIN_FRAME_HEIGHT;

  const nextH = Math.max(MIN_FRAME_HEIGHT, Math.ceil(contentBottom + BOTTOM_INSET));
  const capped = shellMaxHeight ? Math.min(nextH, shellMaxHeight) : nextH;

  nodes[frameId] = {
    ...frame,
    height: capped,
    layoutSizingVertical: frame.layoutMode && frame.layoutMode !== "none" ? "hug" : frame.layoutSizingVertical,
  };

  return capped;
}

export function measureFlatContentHeight(
  nodes: Record<string, EditorNode>,
  frameId: string,
): number {
  let max = 0;
  for (const n of Object.values(nodes)) {
    if (n.parentId !== frameId) continue;
    max = Math.max(max, worldBottom(n.id, nodes));
  }
  return Math.max(MIN_FRAME_HEIGHT, Math.ceil(max + BOTTOM_INSET));
}
