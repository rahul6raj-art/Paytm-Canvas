"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { isAdditiveSelectionClick } from "@/lib/containerSelection";
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  Circle,
  Combine,
  Component,
  Eye,
  EyeOff,
  Frame,
  Hexagon,
  Group,
  ImageIcon,
  Layers,
  Lock,
  Minus,
  MoveUpRight,
  Square,
  Type,
  Unlock,
  Layers2,
} from "lucide-react";
import { FIG_IMPORT_DEFER_LAYERS_PANEL_NODE_CAP } from "@/lib/figImport/figImportConstants";
import { handlePanelFieldKeyDown } from "@/lib/panelFieldKeyboard";
import { cn } from "@/lib/utils";
import { ROOT, useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { findInstanceRoot } from "@/lib/componentModel";
import { isAncestorOf, layerPanelChildIds } from "@/lib/editorGraph";
import { BOOLEAN_OPERATION_LABELS, isMaskGroup } from "@/lib/booleanGeometry";
import { didPointerExitElement } from "@/lib/domPointer";
import { isAutoLayoutContainer, type LayoutMode } from "@/lib/layoutEngine/types";
import { AutoLayoutFrameLayerIcon } from "@/components/editor/AutoLayoutFrameLayerIcon";
import { PathLayerIcon } from "@/components/editor/PathLayerIcon";

function autoLayoutLayerIconMode(
  node: Pick<EditorNode, "layoutMode">,
): Exclude<LayoutMode, "none"> {
  return node.layoutMode === "vertical" ? "vertical" : "horizontal";
}

function KindIcon({ node }: { node: EditorNode }) {
  const c = "h-3.5 w-3.5 shrink-0 text-app-subtle";
  if (node.isBooleanGroup) return <Combine className={c} strokeWidth={1.75} />;
  if (isMaskGroup(node)) return <Layers2 className={c} strokeWidth={1.75} />;
  if (node.isMask) return <Circle className={c} strokeWidth={1.75} strokeDasharray="3 2" />;
  if (node.type === "frame") {
    if (isAutoLayoutContainer(node)) {
      return (
        <AutoLayoutFrameLayerIcon mode={autoLayoutLayerIconMode(node)} className={c} />
      );
    }
    return <Frame className={c} strokeWidth={1.75} />;
  }
  if (node.type === "group") {
    if (isAutoLayoutContainer(node)) {
      return (
        <AutoLayoutFrameLayerIcon mode={autoLayoutLayerIconMode(node)} className={c} />
      );
    }
    return <Group className={c} strokeWidth={1.75} />;
  }
  if (node.type === "text") return <Type className={c} strokeWidth={1.75} />;
  if (node.type === "image") return <ImageIcon className={c} strokeWidth={1.75} />;
  if (node.type === "ellipse") return <Circle className={c} strokeWidth={1.75} />;
  if (node.type === "line") return <Minus className={c} strokeWidth={1.75} />;
  if (node.type === "arrow") return <MoveUpRight className={c} strokeWidth={1.75} />;
  if (node.type === "polygon") return <Hexagon className={c} strokeWidth={1.75} />;
  if (node.type === "path") return <PathLayerIcon node={node} className={c} />;
  return <Square className={c} strokeWidth={1.75} />;
}

type DropInd =
  | null
  | { kind: "reorder"; parentId: string; insertBefore: number }
  | { kind: "nest"; targetId: string };

function layerRowKey(parentId: string, nodeId: string) {
  return `${parentId}::${nodeId}`;
}

const EMPTY_REMOTE_PEERS: { id: string; color: string; name: string }[] = [];

function Tree({
  parentId,
  depth,
  dragId,
  indicator,
  setIndicator,
  onDragStartRow,
  panelHovered,
}: {
  parentId: string;
  depth: number;
  dragId: string | null;
  indicator: DropInd;
  setIndicator: (v: DropInd) => void;
  onDragStartRow: (e: React.DragEvent, payloadId: string) => void;
  panelHovered: boolean;
}) {
  const childOrder = useEditorStore((s) => s.childOrder);
  const nodes = useEditorStore((s) => s.nodes);
  const ids = layerPanelChildIds(parentId, nodes, childOrder);

  return (
    <>
      {ids.map((id, index) => {
        const node = nodes[id];
        if (!node) return null;
        const childIds = layerPanelChildIds(node.id, nodes, childOrder);
        const showChildren =
          (node.type === "frame" || node.type === "group") &&
          node.expanded !== false &&
          childIds.length > 0;
        return (
          <LayerRow
            key={id}
            node={node}
            depth={depth}
            parentId={parentId}
            index={index}
            dragId={dragId}
            indicator={indicator}
            setIndicator={setIndicator}
            onDragStartRow={onDragStartRow}
            showChildren={showChildren}
            panelHovered={panelHovered}
          />
        );
      })}
    </>
  );
}

function LayerRow({
  node,
  depth,
  parentId,
  index,
  dragId,
  indicator,
  setIndicator,
  onDragStartRow,
  showChildren,
  panelHovered,
}: {
  node: EditorNode;
  depth: number;
  parentId: string;
  index: number;
  dragId: string | null;
  indicator: DropInd;
  setIndicator: (v: DropInd) => void;
  onDragStartRow: (e: React.DragEvent, payloadId: string) => void;
  showChildren: boolean;
  panelHovered: boolean;
}) {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const select = useEditorStore((s) => s.select);
  const toggleVisible = useEditorStore((s) => s.toggleVisible);
  const toggleLock = useEditorStore((s) => s.toggleLock);
  const toggleExpanded = useEditorStore((s) => s.toggleExpanded);
  const childOrder = useEditorStore((s) => s.childOrder);
  const nodes = useEditorStore((s) => s.nodes);
  const instRoot = findInstanceRoot(nodes, node.id);
  const parentNode = nodes[parentId];
  const inMaskGroup = Boolean(parentNode && isMaskGroup(parentNode));
  const maskGroupMaskId = inMaskGroup ? parentNode!.maskId : undefined;
  const openContextMenu = useEditorStore((s) => s.openContextMenu);
  const layerRenameId = useEditorStore((s) => s.layerRenameId);
  const setLayerRenameId = useEditorStore((s) => s.setLayerRenameId);
  const renameNode = useEditorStore((s) => s.renameNode);
  const showPresence = useEditorStore((s) => s.showPresence);
  const presenceUsers = useEditorStore((s) => s.presenceUsers);

  const remotePeers = useMemo(() => {
    if (!showPresence) return EMPTY_REMOTE_PEERS;
    return presenceUsers
      .filter((u) => u.selectedNodeIds.includes(node.id))
      .map((u) => ({ id: u.id, color: u.color, name: u.name }));
  }, [showPresence, presenceUsers, node.id]);

  const [draftName, setDraftName] = useState(node.name);
  const skipBlurCommit = useRef(false);

  useEffect(() => {
    if (layerRenameId === node.id) setDraftName(node.name);
  }, [layerRenameId, node.id, node.name]);

  const hasKids =
    (node.type === "frame" || node.type === "group") &&
    layerPanelChildIds(node.id, nodes, childOrder).length > 0;
  const active = selectedIds.includes(node.id);
  const nestHighlight = indicator?.kind === "nest" && indicator.targetId === node.id;
  const isRenaming = layerRenameId === node.id;

  const onRowDragOver = (e: React.DragEvent) => {
    if (!dragId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    if (dragId === node.id) {
      setIndicator(null);
      return;
    }
    if (isAncestorOf(nodes, dragId, node.id)) {
      setIndicator(null);
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / Math.max(rect.height, 1);
    const canNest = (node.type === "frame" || node.type === "group") && !node.locked;

    if (canNest && ratio > 0.28 && ratio < 0.72) {
      setIndicator({ kind: "nest", targetId: node.id });
      return;
    }

    const insertBefore = ratio < 0.5 ? index : index + 1;
    setIndicator({ kind: "reorder", parentId, insertBefore });
  };

  const onRowDragLeave = (e: React.DragEvent) => {
    if (didPointerExitElement(e.currentTarget, e.relatedTarget)) {
      setIndicator(null);
    }
  };

  const commitRename = () => {
    const t = draftName.trim();
    if (t) renameNode(node.id, t);
    setLayerRenameId(null);
  };

  return (
    <div>
      <div
        data-layer-row={layerRowKey(parentId, node.id)}
        draggable={!node.locked}
        onDragStart={(e) => {
          if (node.locked) {
            e.preventDefault();
            return;
          }
          const payloadId =
            selectedIds.length > 0 && selectedIds.includes(node.id) ? selectedIds[0]! : node.id;
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("application/x-pc-layer", payloadId);
          onDragStartRow(e, payloadId);
        }}
        onDragOver={onRowDragOver}
        onDragLeave={onRowDragLeave}
        onContextMenu={(e) => {
          e.preventDefault();
          openContextMenu(node.id, e.clientX, e.clientY);
        }}
        className={cn(
          "group flex h-7 items-center gap-0.5 rounded pr-1 text-ui-sm transition-colors",
          active
            ? "bg-[rgba(24,160,251,0.14)] text-app-fg"
            : "text-app-fg hover:bg-app-hover",
          nestHighlight && "bg-[rgba(24,160,251,0.1)]",
        )}
        style={{ paddingLeft: 6 + depth * 14 }}
      >
        {inMaskGroup && node.id !== maskGroupMaskId ? (
          <span
            className="w-3 shrink-0 border-l border-b border-purple-400/50"
            style={{ marginLeft: 2, height: 10, marginBottom: 4 }}
            aria-hidden
          />
        ) : null}
        {hasKids ? (
          <button
            type="button"
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded text-app-subtle transition-opacity hover:bg-app-hover hover:text-app-fg",
              panelHovered ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(node.id);
            }}
            title={node.expanded ? "Collapse" : "Expand"}
          >
            {node.expanded ? (
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            )}
          </button>
        ) : (
          <span className="w-6 shrink-0" />
        )}
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          onClick={(e) => select(node.id, isAdditiveSelectionClick(e))}
        >
          <KindIcon node={node} />
          {remotePeers.length > 0 ? (
            <span
              className="flex shrink-0 items-center gap-0.5"
              title={remotePeers.map((p) => p.name).join(", ")}
            >
              {remotePeers.map((p) => (
                <span
                  key={p.id}
                  className="h-2 w-2 shrink-0 rounded-full border border-black/50 ring-1 ring-black/20"
                  style={{ backgroundColor: p.color }}
                />
              ))}
            </span>
          ) : null}
          {node.isComponent ? (
            <span title="Component source" className="shrink-0 text-violet-300">
              <Component className="h-3 w-3" strokeWidth={1.75} />
            </span>
          ) : null}
          {instRoot ? (
            <span title="Component instance" className="shrink-0 text-violet-200/90">
              <Boxes className="h-3 w-3" strokeWidth={1.75} />
            </span>
          ) : null}
          {isRenaming ? (
            <input
              className="min-w-0 flex-1 rounded border border-accent/50 bg-app-field px-1 py-0 text-ui font-medium text-app-field-fg outline-none"
              value={draftName}
              autoFocus
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                handlePanelFieldKeyDown(e, {
                  onEnter: () => commitRename(),
                  onEscape: () => {
                    skipBlurCommit.current = true;
                    setDraftName(node.name);
                    setLayerRenameId(null);
                  },
                });
              }}
              onBlur={() => {
                if (skipBlurCommit.current) {
                  skipBlurCommit.current = false;
                  return;
                }
                commitRename();
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className={cn(
                "min-w-0 flex-1 truncate font-medium",
                active
                  ? node.type === "frame"
                    ? "text-[#18a0fb]"
                    : "text-[#f0f0f0]"
                  : "text-app-fg",
              )}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (!node.locked) {
                  setDraftName(node.name);
                  setLayerRenameId(node.id);
                }
              }}
            >
              {node.isBooleanGroup && node.booleanOperation
                ? BOOLEAN_OPERATION_LABELS[node.booleanOperation]
                : node.name}
              {node.isMask ? (
                <span className="ml-1 shrink-0 text-ui font-normal uppercase text-purple-300/90">
                  Mask
                </span>
              ) : null}
            </span>
          )}
        </button>
        <button
          type="button"
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded text-app-subtle transition-opacity hover:bg-app-hover hover:text-app-fg",
            active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
          onClick={(e) => {
            e.stopPropagation();
            toggleVisible(node.id);
          }}
          title="Visibility"
        >
          {node.visible ? <Eye className="h-3.5 w-3.5" strokeWidth={1.75} /> : <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />}
        </button>
        <button
          type="button"
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded text-app-subtle transition-opacity hover:bg-app-hover hover:text-app-fg",
            active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
          onClick={(e) => {
            e.stopPropagation();
            toggleLock(node.id);
          }}
          title="Lock"
        >
          {node.locked ? <Lock className="h-3.5 w-3.5" strokeWidth={1.75} /> : <Unlock className="h-3.5 w-3.5" strokeWidth={1.75} />}
        </button>
      </div>
      {showChildren ? (
        <Tree
          parentId={node.id}
          depth={depth + 1}
          dragId={dragId}
          indicator={indicator}
          setIndicator={setIndicator}
          onDragStartRow={onDragStartRow}
          panelHovered={panelHovered}
        />
      ) : null}
    </div>
  );
}

export function LayersPanel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [indicator, setIndicator] = useState<DropInd>(null);
  const [lineTop, setLineTop] = useState<number | null>(null);
  const [panelHovered, setPanelHovered] = useState(false);
  const figImportBusy = useEditorStore((s) => s.figImportInProgress);
  const figImportStatus = useEditorStore((s) => s.figImportStatus);
  const childOrder = useEditorStore((s) => s.childOrder);
  const nodes = useEditorStore((s) => s.nodes);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const moveNodeToParent = useEditorStore((s) => s.moveNodeToParent);
  const [layersTreeReady, setLayersTreeReady] = useState(true);

  useEffect(() => {
    if (figImportBusy) {
      setLayersTreeReady(false);
      return;
    }
    const nodeCount = Object.keys(nodes).length;
    if (nodeCount <= FIG_IMPORT_DEFER_LAYERS_PANEL_NODE_CAP) {
      setLayersTreeReady(true);
      return;
    }
    const reveal = () => setLayersTreeReady(true);
    if (typeof requestIdleCallback === "function") {
      const idleId = requestIdleCallback(reveal, { timeout: 2500 });
      return () => cancelIdleCallback(idleId);
    }
    const timerId = window.setTimeout(reveal, 120);
    return () => window.clearTimeout(timerId);
  }, [figImportBusy, nodes]);

  useLayoutEffect(() => {
    const id = selectedIds[0];
    if (!id || !scrollRef.current) return;
    const raw = nodes[id];
    if (!raw) return;
    const pid = raw.parentId ?? ROOT;
    const sel = `[data-layer-row="${layerRowKey(pid, id)}"]`;
    const el = scrollRef.current.querySelector(sel);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIds, nodes]);

  const onDragStartRow = useCallback((_e: React.DragEvent, payloadId: string) => {
    setDragId(payloadId);
    const onEnd = () => {
      setDragId(null);
      setIndicator(null);
      setLineTop(null);
      window.removeEventListener("dragend", onEnd);
    };
    window.addEventListener("dragend", onEnd);
  }, []);

  useLayoutEffect(() => {
    if (!indicator || indicator.kind !== "reorder" || !scrollRef.current) {
      setLineTop(null);
      return;
    }
    const sc = scrollRef.current;
    const ids = useEditorStore.getState().childOrder[indicator.parentId] ?? [];
    const i = indicator.insertBefore;
    let top: number | null = null;
    if (i < ids.length) {
      const el = sc.querySelector(`[data-layer-row="${layerRowKey(indicator.parentId, ids[i]!)}"]`);
      if (el) {
        const sr = sc.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        top = er.top - sr.top + sc.scrollTop;
      }
    } else if (ids.length > 0) {
      const el = sc.querySelector(`[data-layer-row="${layerRowKey(indicator.parentId, ids[ids.length - 1]!)}"]`);
      if (el) {
        const sr = sc.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        top = er.bottom - sr.top + sc.scrollTop - 1;
      }
    }
    setLineTop(top);
  }, [indicator, childOrder, nodes]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("application/x-pc-layer");
    if (!id || !indicator) {
      setDragId(null);
      setIndicator(null);
      setLineTop(null);
      return;
    }
    const n = nodes[id];
    if (!n || n.locked) {
      setDragId(null);
      setIndicator(null);
      setLineTop(null);
      return;
    }

    if (indicator.kind === "nest") {
      const target = nodes[indicator.targetId];
      if (!target || (target.type !== "frame" && target.type !== "group")) {
        setDragId(null);
        setIndicator(null);
        setLineTop(null);
        return;
      }
      if (isAncestorOf(nodes, id, indicator.targetId)) {
        setDragId(null);
        setIndicator(null);
        setLineTop(null);
        return;
      }
      const nextLen = (useEditorStore.getState().childOrder[indicator.targetId] ?? []).filter((x) => x !== id).length;
      useEditorStore.getState().pushHistory();
      moveNodeToParent(id, indicator.targetId, nextLen);
    } else {
      useEditorStore.getState().pushHistory();
      moveNodeToParent(id, indicator.parentId, indicator.insertBefore);
    }

    setDragId(null);
    setIndicator(null);
    setLineTop(null);
  };

  const onDragOverScroll = (e: React.DragEvent) => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onPointerEnter={() => setPanelHovered(true)}
      onPointerLeave={() => setPanelHovered(false)}
    >
      <div className="section-heading flex h-8 shrink-0 items-center gap-1.5 border-b border-app-panel-edge px-3">
        <Layers className="h-3.5 w-3.5 text-app-subtle" strokeWidth={2} />
        Layers
      </div>
      <div
        ref={scrollRef}
        className="thin-scroll relative min-h-0 flex-1 overflow-y-auto py-0.5"
        onDragOver={onDragOverScroll}
        onDrop={onDrop}
      >
        {lineTop != null && indicator?.kind === "reorder" ? (
          <div
            className="pointer-events-none absolute right-1 left-1 z-10 h-px bg-accent shadow-[0_0_0_1px_rgba(13,153,255,0.35)]"
            style={{ top: lineTop }}
          />
        ) : null}
        {figImportBusy ? (
          <div className="mx-2 mt-6 px-3 py-4 text-center">
            <p className="text-ui font-medium text-app-muted">Importing layers…</p>
            {figImportStatus ? (
              <p className="mt-1 text-ui leading-relaxed text-app-subtle">{figImportStatus}</p>
            ) : null}
          </div>
        ) : !layersTreeReady ? (
          <div className="mx-2 mt-6 px-3 py-4 text-center">
            <p className="text-ui font-medium text-app-muted">Loading layer list…</p>
            <p className="mt-1 text-ui leading-relaxed text-app-subtle">
              Canvas is ready — layers appear in a moment.
            </p>
          </div>
        ) : (
          <Tree
            parentId={ROOT}
            depth={0}
            dragId={dragId}
            indicator={indicator}
            setIndicator={setIndicator}
            onDragStartRow={onDragStartRow}
            panelHovered={panelHovered}
          />
        )}
        {!figImportBusy && layersTreeReady && (childOrder[ROOT] ?? []).length === 0 ? (
          <div className="mx-2 mt-4 rounded-lg border border-dashed border-app-border bg-white/[0.02] px-3 py-6 text-center">
            <Layers className="mx-auto mb-2 h-8 w-8 text-[#4a4a4a]" strokeWidth={1.25} />
            <p className="text-ui font-medium text-app-muted">No layers yet</p>
            <p className="mt-1 text-ui leading-relaxed text-app-subtle">
              Press <span className="font-medium text-app-subtle">F</span> for a frame or use the toolbar to add shapes and text.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
