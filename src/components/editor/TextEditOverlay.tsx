"use client";

import { useMemo } from "react";
import { getNodeWorldMatrixFromChildOrder } from "@/lib/editorGraph";
import { orientedBoxOverlayStyle } from "@/lib/canvasOverlaySpace";
import { isNativeRendererEnabled } from "@/lib/rendererMode";
import { matrixIsFinite } from "@/lib/transformMath";
import { useEditorStore } from "@/stores/useEditorStore";
import { TextCanvasView } from "./TextCanvasView";
import { TextNodeCanvasShell } from "./TextNodeCanvasShell";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";

/** Native path: live text + caret overlay while the GPU compositor paints the scene. */
export function TextEditOverlay() {
  const editingTextId = useEditorStore((s) => s.editingTextId);
  const textEditSelection = useEditorStore((s) => s.textEditSelection);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const designTokens = useEditorStore((s) => s.designTokens);
  const overlay = useCanvasOverlaySpace();

  const node = editingTextId ? nodes[editingTextId] : null;

  const boxStyle = useMemo(() => {
    if (!editingTextId || !node || node.type !== "text") return null;
    const worldMatrix = getNodeWorldMatrixFromChildOrder(editingTextId, nodes, childOrder);
    if (!worldMatrix || !matrixIsFinite(worldMatrix)) return null;
    return orientedBoxOverlayStyle(
      worldMatrix,
      Math.max(2, node.width),
      Math.max(2, node.height),
      overlay,
      { dx: 0, dy: 0 },
      { contentAtScreenSize: overlay.screenSpace },
    );
  }, [editingTextId, node, nodes, childOrder, overlay]);

  if (!isNativeRendererEnabled() || !editingTextId || !node || node.type !== "text" || !boxStyle) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[36]">
      <div
        className="pointer-events-auto absolute"
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
          nodeId={editingTextId}
          node={node}
          nodes={nodes}
          childOrder={childOrder}
          designTokens={designTokens}
          className="h-full w-full"
        >
          <TextCanvasView
            node={node}
            isEditing
            selection={textEditSelection}
            className="h-full w-full"
            contentScaleX={boxStyle.contentScaleX}
            contentScaleY={boxStyle.contentScaleY}
          />
        </TextNodeCanvasShell>
      </div>
    </div>
  );
}
