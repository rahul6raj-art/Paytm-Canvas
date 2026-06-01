"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  toTextNodeModel,
  textTypoFromModel,
  wrapWidthForResizeMode,
} from "@/lib/text/textNodeModel";
import { ensureFontFamilyLoaded } from "@/lib/fonts";
import { renderTextToCanvas } from "@/lib/text/textCanvasRender";
import { getCursorPositionFromPoint } from "@/lib/text/textCursor";
import {
  dispatchTextEditPointerDown,
  dispatchTextEditPointerDrag,
} from "./TextEditPortal";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";

type TextCanvasViewProps = {
  node: EditorNode;
  isEditing: boolean;
  selection: { anchor: number; focus: number } | null;
  className?: string;
};

/** Canvas-based text renderer (visual layer only — input comes from hidden textarea). */
export function TextCanvasView({
  node,
  isEditing,
  selection,
  className,
}: TextCanvasViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ active: boolean; extend: boolean } | null>(null);
  const [caretVisible, setCaretVisible] = useState(true);

  const zoom = useEditorStore((s) => s.zoom);
  const model = toTextNodeModel(node, isEditing);
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
    const typo = textTypoFromModel(model);
    const wrapWidth = wrapWidthForResizeMode(model.width, model.textResizeMode);

    void ensureFontFamilyLoaded(typo.fontFamily).then(() => {
      if (!alive || !canvasRef.current) return;
      renderTextToCanvas(canvasRef.current, {
        typo,
        text: model.text,
        width: model.width,
        height: model.height,
        textAlign: model.textAlign,
        wrapWidth,
        zoom,
        selection: isEditing ? selection : null,
        caretIndex: isEditing ? caretIndex : null,
        caretVisible: isEditing && caretVisible,
      });
    });

    return () => {
      alive = false;
    };
  }, [model, isEditing, selection, caretIndex, caretVisible, zoom]);

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
