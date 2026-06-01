"use client";

import { useCallback, useMemo } from "react";
import { Component, Package, Plus } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { canCreateComponentFromSelection, listComponentMasters } from "@/lib/componentModel";
import { cn } from "@/lib/utils";

function ComponentPreview({ width, height }: { width: number; height: number }) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const ar = w / h;
  const boxW = ar >= 1 ? 56 : 56 * ar;
  const boxH = ar >= 1 ? 56 / ar : 56;
  return (
    <div
      className="flex h-14 w-full items-center justify-center rounded border border-violet-500/25 bg-violet-500/[0.08]"
      aria-hidden
    >
      <div
        className="rounded-sm border border-violet-400/40 bg-violet-400/20"
        style={{ width: boxW, height: boxH }}
      />
    </div>
  );
}

export function ComponentsPanel() {
  const nodes = useEditorStore((s) => s.nodes);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const createComponentFromSelection = useEditorStore((s) => s.createComponentFromSelection);
  const setPlacingComponentMasterId = useEditorStore((s) => s.setPlacingComponentMasterId);
  const setTool = useEditorStore((s) => s.setTool);
  const select = useEditorStore((s) => s.select);

  const masters = useMemo(() => listComponentMasters(nodes), [nodes]);
  const canCreate = useMemo(
    () => canCreateComponentFromSelection(selectedIds, nodes),
    [selectedIds, nodes],
  );

  const startPlacement = useCallback(
    (masterId: string) => {
      setTool("move");
      setPlacingComponentMasterId(masterId);
    },
    [setPlacingComponentMasterId, setTool],
  );

  const onDragStart = (masterId: string, name: string) => (e: React.DragEvent) => {
    e.dataTransfer.setData("application/x-pc-component", masterId);
    e.dataTransfer.effectAllowed = "copy";
    const ghost = document.createElement("div");
    ghost.className =
      "rounded border border-violet-400/50 bg-violet-500/20 px-2 py-1 text-[11px] font-medium text-violet-100 shadow-lg";
    ghost.textContent = name;
    ghost.style.position = "absolute";
    ghost.style.top = "-1000px";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    requestAnimationFrame(() => ghost.remove());
  };

  return (
    <div className="thin-scroll flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
      <div className="mb-2 px-1">
        <button
          type="button"
          disabled={!canCreate}
          onClick={() => createComponentFromSelection()}
          className={cn(
            "flex h-8 w-full items-center justify-center gap-1.5 rounded-md border text-[11px] font-semibold transition-colors",
            canCreate
              ? "border-violet-500/40 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25"
              : "cursor-not-allowed border-white/[0.06] text-[#5c5c5c]",
          )}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Create component
        </button>
        <p className="mt-1.5 text-[10px] leading-relaxed text-[#6b6b6b]">
          Select layers on the canvas, then create a reusable component. Use{" "}
          <span className="font-medium text-[#8c8c8c]">⌘⌥K</span> or the inspector.
        </p>
      </div>

      {masters.length === 0 ? (
        <div className="mx-1 rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] px-3 py-8 text-center">
          <Package className="mx-auto mb-2 h-8 w-8 text-[#4a4a4a]" strokeWidth={1.25} />
          <p className="text-[12px] font-medium text-[#9a9a9a]">No components yet</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#6b6b6b]">
            Components you create appear here. Drag them onto the canvas or click to place instances.
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {masters.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                draggable
                onDragStart={onDragStart(m.id, m.name)}
                onClick={() => startPlacement(m.id)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  select(m.id, false);
                }}
                className={cn(
                  "w-full rounded-md border border-white/[0.08] bg-[#2c2c2c] p-2 text-left transition-colors",
                  "hover:border-violet-500/35 hover:bg-violet-500/10",
                )}
              >
                <ComponentPreview width={m.width} height={m.height} />
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Component className="h-3.5 w-3.5 shrink-0 text-violet-300" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#ececec]">
                    {m.name}
                  </span>
                  {m.variantProperties && Object.keys(m.variantProperties).length > 0 ? (
                    <span className="shrink-0 rounded bg-white/[0.06] px-1 py-0.5 text-[9px] font-semibold uppercase text-[#9a9a9a]">
                      Var
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate font-mono text-[10px] text-[#737373]">
                  {Math.round(m.width)}×{Math.round(m.height)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {masters.length > 0 ? (
        <p className="mt-3 px-1 text-[10px] leading-relaxed text-[#5c5c5c]">
          Drag onto the canvas to drop an instance, click to place with the cursor, or Option-drag a component on the
          canvas to spawn an instance.
        </p>
      ) : null}
    </div>
  );
}
