"use client";

import { useMemo, useSyncExternalStore } from "react";
import { collectSceneTextNodeIds, getNodeWorldMatrixFromChildOrder } from "@/lib/editorGraph";
import { orientedBoxOverlayStyle } from "@/lib/canvasOverlaySpace";
import { isNativeRendererEnabled } from "@/lib/rendererMode";
import { matrixIsFinite } from "@/lib/transformMath";
import { getTextLayoutEpoch, subscribeTextLayoutEpoch } from "@/lib/text/textLayoutEpoch";
import { useEditorStore } from "@/stores/useEditorStore";
import { TextCanvasView } from "./TextCanvasView";
import { TextNodeCanvasShell } from "./TextNodeCanvasShell";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";

type TextSceneOverlayProps = {
  rootIds: readonly string[];
};

function TextNodeSceneOverlay({
  nodeId,
}: {
  nodeId: string;
}) {
  const node = useEditorStore((s) => s.nodes[nodeId]);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const designTokens = useEditorStore((s) => s.designTokens);
  const overlay = useCanvasOverlaySpace();

  const boxStyle = useMemo(() => {
    if (!node || node.type !== "text") return null;
    const worldMatrix = getNodeWorldMatrixFromChildOrder(nodeId, nodes, childOrder);
    if (!worldMatrix || !matrixIsFinite(worldMatrix)) return null;
    return orientedBoxOverlayStyle(
      worldMatrix,
      Math.max(2, node.width),
      Math.max(2, node.height),
      overlay,
      { dx: 0, dy: 0 },
      { contentAtScreenSize: overlay.screenSpace },
    );
  }, [nodeId, node, nodes, childOrder, overlay]);

  if (!node || node.type !== "text" || !boxStyle) return null;

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: 0,
        top: 0,
        width: boxStyle.width,
        height: boxStyle.height,
        transform: boxStyle.transform,
        transformOrigin: boxStyle.transformOrigin,
      }}
    >
      <TextNodeCanvasShell
        nodeId={nodeId}
        node={node}
        nodes={nodes}
        childOrder={childOrder}
        designTokens={designTokens}
        className="h-full w-full"
      >
        <TextCanvasView
          node={node}
          isEditing={false}
          selection={null}
          className="h-full w-full"
          contentScaleX={boxStyle.contentScaleX}
          contentScaleY={boxStyle.contentScaleY}
        />
      </TextNodeCanvasShell>
    </div>
  );
}

/** Native path: paint all text via canvas so display matches the edit overlay. */
export function TextSceneOverlay({ rootIds }: TextSceneOverlayProps) {
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const editingTextId = useEditorStore((s) => s.editingTextId);
  const textLayoutEpoch = useSyncExternalStore(subscribeTextLayoutEpoch, getTextLayoutEpoch, () => 0);

  const textIds = useMemo(() => {
    if (!isNativeRendererEnabled()) return [];
    void textLayoutEpoch;
    return collectSceneTextNodeIds(rootIds, nodes, childOrder).filter((id) => id !== editingTextId);
  }, [rootIds, nodes, childOrder, editingTextId, textLayoutEpoch]);

  if (!isNativeRendererEnabled() || textIds.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[8]">
      {textIds.map((id) => (
        <TextNodeSceneOverlay key={id} nodeId={id} />
      ))}
    </div>
  );
}
