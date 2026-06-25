"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Component, Grid3X3, LayoutList, Package, Plus, Search, X } from "lucide-react";
import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import {
  canCreateComponentFromSelection,
  filterComponentLibraryGroups,
  groupComponentMasters,
  primaryMasterForGroup,
  type ComponentLibraryGroup,
} from "@/lib/componentModel";
import {
  buildComponentFolderTree,
  componentDisplayName,
  localComponentMasters,
  localComponentPanelMasters,
  type ComponentFolderNode,
} from "@/lib/components/folders";
import { trySelectAllPanelField } from "@/lib/panelFieldKeyboard";
import { recordRecentComponent } from "@/lib/componentUx";
import { cn } from "@/lib/utils";

function ComponentPreview({
  width,
  height,
  compact = false,
}: {
  width: number;
  height: number;
  compact?: boolean;
}) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const ar = w / h;
  const max = compact ? 18 : 56;
  const boxW = ar >= 1 ? max : max * ar;
  const boxH = ar >= 1 ? max / ar : max;
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded border border-violet-400/30 bg-violet-400/[0.1]",
        compact ? "h-7 w-7" : "h-14 w-full",
      )}
      aria-hidden
    >
      <div
        className="rounded-sm border border-violet-300/45 bg-violet-300/25"
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

function panelMasterLabel(group: ComponentLibraryGroup, master: EditorNode): string {
  if (group.variants.length > 1) return group.label;
  return componentDisplayName(master.name);
}

function ComponentCard({
  master,
  group,
  active,
  listView,
  onActivate,
  onDragStart,
  onDragEnd,
  onContextMenu,
}: {
  master: EditorNode;
  group: ComponentLibraryGroup;
  active: boolean;
  listView?: boolean;
  onActivate: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const select = useEditorStore((s) => s.select);
  const didDragRef = useRef(false);
  const subtitle = variantSubtitle(master);
  const variantCount = group.variants.length;
  const displayName = panelMasterLabel(group, master);

  return (
    <button
      type="button"
      draggable
      data-component-id={master.id}
      onDragStart={(e) => {
        didDragRef.current = true;
        onDragStart(e);
      }}
      onDragEnd={(e) => {
        onDragEnd?.(e);
        requestAnimationFrame(() => {
          didDragRef.current = false;
        });
      }}
      onClick={() => {
        if (didDragRef.current) return;
        onActivate();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e);
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        select(master.id, false);
      }}
      className={cn(
        "w-full rounded-md border text-left transition-colors",
        listView ? "flex items-center gap-2 p-1.5" : "p-2",
        active
          ? "border-accent/50 bg-accent/10 ring-1 ring-accent/30"
          : "border-app-border bg-app-panel hover:border-violet-400/35 hover:bg-violet-400/10",
      )}
    >
      {listView ? (
        <>
          <ComponentPreview width={master.width} height={master.height} compact />
          <span className="min-w-0 flex-1 truncate text-ui font-medium text-app-fg">{displayName}</span>
          {variantCount > 1 ? (
            <span className="shrink-0 rounded bg-app-hover px-1 py-0.5 text-ui text-app-muted">
              {variantCount} variants
            </span>
          ) : null}
        </>
      ) : (
        <>
          <ComponentPreview width={master.width} height={master.height} />
          <div className="mt-1.5 flex items-center gap-1.5">
            <Component className="h-3.5 w-3.5 shrink-0 text-violet-200" strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate text-ui font-medium text-app-fg">{displayName}</span>
            {variantCount > 1 ? (
              <span className="shrink-0 rounded bg-app-hover px-1 py-0.5 text-ui text-app-muted">
                {variantCount} variants
              </span>
            ) : null}
          </div>
          {variantCount <= 1 && subtitle ? (
            <p className="mt-0.5 truncate text-ui text-app-subtle" title={subtitle}>
              {subtitle}
            </p>
          ) : null}
        </>
      )}
    </button>
  );
}

function FolderSection({
  folder,
  depth,
  groupsByMasterId,
  listView,
  activeMasterId,
  startPlacement,
  onDragStart,
  onDragEnd,
  onContextMenu,
}: {
  folder: ComponentFolderNode;
  depth: number;
  groupsByMasterId: Map<string, ComponentLibraryGroup>;
  listView: boolean;
  activeMasterId: string | null;
  startPlacement: (id: string) => void;
  onDragStart: (masterId: string, name: string) => (e: React.DragEvent) => void;
  onDragEnd: (masterId: string) => () => void;
  onContextMenu: (master: EditorNode, e: React.MouseEvent) => void;
}) {
  return (
    <>
      {folder.components.map((master) => {
        const group = groupsByMasterId.get(master.id) ?? {
          id: master.id,
          label: componentDisplayName(master.name),
          variants: [master],
        };
        return (
          <li key={master.id} style={{ paddingLeft: depth * 8 }}>
            <ComponentCard
              master={master}
              group={group}
              active={activeMasterId === master.id}
              listView={listView}
              onActivate={() => startPlacement(master.id)}
              onDragStart={onDragStart(master.id, master.name)}
              onDragEnd={onDragEnd(master.id)}
              onContextMenu={(e) => onContextMenu(master, e)}
            />
          </li>
        );
      })}
      {folder.children.map((child) => (
        <li key={child.path || child.name}>
          <p className="mb-1 truncate px-0.5 section-heading" style={{ paddingLeft: depth * 8 }}>
            {child.name}
          </p>
          <ul className="space-y-1.5">
            <FolderSection
              folder={child}
              depth={depth + 1}
              groupsByMasterId={groupsByMasterId}
              listView={listView}
              activeMasterId={activeMasterId}
              startPlacement={startPlacement}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onContextMenu={onContextMenu}
            />
          </ul>
        </li>
      ))}
    </>
  );
}

export function ComponentsPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const leftTab = useEditorStore((s) => s.leftTab);
  const nodes = useEditorStore((s) => s.nodes);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const createComponentFromSelection = useEditorStore((s) => s.createComponentFromSelection);
  const setPlacingComponentMasterId = useEditorStore((s) => s.setPlacingComponentMasterId);
  const setTool = useEditorStore((s) => s.setTool);
  const select = useEditorStore((s) => s.select);
  const deleteSingle = useEditorStore((s) => s.deleteSingle);
  const updateNode = useEditorStore((s) => s.updateNode);

  const [query, setQuery] = useState("");
  const [activeMasterId, setActiveMasterId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; master: EditorNode } | null>(
    null,
  );
  const searchRef = useRef<HTMLInputElement>(null);

  const localGroups = useMemo(
    () => groupComponentMasters(localComponentMasters(nodes), nodes),
    [nodes],
  );
  const filteredGroups = useMemo(
    () => filterComponentLibraryGroups(localGroups, query),
    [localGroups, query],
  );
  const flatFiltered = useMemo(
    () => filteredGroups.map((g) => primaryMasterForGroup(g)),
    [filteredGroups],
  );
  const panelMasters = useMemo(() => localComponentPanelMasters(nodes), [nodes]);
  const folderTree = useMemo(() => buildComponentFolderTree(panelMasters), [panelMasters]);
  const groupsByMasterId = useMemo(() => {
    const map = new Map<string, ComponentLibraryGroup>();
    for (const g of localGroups) {
      for (const v of g.variants) map.set(v.id, g);
    }
    return map;
  }, [localGroups]);
  const canCreate = useMemo(
    () => canCreateComponentFromSelection(selectedIds, nodes),
    [selectedIds, nodes],
  );

  const startPlacement = useCallback(
    (masterId: string) => {
      setTool("move");
      setPlacingComponentMasterId(masterId);
      setActiveMasterId(masterId);
      recordRecentComponent(masterId);
    },
    [setPlacingComponentMasterId, setTool],
  );

  const onDragStart = (masterId: string, name: string) => (e: React.DragEvent) => {
    e.stopPropagation();
    setTool("move");
    setPlacingComponentMasterId(masterId);
    setActiveMasterId(masterId);
    recordRecentComponent(masterId);
    e.dataTransfer.setData("application/x-pc-component", masterId);
    e.dataTransfer.setData("text/plain", masterId);
    e.dataTransfer.effectAllowed = "copy";
    const ghost = document.createElement("div");
    ghost.className =
      "rounded border border-violet-300/50 bg-violet-400/20 px-2 py-1 text-ui font-medium text-violet-50 shadow-lg";
    ghost.textContent = componentDisplayName(name);
    ghost.style.position = "absolute";
    ghost.style.top = "-1000px";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    requestAnimationFrame(() => ghost.remove());
  };

  const onDragEnd = (masterId: string) => () => {
    requestAnimationFrame(() => {
      const st = useEditorStore.getState();
      if (st.placingComponentMasterId === masterId) {
        setPlacingComponentMasterId(null);
      }
    });
  };

  const openContextMenu = (master: EditorNode, e: React.MouseEvent) => {
    setContextMenu({ x: e.clientX, y: e.clientY, master });
  };

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

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

  const totalCount = localGroups.length;
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
            {totalCount} local component{totalCount === 1 ? "" : "s"}
          </p>
        ) : null}

        <div className="mt-2 flex items-center gap-1">
          <button
            type="button"
            disabled={!canCreate}
            data-testid="create-component-panel"
            onClick={() => createComponentFromSelection()}
            className={cn(
              "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border text-ui font-semibold transition-colors",
              canCreate
                ? "border-violet-400/40 bg-violet-400/15 text-violet-50 hover:bg-violet-400/25"
                : "cursor-not-allowed border-app-border-subtle text-app-subtle",
            )}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Create component
          </button>
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={viewMode === "grid"}
            onClick={() => setViewMode("grid")}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md border border-app-border",
              viewMode === "grid" ? "bg-app-hover text-app-fg" : "text-app-subtle hover:bg-app-hover",
            )}
          >
            <Grid3X3 className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={viewMode === "list"}
            onClick={() => setViewMode("list")}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md border border-app-border",
              viewMode === "list" ? "bg-app-hover text-app-fg" : "text-app-subtle hover:bg-app-hover",
            )}
          >
            <LayoutList className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
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
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 px-0.5 section-heading">Local components</p>
              {searching ? (
                <ul className="space-y-1.5">
                  {filteredGroups.map((group) => {
                    const master = primaryMasterForGroup(group);
                    return (
                      <li key={group.id}>
                        <ComponentCard
                          master={master}
                          group={group}
                          active={activeMasterId === master.id}
                          listView={viewMode === "list"}
                          onActivate={() => startPlacement(master.id)}
                          onDragStart={onDragStart(master.id, master.name)}
                          onDragEnd={onDragEnd(master.id)}
                          onContextMenu={(e) => openContextMenu(master, e)}
                        />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <ul className="space-y-1.5">
                  <FolderSection
                    folder={folderTree}
                    depth={0}
                    groupsByMasterId={groupsByMasterId}
                    listView={viewMode === "list"}
                    activeMasterId={activeMasterId}
                    startPlacement={startPlacement}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onContextMenu={openContextMenu}
                  />
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {contextMenu ? (
        <div
          className="fixed z-[100] min-w-[180px] rounded-lg border border-app-border bg-app-panel p-1 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="editor-menu-dropdown-item w-full"
            onClick={() => {
              startPlacement(contextMenu.master.id);
              setContextMenu(null);
            }}
          >
            Insert instance
          </button>
          <button
            type="button"
            className="editor-menu-dropdown-item w-full"
            onClick={() => {
              select(contextMenu.master.id, false);
              setContextMenu(null);
            }}
          >
            Go to main component
          </button>
          <button
            type="button"
            className="editor-menu-dropdown-item w-full"
            onClick={() => {
              const next = window.prompt("Rename component", contextMenu.master.name);
              if (next?.trim()) updateNode(contextMenu.master.id, { name: next.trim() });
              setContextMenu(null);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className="editor-menu-dropdown-item w-full text-red-300"
            onClick={() => {
              deleteSingle(contextMenu.master.id);
              setContextMenu(null);
            }}
          >
            Delete local component
          </button>
        </div>
      ) : null}
    </div>
  );
}
