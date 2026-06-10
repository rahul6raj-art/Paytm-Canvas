"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { mergeInstanceOverrides } from "@/lib/componentModel";
import { resolveNodeWithDesignTokens } from "@/lib/designTokens";
import { getCursorPositionFromPoint, moveCaretWithArrow } from "@/lib/text/textCursor";
import { textLayoutPatchForNode } from "@/lib/text/textLayout";
import { layoutDisplayText, textAdvancedStyleFromNode } from "@/lib/text/textAdvancedStyle";
import {
  textInnerWidth,
  toTextNodeModel,
  textTypoFromModel,
  wrapWidthForResizeMode,
} from "@/lib/text/textNodeModel";
import { useEditorStore } from "@/stores/useEditorStore";

type TextEditPortalProps = {
  nodeId: string;
};

/**
 * Hidden textarea captures keyboard/IME; TextCanvasView renders text, caret, and selection.
 * Flow: double-click → setEditingTextId → portal mounts → textarea focused → edits sync to store.
 */
export function TextEditPortal({ nodeId }: TextEditPortalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const nodes = useEditorStore((s) => s.nodes);
  const designTokens = useEditorStore((s) => s.designTokens);
  const selection = useEditorStore((s) => s.textEditSelection);
  const updateNodeStyle = useEditorStore((s) => s.updateNodeStyle);
  const setEditingTextId = useEditorStore((s) => s.setEditingTextId);
  const setTextEditSelection = useEditorStore((s) => s.setTextEditSelection);

  const nodeRaw = nodes[nodeId];
  const node =
    nodeRaw?.type === "text"
      ? resolveNodeWithDesignTokens(mergeInstanceOverrides(nodeRaw, nodes), designTokens)
      : null;

  const syncTextareaSelection = useCallback(
    (anchor: number, focus: number) => {
      const el = textareaRef.current;
      if (!el) return;
      if (el.selectionStart === anchor && el.selectionEnd === focus) return;
      el.setSelectionRange(anchor, focus);
    },
    [],
  );

  const applyContent = useCallback(
    (content: string, anchor: number, focus: number) => {
      if (!nodeRaw || nodeRaw.type !== "text") return;
      const layoutPatch = textLayoutPatchForNode(nodeRaw, content);
      updateNodeStyle(nodeId, { content, ...layoutPatch }, { skipHistory: true });
      setTextEditSelection(anchor, focus);
      syncTextareaSelection(anchor, focus);
    },
    [nodeRaw, nodeId, updateNodeStyle, setTextEditSelection, syncTextareaSelection],
  );

  const finishEdit = useCallback(() => {
    setEditingTextId(null);
  }, [setEditingTextId]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el || !node) return;
    el.focus();
    const len = node.content?.length ?? 0;
    const anchor = selection?.anchor ?? len;
    const focus = selection?.focus ?? len;
    syncTextareaSelection(anchor, focus);
  }, [nodeId, node, selection?.anchor, selection?.focus, syncTextareaSelection]);

  const handleCanvasPointer = useCallback(
    (localX: number, localY: number, extend: boolean) => {
      if (!node) return;
      const model = toTextNodeModel(node, true);
      if (!model) return;
      const index = getCursorPositionFromPoint(localX, localY, model);
      if (extend && selection) {
        setTextEditSelection(selection.anchor, index);
        syncTextareaSelection(selection.anchor, index);
      } else {
        setTextEditSelection(index, index);
        syncTextareaSelection(index, index);
      }
      textareaRef.current?.focus();
    },
    [node, selection, setTextEditSelection, syncTextareaSelection],
  );

  const handleCanvasDrag = useCallback(
    (localX: number, localY: number) => {
      if (!node || !selection) return;
      const model = toTextNodeModel(node, true);
      if (!model) return;
      const index = getCursorPositionFromPoint(localX, localY, model);
      setTextEditSelection(selection.anchor, index);
      syncTextareaSelection(selection.anchor, index);
    },
    [node, selection, setTextEditSelection, syncTextareaSelection],
  );

  useEffect(() => {
    const onDown = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        nodeId: string;
        x: number;
        y: number;
        extend: boolean;
      };
      if (detail.nodeId !== nodeId) return;
      handleCanvasPointer(detail.x, detail.y, detail.extend);
    };
    const onDrag = (e: Event) => {
      const detail = (e as CustomEvent).detail as { nodeId: string; x: number; y: number };
      if (detail.nodeId !== nodeId) return;
      handleCanvasDrag(detail.x, detail.y);
    };
    window.addEventListener("pc-text-edit-down", onDown);
    window.addEventListener("pc-text-edit-drag", onDrag);
    return () => {
      window.removeEventListener("pc-text-edit-down", onDown);
      window.removeEventListener("pc-text-edit-drag", onDrag);
    };
  }, [nodeId, handleCanvasPointer, handleCanvasDrag]);

  useEffect(() => {
    const onPointerDownOutside = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(`[data-text-editor="${nodeId}"]`)) return;
      if (t?.closest(`[data-text-anchor="${nodeId}"]`)) return;
      if (useEditorStore.getState().editingTextId !== nodeId) return;
      finishEdit();
    };
    window.addEventListener("pointerdown", onPointerDownOutside, true);
    return () => window.removeEventListener("pointerdown", onPointerDownOutside, true);
  }, [nodeId, finishEdit]);

  if (!node || nodeRaw?.type !== "text") return null;

  const editor = (
    <textarea
        ref={textareaRef}
        data-text-editor={nodeId}
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none fixed opacity-0"
        style={{ left: -9999, top: 0, width: 1, height: 1, resize: "none" }}
        value={node.content ?? ""}
        onChange={(ev) => {
          const v = ev.target.value;
          const a = ev.target.selectionStart ?? v.length;
          const f = ev.target.selectionEnd ?? v.length;
          applyContent(v, a, f);
        }}
        onSelect={(ev) => {
          const t = ev.target as HTMLTextAreaElement;
          setTextEditSelection(t.selectionStart, t.selectionEnd);
        }}
        onKeyDown={(ev) => {
          ev.stopPropagation();
          const text = node.content ?? "";
          const anchor = selection?.anchor ?? text.length;
          const focus = selection?.focus ?? text.length;

          if (ev.key === "Escape") {
            ev.preventDefault();
            finishEdit();
            return;
          }

          if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "a") {
            ev.preventDefault();
            setTextEditSelection(0, text.length);
            syncTextareaSelection(0, text.length);
            return;
          }

          if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "b") {
            ev.preventDefault();
            const nextWeight = (node.fontWeight ?? 500) >= 600 ? 400 : 700;
            updateNodeStyle(nodeId, { fontWeight: nextWeight }, { skipHistory: true });
            return;
          }

          if (
            ev.key === "ArrowLeft" ||
            ev.key === "ArrowRight" ||
            ev.key === "ArrowUp" ||
            ev.key === "ArrowDown"
          ) {
            ev.preventDefault();
            const model = toTextNodeModel(node, true);
            if (!model) return;
            const typo = textTypoFromModel(model);
            const wrapWidth = wrapWidthForResizeMode(model.width, model.textResizeMode);
            const innerW = textInnerWidth(model.width);
            const style = textAdvancedStyleFromNode(node);
            const { layout } = layoutDisplayText(text, wrapWidth, node);
            const next = moveCaretWithArrow(
              ev.key,
              focus,
              text,
              layout,
              typo,
              innerW,
              model.textAlign,
              style,
            );
            const start = ev.shiftKey ? anchor : next;
            setTextEditSelection(start, next);
            syncTextareaSelection(start, next);
          }
        }}
      />
  );

  return createPortal(editor, document.body);
}

export function dispatchTextEditPointerDown(
  nodeId: string,
  x: number,
  y: number,
  extend: boolean,
): void {
  window.dispatchEvent(
    new CustomEvent("pc-text-edit-down", { detail: { nodeId, x, y, extend } }),
  );
}

export function dispatchTextEditPointerDrag(nodeId: string, x: number, y: number): void {
  window.dispatchEvent(new CustomEvent("pc-text-edit-drag", { detail: { nodeId, x, y } }));
}
