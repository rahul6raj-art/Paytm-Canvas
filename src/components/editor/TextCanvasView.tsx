"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  toTextNodeModel,
  textTypoFromModel,
  wrapWidthForResizeMode,
} from "@/lib/text/textNodeModel";
import { ensureFontFamilyLoaded } from "@/lib/fonts";
import { textLayoutPatchForNode } from "@/lib/text/textLayout";
import { textAdvancedStyleFromNode } from "@/lib/text/textAdvancedStyle";
import { textLayoutForEditorNode } from "@/lib/text/canonicalTextLayout";
import { loadTextMediaFill } from "@/lib/text/textFillPaint";
import { renderTextToCanvas, resolveTextCanvasDpr } from "@/lib/text/textCanvasRender";
import { getCursorPositionFromPoint } from "@/lib/text/textCursor";
import {
  dispatchTextEditPointerDown,
  dispatchTextEditPointerDrag,
} from "./TextEditPortal";
import { cn } from "@/lib/utils";
import { getTextLayoutEpoch, subscribeTextLayoutEpoch } from "@/lib/text/textLayoutEpoch";
import { useCanvasColorMode } from "@/hooks/useCanvasColorMode";
import { useEditorStore } from "@/stores/useEditorStore";
import { isRotateGeometryLockActive, rotateGeomSnapshotForNode } from "@/lib/rotation/rotateGeometryLock";
import { useResolvedTextPaintNode } from "./TextNodeCanvasShell";

type TextCanvasViewProps = {
  node: EditorNode;
  isEditing: boolean;
  selection: { anchor: number; focus: number } | null;
  className?: string;
  /** When the overlay box is already sized in viewport pixels (screen-space text). */
  contentScaleX?: number;
  contentScaleY?: number;
};

/** Canvas-based text renderer (visual layer only — input comes from hidden textarea). */
export function TextCanvasView({
  node,
  isEditing,
  selection,
  className,
  contentScaleX,
  contentScaleY,
}: TextCanvasViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ active: boolean; extend: boolean } | null>(null);
  const [caretVisible, setCaretVisible] = useState(true);

  const zoom = useEditorStore((s) => s.zoom);
  const canvasColorMode = useCanvasColorMode();
  const assets = useEditorStore((s) => s.assets);
  const textLayoutEpoch = useSyncExternalStore(subscribeTextLayoutEpoch, getTextLayoutEpoch, () => 0);
  const paintNode = useResolvedTextPaintNode(node);
  const model = toTextNodeModel(paintNode, isEditing);
  const caretIndex = selection?.focus ?? 0;

  useEffect(() => {
    if (!isEditing) return;
    const id = window.setInterval(() => setCaretVisible((v) => !v), 530);
    return () => window.clearInterval(id);
  }, [isEditing]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !model) return;
    let alive = true;
    const scaleX = contentScaleX ?? 1;
    const scaleY = contentScaleY ?? scaleX;
    const screenSized = scaleX !== 1 || scaleY !== 1;
    const typo = textTypoFromModel(model);
    const renderTypo = screenSized
      ? {
          ...typo,
          fontSize: typo.fontSize * scaleX,
          letterSpacing: typo.letterSpacing * scaleX,
        }
      : typo;
    const wrapWidth = wrapWidthForResizeMode(model.width, model.textResizeMode);
    const renderWidth = model.width * scaleX;
    const renderHeight = model.height * scaleY;
    const renderWrapWidth =
      wrapWidth === Number.POSITIVE_INFINITY
        ? Number.POSITIVE_INFINITY
        : wrapWidth * scaleX;

    const paint = (mediaFill: Awaited<ReturnType<typeof loadTextMediaFill>>) => {
      if (!alive || !canvasRef.current) return;
      const prepared = screenSized ? null : textLayoutForEditorNode(paintNode);
      renderTextToCanvas(canvasRef.current, {
        typo: renderTypo,
        text: model.text,
        width: renderWidth,
        height: renderHeight,
        textAlign: model.textAlign,
        verticalAlign: model.verticalAlign,
        opacity: paintNode.opacity ?? 1,
        wrapWidth: renderWrapWidth,
        zoom: screenSized ? 1 : zoom,
        layoutScale: screenSized ? scaleX : undefined,
        dpr: screenSized
          ? resolveTextCanvasDpr(renderWidth, renderHeight, 1)
          : undefined,
        selection: isEditing ? selection : null,
        caretIndex: isEditing ? caretIndex : null,
        caretVisible: isEditing && caretVisible,
        style: textAdvancedStyleFromNode(paintNode),
        gradientNode: paintNode,
        mediaFill,
        prepared,
      });
      const fresh = useEditorStore.getState().nodes[paintNode.id];
      const rotateSt = useEditorStore.getState();
      const rotateLocked =
        isRotateGeometryLockActive(rotateSt) &&
        rotateGeomSnapshotForNode(rotateSt, paintNode.id) != null;
      if (fresh?.type === "text" && !rotateLocked && !screenSized) {
        const layoutPatch = textLayoutPatchForNode(fresh, fresh.content ?? "");
        if (
          layoutPatch &&
          (layoutPatch.width !== fresh.width || layoutPatch.height !== fresh.height)
        ) {
          useEditorStore.getState().updateNodeStyle(paintNode.id, layoutPatch, { skipHistory: true });
        }
      }
    };

    void Promise.all([
      ensureFontFamilyLoaded(typo.fontFamily),
      loadTextMediaFill(paintNode, assets),
    ]).then(([, mediaFill]) => {
      paint(mediaFill);
    });

    return () => {
      alive = false;
    };
  }, [
    model,
    isEditing,
    selection,
    caretIndex,
    caretVisible,
    zoom,
    paintNode,
    canvasColorMode,
    assets,
    textLayoutEpoch,
    contentScaleX,
    contentScaleY,
  ]);

  const localFromEvent = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isEditing || !model) return;
      e.stopPropagation();
      e.preventDefault();
      const { x, y } = localFromEvent(e);
      dragRef.current = { active: true, extend: e.shiftKey };
      dispatchTextEditPointerDown(node.id, x, y, e.shiftKey);
      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    },
    [isEditing, model, localFromEvent, node.id],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d?.active) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      dispatchTextEditPointerDrag(node.id, e.clientX - rect.left, e.clientY - rect.top);
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [node.id]);

  if (!model) return null;

  return (
    <canvas
      ref={canvasRef}
      data-text-anchor={node.id}
      className={cn("block h-full w-full", className)}
      style={{
        pointerEvents: isEditing ? "auto" : "none",
        imageRendering: "auto",
      }}
      onPointerDown={handlePointerDown}
      aria-hidden={!isEditing}
    />
  );
}

export { getCursorPositionFromPoint };
