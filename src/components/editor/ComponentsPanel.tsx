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
import { trySelectAllPanelField } from "@/lib/panelFieldKeyboard";
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
          : "border-app-border bg-app-panel hover:border-violet-500/35 hover:bg-violet-500/10",
      )}
    >
      <ComponentPreview width={master.width} height={master.height} />
      <div className="mt-1.5 flex items-center gap-1.5">
        <Component className="h-3.5 w-3.5 shrink-0 text-violet-300" strokeWidth={1.75} />
        <span className="min-w-0 flex-1 truncate text-ui font-medium text-app-fg">
          {showGroupContext ? master.name : group.label}
        </span>
        {showGroupContext ? (
          <span className="shrink-0 rounded bg-app-hover px-1 py-0.5 text-ui font-semibold uppercase text-app-muted">
            Var
          </span>
        ) : null}
      </div>
      {subtitle ? (
        <p className="mt-0.5 truncate text-ui text-app-subtle" title={subtitle}>
          {subtitle}
        </p>
      ) : null}
      <p className="mt-0.5 truncate font-mono text-ui text-[#737373]">
        {Math.round(master.width)}×{Math.round(master.height)}
      </p>
    </button>
  );
}

export function ComponentsPanel({ embedded = false }: { embedded?: boolean } = {}) {
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
      "rounded border border-violet-400/50 bg-violet-500/20 px-2 py-1 text-ui font-medium text-violet-100 shadow-lg";
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
    e.stopPropagation();
    if (trySelectAllPanelField(e)) return;
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
      <div className={cn("shrink-0 p-2", !embedded && "border-b border-app-panel-edge")}>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-app-subtle"
            strokeWidth={2}
            aria-hidden
          />
          <input
            ref={searchRef}
            type="text"
            role="searchbox"
            data-sidebar-typing-field
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search components"
            aria-label="Search components"
            className="h-8 w-full rounded-md border border-app-border bg-app-field py-0 pl-7 pr-7 text-ui text-app-field-fg placeholder:text-app-subtle focus-visible:border-[hsl(var(--app-fg)/0.5)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--app-fg)/0.25)]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-app-subtle hover:bg-app-hover hover:text-app-fg"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : null}
        </div>
        {searching ? (
          <p className="mt-1.5 px-0.5 text-ui text-app-subtle">
            {resultCount === 0
              ? "No components match your search"
              : `${resultCount} of ${totalCount} component${totalCount === 1 ? "" : "s"}`}
          </p>
        ) : totalCount > 0 ? (
          <p className="mt-1.5 px-0.5 text-ui text-app-subtle">
            {totalCount} component{totalCount === 1 ? "" : "s"} in this file
          </p>
        ) : null}

        <button
          type="button"
          disabled={!canCreate}
          onClick={() => createComponentFromSelection()}
          className={cn(
            "mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-md border text-ui font-semibold transition-colors",
            canCreate
              ? "border-violet-500/40 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25"
              : "cursor-not-allowed border-app-border-subtle text-app-subtle",
          )}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Create component
        </button>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-2">
        {totalCount === 0 ? (
          <div className="mx-1 px-3 py-8 text-center">
            <Package className="mx-auto mb-2 h-8 w-8 text-[#4a4a4a]" strokeWidth={1.25} />
            <p className="text-ui font-medium text-app-muted">No components yet</p>
            <p className="mt-1 text-ui leading-relaxed text-app-subtle">
              Components you create appear here. Search by name or variant, then drag or click to place
              instances.
            </p>
          </div>
        ) : searching && resultCount === 0 ? (
          <div className="mx-1 rounded-lg border border-dashed border-app-border bg-white/[0.02] px-3 py-6 text-center">
            <Search className="mx-auto mb-2 h-7 w-7 text-[#4a4a4a]" strokeWidth={1.25} />
            <p className="text-ui font-medium text-app-muted">No results</p>
            <p className="mt-1 text-ui text-app-subtle">Try another name or variant label.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredGroups.map((group) => (
              <div key={group.id}>
                {group.variants.length > 1 ? (
                  <p className="mb-1 truncate px-0.5 section-heading">
                    {group.label}
                    <span className="ml-1 font-normal normal-case text-app-subtle">
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
          <p className="mt-3 px-1 text-ui leading-relaxed text-app-subtle">
            Drag onto the canvas, click to place with the cursor, or double-click a master to select it on
            the canvas.
          </p>
        ) : null}
      </div>
    </div>
  );
}
