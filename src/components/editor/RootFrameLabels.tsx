"use client";

import { useEffect, useRef, useState } from "react";
import { CANVAS_VISUAL, screenPxToWorld } from "@/lib/canvasVisual";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";

type RootFrameLabelsProps = {
  rootIds: string[];
};

export function RootFrameLabels({ rootIds }: RootFrameLabelsProps) {
  const nodes = useEditorStore((s) => s.nodes);
  const zoom = useEditorStore((s) => s.zoom);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const layerRenameId = useEditorStore((s) => s.layerRenameId);
  const setLayerRenameId = useEditorStore((s) => s.setLayerRenameId);
  const renameNode = useEditorStore((s) => s.renameNode);

  const labelOffset = screenPxToWorld(18, zoom);
  const labelFontSize = screenPxToWorld(11, zoom);

  return (
    <>
      {rootIds.map((rid) => {
        const node = nodes[rid];
        if (!node || node.type !== "frame" || !node.visible) return null;

        const selected = selectedIds.includes(rid);
        const renaming = layerRenameId === rid;

        return (
          <FrameLabel
            key={rid}
            frameId={rid}
            name={node.name}
            left={node.x}
            top={node.y - labelOffset}
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
}: {
  frameId: string;
  name: string;
  left: number;
  top: number;
  fontSize: number;
  selected: boolean;
  locked: boolean;
  renaming: boolean;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(name);

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
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {renaming && !locked ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          aria-label="Frame name"
          className="m-0 w-full min-w-[80px] max-w-[320px] rounded border border-[rgba(13,153,255,0.55)] bg-white px-1 py-0.5 font-medium leading-none text-[#111] shadow-sm outline-none ring-1 ring-[rgba(13,153,255,0.35)]"
          style={{ fontSize }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
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
          title={locked ? name : `${name} — double-click to rename`}
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
            "block cursor-default truncate font-medium leading-none select-none",
            !locked && "cursor-text",
          )}
          style={{
            fontSize,
            color: selected ? CANVAS_VISUAL.selection : CANVAS_VISUAL.frameLabel,
          }}
        >
          {name}
        </span>
      )}
    </div>
  );
}
