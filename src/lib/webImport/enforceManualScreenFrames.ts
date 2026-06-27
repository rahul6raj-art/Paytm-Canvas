import type { EditorNode } from "@/stores/useEditorStore";
import { isManualScreenFrame, rootFrameIds } from "@/lib/webImport/manualScreenFrames";

/** Screen artboards are manual frames — never auto-layout containers. */
export function enforceManualScreenFrames(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  const rootIds = rootFrameIds(childOrder);

  // Imported web captures: top-level frame is the screen artboard.
  for (const rootId of rootIds) {
    const node = nodes[rootId];
    if (!node || (node.type !== "frame" && node.type !== "group")) continue;
    nodes[rootId] = { ...node, manualScreenLayout: true };
  }

  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "frame" && node.type !== "group") continue;
    if (!isManualScreenFrame(node, rootIds)) continue;

    nodes[id] = {
      ...node,
      manualScreenLayout: true,
      layoutMode: "none",
      layoutGap: 0,
      layoutWrap: false,
      layoutDirty: false,
      clipChildren: node.clipChildren ?? true,
    };
  }
}
