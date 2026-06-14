"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cancelCanvasMarqueeSession } from "@/lib/canvasMarqueeSession";
import { useCanvasChromeForeground } from "@/hooks/useCanvasChromeForeground";
import type { CanvasChromeForeground } from "@/lib/canvasForeground";
import { prepareAltDragDuplicate } from "@/lib/canvasAltDrag";
import { beginCanvasNodeDrag } from "@/lib/canvasNodeDrag";
import {
  canCanvasObjectDrag,
  isCanvasSelectTool,
} from "@/lib/canvasInteractionGuards";
import { screenPxToOverlay, worldPointToOverlay } from "@/lib/canvasOverlaySpace";
import {
  CANVAS_FRAME_LABEL_FONT_SCREEN_PX,
  CANVAS_FRAME_LABEL_OFFSET_SCREEN_PX,
  CANVAS_VISUAL,
} from "@/lib/canvasVisual";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  getDragPreviewOffsetForIds,
  getDragPreviewSnapshot,
  subscribeDragPreview,
} from "@/lib/canvasEphemeralTransform";
import { getRenderedWorldTopLeft } from "@/lib/editorGraph";
import { applyMoveToolPointerSelection, isAdditiveSelectionClick } from "@/lib/containerSelection";
import { releaseFieldFocusForCanvas } from "@/lib/editorKeyboardFocus";
import { cn } from "@/lib/utils";
import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { useCanvasToWorld } from "./CanvasToWorldContext";
import { useCanvasOverlaySpace } from "./useCanvasOverlaySpace";

type RootFrameLabelsProps = {
  rootIds: string[];
};

/** Canvas titles for page roots and top-level artboards only (not every nested auto-layout frame). */
function frameLabelIds(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string[] {
  const canvasRoots = new Set(childOrder[EDITOR_ROOT_KEY] ?? []);
  const artboardIds = new Set<string>();
  for (const rootId of canvasRoots) {
    for (const childId of childOrder[rootId] ?? []) {
      artboardIds.add(childId);
    }
  }

  return Object.values(nodes)
    .filter((n) => {
      if (n.type !== "frame" || !n.visible) return false;
      if (canvasRoots.has(n.id)) return true;
      if (artboardIds.has(n.id)) {
        if (n.codeJsxTag || n.codeClassName) return false;
        return n.width >= 200 && n.height >= 120;
      }
      return false;
    })
    .map((n) => n.id);
}

export function RootFrameLabels({ rootIds }: RootFrameLabelsProps) {
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const layerRenameId = useEditorStore((s) => s.layerRenameId);
  const setLayerRenameId = useEditorStore((s) => s.setLayerRenameId);
  const renameNode = useEditorStore((s) => s.renameNode);
  const chrome = useCanvasChromeForeground();
  const overlay = useCanvasOverlaySpace();
  const dragPreview = useSyncExternalStore(subscribeDragPreview, getDragPreviewSnapshot, () => null);
  void dragPreview;

  const labelOffset = screenPxToOverlay(CANVAS_FRAME_LABEL_OFFSET_SCREEN_PX, overlay);
  const labelFontSize = screenPxToOverlay(CANVAS_FRAME_LABEL_FONT_SCREEN_PX, overlay);
  const labelIds = useMemo(() => frameLabelIds(nodes, childOrder), [nodes, childOrder]);
  const orderedLabelIds = useMemo(() => {
    const rootSet = new Set(rootIds);
    const roots = rootIds.filter((id) => nodes[id]?.type === "frame" && nodes[id]?.visible);
    const nested = labelIds.filter((id) => !rootSet.has(id));
    return [...roots, ...nested];
  }, [rootIds, labelIds, nodes]);

  return (
    <>
      {orderedLabelIds.map((rid) => {
        const node = nodes[rid];
        if (!node || node.type !== "frame" || !node.visible) return null;

        const selected = selectedIds.includes(rid);
        const renaming = layerRenameId === rid;

        const origin = getRenderedWorldTopLeft(rid, nodes, childOrder);
        const dragOffset = getDragPreviewOffsetForIds([rid]);
        const labelPos = worldPointToOverlay(
          origin.x + dragOffset.dx,
          origin.y + dragOffset.dy,
          overlay,
        );

        return (
          <FrameLabel
            key={rid}
            frameId={rid}
            name={node.name}
            left={labelPos.x}
            top={labelPos.y - labelOffset}
            fontSize={labelFontSize}
            selected={selected}
            locked={node.locked}
            renaming={renaming}
            onStartRename={() => setLayerRenameId(rid)}
            onCommitRename={(name) => {
              renameNode(rid, name);
              setLayerRenameId(null);
            }}
            onCancelRename={() => setLayerRenameId(null)}
            chrome={chrome}
          />
        );
      })}
    </>
  );
}

function FrameLabel({
  frameId,
  name,
  left,
  top,
  fontSize,
  selected,
  locked,
  renaming,
  onStartRename,
  onCommitRename,
  onCancelRename,
  chrome,
}: {
  frameId: string;
  name: string;
  left: number;
  top: number;
  fontSize: number;
  selected: boolean;
  locked: boolean;
  renaming: boolean;
  chrome: CanvasChromeForeground;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(name);
  const editorMode = useEditorStore((s) => s.editorMode);
  const tool = useEditorStore((s) => s.tool);
  const select = useEditorStore((s) => s.select);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const createInstance = useEditorStore((s) => s.createInstance);
  const node = useEditorStore((s) => s.nodes[frameId]);
  const clientToWorld = useCanvasToWorld();

  const onLabelPointerDown = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      if (renaming || !node?.visible) return;
      e.preventDefault();
      e.stopPropagation();
      cancelCanvasMarqueeSession();
      if (e.button === 0) releaseFieldFocusForCanvas();

      if (editorMode === "inspect") {
        if (tool === "comment" || tool === "pen" || tool === "pencil" || e.button === 1) return;
        select(frameId, isAdditiveSelectionClick(e));
        return;
      }

      if (locked) {
        if (isCanvasSelectTool()) select(frameId, isAdditiveSelectionClick(e));
        return;
      }

      if (tool === "comment" || tool === "pen" || tool === "pencil" || e.button === 1) return;

      if (tool !== "move" && tool !== "frame") {
        select(frameId, isAdditiveSelectionClick(e));
        return;
      }

      const additive = isAdditiveSelectionClick(e);
      applyMoveToolPointerSelection(frameId, selectedIds, additive, select);

      if (additive) return;

      if (!clientToWorld) return;

      if (
        e.button === 0 &&
        e.altKey &&
        node.isComponent &&
        tool === "move" &&
        canCanvasObjectDrag()
      ) {
        const w = clientToWorld(e.clientX, e.clientY);
        createInstance(frameId, w.x, w.y);
        const newId = useEditorStore.getState().selectedIds[0];
        if (newId) {
          beginCanvasNodeDrag({
            nodeId: newId,
            pointerId: e.pointerId,
            clientX: e.clientX,
            clientY: e.clientY,
            clientToWorld,
            captureTarget: e.currentTarget,
          });
        }
        return;
      }

      if (e.button !== 0 || !canCanvasObjectDrag()) return;

      if (e.altKey && !prepareAltDragDuplicate(frameId)) return;

      beginCanvasNodeDrag({
        nodeId: frameId,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        clientToWorld,
        captureTarget: e.currentTarget,
        fromAltDragDuplicate: e.altKey,
      });
    },
    [
      renaming,
      selectedIds,
      node,
      editorMode,
      tool,
      locked,
      frameId,
      select,
      clientToWorld,
      createInstance,
    ],
  );

  useEffect(() => {
    if (renaming) setDraft(name);
  }, [renaming, name]);

  useEffect(() => {
    if (!renaming) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [renaming]);

  const commit = () => {
    const next = draft.trim();
    if (next) onCommitRename(next);
    else onCancelRename();
  };

  return (
    <div
      className="pointer-events-auto absolute z-[8] max-w-[320px]"
      style={{ left, top }}
      data-frame-label={frameId}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {renaming && !locked ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          aria-label="Frame name"
          className="m-0 w-full min-w-[80px] max-w-[320px] rounded border px-1 py-0.5 font-medium leading-none shadow-sm outline-none ring-1 ring-[rgba(13,153,255,0.35)]"
          style={{
            fontSize,
            backgroundColor: chrome.renameInputBg,
            color: chrome.renameInputText,
            borderColor: chrome.renameInputBorder,
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onCancelRename();
            }
          }}
        />
      ) : (
        <span
          role="button"
          tabIndex={locked ? -1 : 0}
          title={
            locked
              ? name
              : `${name} — drag to move, double-click to rename`
          }
          onPointerDown={onLabelPointerDown}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (locked) return;
            onStartRename();
          }}
          onKeyDown={(e) => {
            if (locked) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onStartRename();
            }
          }}
          className={cn(
            "block truncate font-medium leading-none select-none",
            locked
              ? "cursor-default"
              : tool === "move" || tool === "frame"
                ? "cursor-grab active:cursor-grabbing"
                : "cursor-pointer",
          )}
          style={{
            fontSize,
            color: selected ? CANVAS_VISUAL.selection : chrome.frameLabel,
          }}
        >
          {name}
        </span>
      )}
    </div>
  );
}
