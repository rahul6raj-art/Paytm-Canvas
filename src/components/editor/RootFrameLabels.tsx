"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCanvasChromeForeground } from "@/hooks/useCanvasChromeForeground";
import type { CanvasChromeForeground } from "@/lib/canvasForeground";
import { prepareAltDragDuplicate } from "@/lib/canvasAltDrag";
import { beginCanvasNodeDrag } from "@/lib/canvasNodeDrag";
import {
  canCanvasObjectDrag,
  isCanvasSelectTool,
} from "@/lib/canvasInteractionGuards";
import { CANVAS_VISUAL, screenPxToWorld } from "@/lib/canvasVisual";
import { getRenderedWorldTopLeft } from "@/lib/editorGraph";
import { releaseFieldFocusForCanvas } from "@/lib/editorKeyboardFocus";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCanvasToWorld } from "./CanvasToWorldContext";

type RootFrameLabelsProps = {
  rootIds: string[];
};

export function RootFrameLabels({ rootIds }: RootFrameLabelsProps) {
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const zoom = useEditorStore((s) => s.zoom);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const layerRenameId = useEditorStore((s) => s.layerRenameId);
  const setLayerRenameId = useEditorStore((s) => s.setLayerRenameId);
  const renameNode = useEditorStore((s) => s.renameNode);
  const chrome = useCanvasChromeForeground();

  const labelOffset = screenPxToWorld(18, zoom);
  const labelFontSize = screenPxToWorld(11, zoom);

  return (
    <>
      {rootIds.map((rid) => {
        const node = nodes[rid];
        if (!node || node.type !== "frame" || !node.visible) return null;

        const selected = selectedIds.includes(rid);
        const renaming = layerRenameId === rid;

        const origin = getRenderedWorldTopLeft(rid, nodes, childOrder);

        return (
          <FrameLabel
            key={rid}
            frameId={rid}
            name={node.name}
            left={origin.x}
            top={origin.y - labelOffset}
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
  const createInstance = useEditorStore((s) => s.createInstance);
  const node = useEditorStore((s) => s.nodes[frameId]);
  const clientToWorld = useCanvasToWorld();

  const onLabelPointerDown = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      if (renaming || !node?.visible) return;
      e.stopPropagation();
      if (e.button === 0) releaseFieldFocusForCanvas();

      if (editorMode === "inspect") {
        if (tool === "comment" || tool === "pen" || tool === "pencil" || e.button === 1) return;
        select(frameId, e.shiftKey);
        return;
      }

      if (locked) {
        if (isCanvasSelectTool()) select(frameId, e.shiftKey);
        return;
      }

      if (tool === "comment" || tool === "pen" || tool === "pencil" || e.button === 1) return;

      if (tool !== "move" && tool !== "frame") {
        select(frameId, e.shiftKey);
        return;
      }

      select(frameId, e.shiftKey);

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
      });
    },
    [
      renaming,
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
      className="pointer-events-auto absolute z-20 max-w-[min(100%,320px)]"
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
