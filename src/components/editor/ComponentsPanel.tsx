"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Component, Package, Plus, Search, X } from "lucide-react";
import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import {
  canCreateComponentFromSelection,
  filterComponentLibraryGroups,
  flattenComponentLibraryGroups,
  groupComponentMasters,
  listComponentMasters,
  type ComponentLibraryGroup,
} from "@/lib/componentModel";
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

function variantSubtitle(node: EditorNode): string | null {
  const vp = node.variantProperties;
  if (!vp || Object.keys(vp).length === 0) return null;
  return Object.entries(vp)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}

function ComponentCard({
  master,
  group,
  active,
  onActivate,
  onDragStart,
}: {
  master: EditorNode;
  group: ComponentLibraryGroup;
  active: boolean;
  onActivate: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const select = useEditorStore((s) => s.select);
  const subtitle = variantSubtitle(master);
  const showGroupContext = group.variants.length > 1;

  return (
    <button
      type="button"
      draggable
      data-component-id={master.id}
      onDragStart={onDragStart}
      onClick={onActivate}
      onDoubleClick={(e) => {
        e.preventDefault();
        select(master.id, false);
      }}
      className={cn(
        "w-full rounded-md border p-2 text-left transition-colors",
        active
          ? "border-accent/50 bg-accent/10 ring-1 ring-accent/30"
          : "border-white/[0.08] bg-[#2c2c2c] hover:border-violet-500/35 hover:bg-violet-500/10",
      )}
    >
      <ComponentPreview width={master.width} height={master.height} />
      <div className="mt-1.5 flex items-center gap-1.5">
        <Component className="h-3.5 w-3.5 shrink-0 text-violet-300" strokeWidth={1.75} />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#ececec]">
          {showGroupContext ? master.name : group.label}
        </span>
        {showGroupContext ? (
          <span className="shrink-0 rounded bg-white/[0.06] px-1 py-0.5 text-[9px] font-semibold uppercase text-[#9a9a9a]">
            Var
          </span>
        ) : null}
      </div>
      {subtitle ? (
        <p className="mt-0.5 truncate text-[10px] text-[#8c8c8c]" title={subtitle}>
          {subtitle}
        </p>
      ) : null}
      <p className="mt-0.5 truncate font-mono text-[10px] text-[#737373]">
        {Math.round(master.width)}×{Math.round(master.height)}
      </p>
    </button>
  );
}

export function ComponentsPanel() {
  const leftTab = useEditorStore((s) => s.leftTab);
  const nodes = useEditorStore((s) => s.nodes);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const createComponentFromSelection = useEditorStore((s) => s.createComponentFromSelection);
  const setPlacingComponentMasterId = useEditorStore((s) => s.setPlacingComponentMasterId);
  const setTool = useEditorStore((s) => s.setTool);

  const [query, setQuery] = useState("");
  const [activeMasterId, setActiveMasterId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const masters = useMemo(() => listComponentMasters(nodes), [nodes]);
  const groups = useMemo(() => groupComponentMasters(masters), [masters]);
  const filteredGroups = useMemo(
    () => filterComponentLibraryGroups(groups, query),
    [groups, query],
  );
  const flatFiltered = useMemo(
    () => flattenComponentLibraryGroups(filteredGroups),
    [filteredGroups],
  );

  const canCreate = useMemo(
    () => canCreateComponentFromSelection(selectedIds, nodes),
    [selectedIds, nodes],
  );

  const startPlacement = useCallback(
    (masterId: string) => {
      setTool("move");
      setPlacingComponentMasterId(masterId);
      setActiveMasterId(masterId);
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

  useEffect(() => {
    if (leftTab !== "components") return;
    const t = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [leftTab]);

  useEffect(() => {
    if (flatFiltered.length === 0) {
      setActiveMasterId(null);
      return;
    }
    if (!activeMasterId || !flatFiltered.some((m) => m.id === activeMasterId)) {
      setActiveMasterId(flatFiltered[0]!.id);
    }
  }, [flatFiltered, activeMasterId]);

  const moveActive = (delta: number) => {
    if (flatFiltered.length === 0) return;
    const idx = flatFiltered.findIndex((m) => m.id === activeMasterId);
    const next = idx < 0 ? 0 : (idx + delta + flatFiltered.length) % flatFiltered.length;
    const id = flatFiltered[next]!.id;
    setActiveMasterId(id);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-component-id="${id}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
      return;
    }
    if (e.key === "Enter" && activeMasterId) {
      e.preventDefault();
      startPlacement(activeMasterId);
      return;
    }
    if (e.key === "Escape" && query) {
      e.preventDefault();
      setQuery("");
    }
  };

  const totalCount = masters.length;
  const resultCount = flatFiltered.length;
  const searching = query.trim().length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-white/[0.06] p-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6b6b6b]"
            strokeWidth={2}
            aria-hidden
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search components"
            aria-label="Search components"
            className="h-8 w-full rounded-md border border-white/[0.1] bg-[#262626] py-0 pl-7 pr-7 text-[12px] text-[#f5f5f5] placeholder:text-[#6b6b6b] focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-[#8c8c8c] hover:bg-white/[0.06] hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : null}
        </div>
        {searching ? (
          <p className="mt-1.5 px-0.5 text-[10px] text-[#6b6b6b]">
            {resultCount === 0
              ? "No components match your search"
              : `${resultCount} of ${totalCount} component${totalCount === 1 ? "" : "s"}`}
          </p>
        ) : totalCount > 0 ? (
          <p className="mt-1.5 px-0.5 text-[10px] text-[#6b6b6b]">
            {totalCount} component{totalCount === 1 ? "" : "s"} in this file
          </p>
        ) : null}

        <button
          type="button"
          disabled={!canCreate}
          onClick={() => createComponentFromSelection()}
          className={cn(
            "mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-md border text-[11px] font-semibold transition-colors",
            canCreate
              ? "border-violet-500/40 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25"
              : "cursor-not-allowed border-white/[0.06] text-[#5c5c5c]",
          )}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Create component
        </button>
        <p className="mt-1.5 px-0.5 text-[10px] leading-relaxed text-[#6b6b6b]">
          Select layers, then create. Use{" "}
          <span className="font-medium text-[#8c8c8c]">⌘⌥K</span> · ↑↓ to browse · Enter to place.
        </p>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-2">
        {totalCount === 0 ? (
          <div className="mx-1 rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] px-3 py-8 text-center">
            <Package className="mx-auto mb-2 h-8 w-8 text-[#4a4a4a]" strokeWidth={1.25} />
            <p className="text-[12px] font-medium text-[#9a9a9a]">No components yet</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#6b6b6b]">
              Components you create appear here. Search by name or variant, then drag or click to place
              instances.
            </p>
          </div>
        ) : searching && resultCount === 0 ? (
          <div className="mx-1 rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] px-3 py-6 text-center">
            <Search className="mx-auto mb-2 h-7 w-7 text-[#4a4a4a]" strokeWidth={1.25} />
            <p className="text-[12px] font-medium text-[#9a9a9a]">No results</p>
            <p className="mt-1 text-[11px] text-[#6b6b6b]">Try another name or variant label.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredGroups.map((group) => (
              <div key={group.id}>
                {group.variants.length > 1 ? (
                  <p className="mb-1 truncate px-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]">
                    {group.label}
                    <span className="ml-1 font-normal normal-case text-[#5c5c5c]">
                      · {group.variants.length} variants
                    </span>
                  </p>
                ) : null}
                <ul className={cn("space-y-1.5", group.variants.length > 1 && "pl-1")}>
                  {group.variants.map((m) => (
                    <li key={m.id}>
                      <ComponentCard
                        master={m}
                        group={group}
                        active={activeMasterId === m.id}
                        onActivate={() => startPlacement(m.id)}
                        onDragStart={onDragStart(m.id, m.name)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {resultCount > 0 ? (
          <p className="mt-3 px-1 text-[10px] leading-relaxed text-[#5c5c5c]">
            Drag onto the canvas, click to place with the cursor, or double-click a master to select it on
            the canvas.
          </p>
        ) : null}
      </div>
    </div>
  );
}
