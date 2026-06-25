"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  useCanExportToLinkedSource,
  useExportToLinkedSource,
} from "@/lib/craftBridge/useExportToLinkedSource";
import { topLevelSelectedIds } from "@/lib/editorGraph";
import { hasEditorClipboardContent } from "@/lib/editorClipboardAvailability";
import { canCreateComponentFromSelection, findInstanceRoot } from "@/lib/componentModel";
import { buildSlotTextContentSnapshot } from "@/lib/components/componentSlots";
import { findSlotPropertyForHit, resolveInstanceDropParentId } from "@/lib/slotEditScope";
import { canCreateComponentSetFromSelection } from "@/lib/componentUx";
import { canUngroupSelection } from "@/lib/ungroupSelection";
import { canAddAutoLayoutToSelection } from "@/lib/autoLayoutSelection";
import { canAlignSelection } from "@/lib/alignSelection";
import {
  getBooleanEligibleSelection,
  isMaskGroup,
} from "@/lib/booleanGeometry";
import { canOutlineStroke } from "@/lib/outlineStroke";
import {
  editorMenuDividerClass,
  editorMenuItemClass,
  editorMenuPanelScrollClass,
} from "@/lib/editorMenuChrome";

type Item =
  | { type: "item"; id: string; label: string; hint?: string; disabled?: boolean; onSelect: () => void }
  | { type: "sep" };

export function EditorContextMenu() {
  const contextMenu = useEditorStore((s) => s.contextMenu);
  const closeContextMenu = useEditorStore((s) => s.closeContextMenu);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const setLayerRenameId = useEditorStore((s) => s.setLayerRenameId);
  const duplicateSingle = useEditorStore((s) => s.duplicateSingle);
  const deleteSingle = useEditorStore((s) => s.deleteSingle);
  const deleteSelection = useEditorStore((s) => s.deleteSelection);
  const bringForward = useEditorStore((s) => s.bringForward);
  const sendBackward = useEditorStore((s) => s.sendBackward);
  const bringToFront = useEditorStore((s) => s.bringToFront);
  const sendToBack = useEditorStore((s) => s.sendToBack);
  const groupSelection = useEditorStore((s) => s.groupSelection);
  const ungroupSelection = useEditorStore((s) => s.ungroupSelection);
  const addAutoLayoutToSelection = useEditorStore((s) => s.addAutoLayoutToSelection);
  const wrapSelectionInFrame = useEditorStore((s) => s.wrapSelectionInFrame);
  const toggleLock = useEditorStore((s) => s.toggleLock);
  const toggleVisible = useEditorStore((s) => s.toggleVisible);
  const editorMode = useEditorStore((s) => s.editorMode);
  const copySelection = useEditorStore((s) => s.copySelection);
  const cutSelection = useEditorStore((s) => s.cutSelection);
  const pasteSelection = useEditorStore((s) => s.pasteSelection);
  const alignSelection = useEditorStore((s) => s.alignSelection);
  const distributeSelection = useEditorStore((s) => s.distributeSelection);
  const createComponentFromSelection = useEditorStore((s) => s.createComponentFromSelection);
  const combineAsVariants = useEditorStore((s) => s.combineAsVariants);
  const createComponentSetFromSelection = useEditorStore((s) => s.createComponentSetFromSelection);
  const setPlacingComponentMasterId = useEditorStore((s) => s.setPlacingComponentMasterId);
  const detachInstance = useEditorStore((s) => s.detachInstance);
  const goToMainComponent = useEditorStore((s) => s.goToMainComponent);
  const resetInstanceOverrides = useEditorStore((s) => s.resetInstanceOverrides);
  const createBooleanGroup = useEditorStore((s) => s.createBooleanGroup);
  const updateBooleanOperation = useEditorStore((s) => s.updateBooleanOperation);
  const flattenSelection = useEditorStore((s) => s.flattenSelection);
  const outlineStrokeSelection = useEditorStore((s) => s.outlineStrokeSelection);
  const enterObjectEditMode = useEditorStore((s) => s.enterObjectEditMode);
  const enterSlotEditMode = useEditorStore((s) => s.enterSlotEditMode);
  const resetSlotContent = useEditorStore((s) => s.resetSlotContent);
  const setSlotContent = useEditorStore((s) => s.setSlotContent);
  const pasteIntoActiveSlot = useEditorStore((s) => s.pasteIntoActiveSlot);
  const useSelectionAsMask = useEditorStore((s) => s.useSelectionAsMask);
  const releaseMask = useEditorStore((s) => s.releaseMask);
  const canUpdateSource = useCanExportToLinkedSource();
  const exportToLinkedSource = useExportToLinkedSource();
  const codeRoundTripLink = useEditorStore((s) => s.codeRoundTripLink);
  const openCodeRoundTrip = useEditorStore((s) => s.openCodeRoundTrip);
  const setSelection = useEditorStore((s) => s.setSelection);

  const menuRef = useRef<HTMLDivElement>(null);

  const nodeId = contextMenu?.nodeId ?? null;
  const node = nodeId ? nodes[nodeId] : null;

  const clipboardReady = useMemo(() => hasEditorClipboardContent(), [contextMenu]);

  const items = useMemo((): Item[] => {
    if (!nodeId || !node) return [];

    const tops = topLevelSelectedIds(selectedIds, nodes);
    const canDupDel = tops.some((id) => {
      const n = nodes[id];
      return n && !n.locked && n.visible;
    });
    const canArrange = tops.some((id) => {
      const n = nodes[id];
      return n && !n.locked && n.visible;
    });
    const groupOk =
      tops.length >= 2 &&
      tops.every((id) => {
        const n = nodes[id];
        return n && !n.locked && n.visible && n.parentId === nodes[tops[0]!]?.parentId;
      });
    const ungroupOk =
      editorMode === "design" && canUngroupSelection({ selectedIds, nodes, childOrder });
    const autoLayoutOk =
      editorMode === "design" && canAddAutoLayoutToSelection(selectedIds, nodes);

    const canClipboard = tops.some((id) => {
      const n = nodes[id];
      return n && !n.locked && n.visible;
    });
    const alignOk = canAlignSelection(selectedIds, nodes, childOrder);
    const distOk =
      tops.length >= 3 &&
      tops.every((id) => {
        const n = nodes[id];
        return n && !n.locked && n.visible;
      });

    const instRoot = findInstanceRoot(nodes, nodeId);
    const slotScope = findSlotPropertyForHit(nodes, childOrder, nodeId);
    const canCreateComponent =
      editorMode === "design" && canCreateComponentFromSelection(selectedIds, nodes);
    const canCreateComponentSet =
      editorMode === "design" && canCreateComponentSetFromSelection(selectedIds, nodes);
    const isMaster = node.isComponent && (node.type === "frame" || node.type === "group");

    const canBoolean = getBooleanEligibleSelection(selectedIds, nodes).length >= 2;
    const isBoolGroup = node.isBooleanGroup;
    const isMaskGrp = isMaskGroup(node);

    const boolItems: Item[] = canBoolean
      ? ([
          { type: "item" as const, id: "bool-u", label: "Union", hint: "⌘⌥U", onSelect: () => createBooleanGroup("union") },
          { type: "item" as const, id: "bool-s", label: "Subtract", hint: "⌘⌥S", onSelect: () => createBooleanGroup("subtract") },
          { type: "item" as const, id: "bool-i", label: "Intersect", hint: "⌘⌥I", onSelect: () => createBooleanGroup("intersect") },
          { type: "item" as const, id: "bool-e", label: "Exclude", hint: "⌘⌥E", onSelect: () => createBooleanGroup("exclude") },
          { type: "item" as const, id: "bool-mask", label: "Use as mask", hint: "⌘⌥M", onSelect: () => useSelectionAsMask() },
        ] satisfies Item[])
      : [];

    const canOutline = editorMode === "design" && canOutlineStroke(node);

    const outlineItems: Item[] = canOutline
      ? [
          {
            type: "item",
            id: "outline-stroke",
            label: "Outline stroke",
            hint: "⌘⌥O",
            onSelect: () => outlineStrokeSelection(nodeId),
          },
        ]
      : [];

    const boolGroupItems: Item[] = isBoolGroup
      ? [
          { type: "item", id: "bool-edit", label: "Edit object", onSelect: () => enterObjectEditMode(nodeId) },
          { type: "item", id: "bool-flat", label: "Flatten", hint: "⌘⌥F", onSelect: () => flattenSelection() },
          { type: "sep" },
          { type: "item", id: "bool-op-u", label: "Change to Union", onSelect: () => updateBooleanOperation(nodeId, "union") },
          { type: "item", id: "bool-op-s", label: "Change to Subtract", onSelect: () => updateBooleanOperation(nodeId, "subtract") },
          { type: "item", id: "bool-op-i", label: "Change to Intersect", onSelect: () => updateBooleanOperation(nodeId, "intersect") },
          { type: "item", id: "bool-op-e", label: "Change to Exclude", onSelect: () => updateBooleanOperation(nodeId, "exclude") },
        ]
      : [];

    const maskItems: Item[] = isMaskGrp
      ? [{ type: "item", id: "mask-rel", label: "Release mask", onSelect: () => releaseMask(nodeId) }]
      : [];

    const isCodeFrame =
      editorMode === "design" && (node.type === "frame" || node.type === "group");
    const codeItems: Item[] = isCodeFrame
      ? [
          {
            type: "item" as const,
            id: "send-to-code",
            label: "Send to code",
            hint: canUpdateSource
              ? codeRoundTripLink?.sourcePath?.split("/").pop()
              : "Link source",
            onSelect: () => {
              setSelection([nodeId]);
              void (async () => {
                const result = await exportToLinkedSource();
                if (result.ok) return;
                openCodeRoundTrip("export");
              })();
            },
          },
          { type: "sep" as const },
        ]
      : [];

    const slotItems: Item[] =
      slotScope && editorMode === "design"
        ? [
            {
              type: "item",
              id: "slot-edit",
              label: "Edit slot",
              onSelect: () => enterSlotEditMode(slotScope.instanceRootId, slotScope.propertyKey),
            },
            {
              type: "item",
              id: "slot-replace",
              label: "Replace slot content",
              onSelect: () =>
                setSlotContent(
                  slotScope.instanceRootId,
                  slotScope.propertyKey,
                  buildSlotTextContentSnapshot("Slot text"),
                ),
            },
            {
              type: "item",
              id: "slot-reset",
              label: "Reset slot",
              onSelect: () => resetSlotContent(slotScope.instanceRootId, slotScope.propertyKey),
            },
            {
              type: "item",
              id: "slot-copy",
              label: "Copy slot content",
              onSelect: () => {
                setSelection([slotScope.containerId]);
                copySelection();
              },
            },
            {
              type: "item",
              id: "slot-paste",
              label: "Paste into slot",
              disabled: !clipboardReady,
              onSelect: () => {
                enterSlotEditMode(slotScope.instanceRootId, slotScope.propertyKey);
                pasteIntoActiveSlot();
              },
            },
            { type: "sep" },
          ]
        : [];

    const items: Item[] = [
      ...codeItems,
      ...slotItems,
      {
        type: "item",
        id: "rename",
        label: "Rename",
        hint: "",
        disabled: node.locked,
        onSelect: () => setLayerRenameId(nodeId),
      },
      { type: "sep" },
      {
        type: "item",
        id: "copy",
        label: "Copy",
        hint: "⌘C",
        disabled: !canClipboard,
        onSelect: () => copySelection(),
      },
      {
        type: "item",
        id: "cut",
        label: "Cut",
        hint: "⌘X",
        disabled: !canClipboard,
        onSelect: () => cutSelection(),
      },
      {
        type: "item",
        id: "paste",
        label: "Paste",
        hint: "⌘V",
        disabled: editorMode !== "design" || !clipboardReady,
        onSelect: () => pasteSelection(),
      },
      {
        type: "item",
        id: "paste-ip",
        label: "Paste in place",
        hint: "⌘⇧V",
        disabled: editorMode !== "design" || !clipboardReady,
        onSelect: () => pasteSelection({ inPlace: true }),
      },
      { type: "sep" },
      {
        type: "item",
        id: "dup",
        label: "Duplicate",
        hint: "⌘D",
        disabled: !canDupDel,
        onSelect: () => duplicateSingle(nodeId),
      },
      { type: "sep" },
      {
        type: "item",
        id: "al",
        label: "Align left",
        disabled: !alignOk,
        onSelect: () => alignSelection("left"),
      },
      {
        type: "item",
        id: "ach",
        label: "Align horizontal centers",
        disabled: !alignOk,
        onSelect: () => alignSelection("center-h"),
      },
      {
        type: "item",
        id: "ar",
        label: "Align right",
        disabled: !alignOk,
        onSelect: () => alignSelection("right"),
      },
      {
        type: "item",
        id: "at",
        label: "Align top",
        disabled: !alignOk,
        onSelect: () => alignSelection("top"),
      },
      {
        type: "item",
        id: "acv",
        label: "Align vertical centers",
        disabled: !alignOk,
        onSelect: () => alignSelection("center-v"),
      },
      {
        type: "item",
        id: "ab",
        label: "Align bottom",
        disabled: !alignOk,
        onSelect: () => alignSelection("bottom"),
      },
      {
        type: "item",
        id: "dx",
        label: "Distribute horizontal",
        disabled: !distOk,
        onSelect: () => distributeSelection("horizontal"),
      },
      {
        type: "item",
        id: "dy",
        label: "Distribute vertical",
        disabled: !distOk,
        onSelect: () => distributeSelection("vertical"),
      },
      { type: "sep" },
      {
        type: "item",
        id: "del",
        label: selectedIds.length > 1 ? `Delete ${selectedIds.length} layers` : "Delete",
        hint: "Del",
        disabled: !canDupDel,
        onSelect: () => {
          if (selectedIds.length > 1) deleteSelection();
          else deleteSingle(nodeId);
        },
      },
      { type: "sep" },
      {
        type: "item",
        id: "bf",
        label: "Bring forward",
        hint: "⌘]",
        disabled: !canArrange,
        onSelect: () => bringForward(),
      },
      {
        type: "item",
        id: "sb",
        label: "Send backward",
        hint: "⌘[",
        disabled: !canArrange,
        onSelect: () => sendBackward(),
      },
      {
        type: "item",
        id: "bfr",
        label: "Bring to front",
        hint: "⌘⇧]",
        disabled: !canArrange,
        onSelect: () => bringToFront(),
      },
      {
        type: "item",
        id: "sba",
        label: "Send to back",
        hint: "⌘⇧[",
        disabled: !canArrange,
        onSelect: () => sendToBack(),
      },
      { type: "sep" },
      {
        type: "item",
        id: "grp",
        label: "Group selection",
        hint: "⌘G",
        disabled: !groupOk,
        onSelect: () => groupSelection(),
      },
      {
        type: "item",
        id: "ugrp",
        label: "Ungroup",
        hint: "⌘⇧G",
        disabled: !ungroupOk,
        onSelect: () => ungroupSelection(),
      },
      {
        type: "item",
        id: "frame-selection",
        label: "Frame selection",
        hint: "⌘⌥G",
        disabled: !autoLayoutOk,
        onSelect: () => wrapSelectionInFrame(),
      },
      {
        type: "item",
        id: "autolayout",
        label: "Add auto layout",
        hint: "⇧A",
        disabled: !autoLayoutOk,
        onSelect: () => addAutoLayoutToSelection(),
      },
      { type: "sep" },
      ...boolItems,
      ...boolGroupItems,
      ...maskItems,
      ...outlineItems,
      ...(boolItems.length || boolGroupItems.length || maskItems.length || outlineItems.length
        ? [{ type: "sep" as const }]
        : []),
      {
        type: "item",
        id: "lock",
        label: node.locked ? "Unlock" : "Lock",
        disabled: false,
        onSelect: () => toggleLock(nodeId),
      },
      {
        type: "item",
        id: "vis",
        label: node.visible ? "Hide" : "Show",
        disabled: false,
        onSelect: () => toggleVisible(nodeId),
      },
    ];

    if (canCreateComponent) {
      items.splice(1, 0, {
        type: "item",
        id: "mk-comp",
        label: "Create component",
        hint: "⌘⌥K",
        onSelect: () => createComponentFromSelection(),
      });
    }

    if (canCreateComponentSet) {
      items.splice(canCreateComponent ? 2 : 1, 0, {
        type: "item",
        id: "create-component-set",
        label: "Create component set",
        onSelect: () => createComponentSetFromSelection(),
      });
    }

    if (isMaster && editorMode === "design") {
      items.splice(canCreateComponent ? 2 : 1, 0, {
        type: "item",
        id: "place-inst",
        label: "Create instance",
        onSelect: () => setPlacingComponentMasterId(nodeId),
      });
    }

    if (instRoot && editorMode === "design") {
      items.splice(1, 0, {
        type: "item",
        id: "go-main",
        label: "Go to main component",
        onSelect: () => goToMainComponent(instRoot),
      });
      items.splice(2, 0, {
        type: "item",
        id: "reset-overrides",
        label: "Reset all overrides",
        onSelect: () => resetInstanceOverrides(instRoot),
      });
      items.splice(3, 0, {
        type: "item",
        id: "detach-inst",
        label: "Detach instance",
        onSelect: () => detachInstance(instRoot),
      });
    }

    return items;
  }, [
    node,
    nodeId,
    nodes,
    childOrder,
    selectedIds,
    setLayerRenameId,
    duplicateSingle,
    deleteSingle,
    deleteSelection,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    groupSelection,
    ungroupSelection,
    wrapSelectionInFrame,
    toggleLock,
    toggleVisible,
    editorMode,
    copySelection,
    cutSelection,
    pasteSelection,
    alignSelection,
    distributeSelection,
    createComponentFromSelection,
    combineAsVariants,
    createComponentSetFromSelection,
    setPlacingComponentMasterId,
    detachInstance,
    goToMainComponent,
    resetInstanceOverrides,
    createBooleanGroup,
    updateBooleanOperation,
    flattenSelection,
    enterObjectEditMode,
    enterSlotEditMode,
    resetSlotContent,
    setSlotContent,
    pasteIntoActiveSlot,
    copySelection,
    useSelectionAsMask,
    releaseMask,
    clipboardReady,
    canUpdateSource,
    exportToLinkedSource,
    openCodeRoundTrip,
    setSelection,
    codeRoundTripLink?.sourcePath,
  ]);

  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current) return;
    const el = menuRef.current;
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = el.getBoundingClientRect();
    let left = contextMenu.clientX;
    let top = contextMenu.clientY;
    if (left + rect.width > vw - pad) left = vw - rect.width - pad;
    if (top + rect.height > vh - pad) top = vh - rect.height - pad;
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      closeContextMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeContextMenu();
    };
    const onScroll = (e: Event) => {
      const target = e.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      closeContextMenu();
    };
    const onResize = () => closeContextMenu();
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [contextMenu, closeContextMenu]);

  if (!contextMenu || !node) return null;

  return createPortal(
    <div
      ref={menuRef}
      data-editor-shell
      className={cn(editorMenuPanelScrollClass, "z-[200] min-w-[220px] max-h-[min(80vh,520px)]")}
      style={{ left: 0, top: 0 }}
      role="menu"
    >
      {items.map((it, i) =>
        it.type === "sep" ? (
          <div key={`s-${i}`} className={editorMenuDividerClass} role="separator" />
        ) : (
          <button
            key={it.id}
            type="button"
            role="menuitem"
            disabled={it.disabled}
            className={cn(editorMenuItemClass, it.disabled && "opacity-35")}
            onClick={() => {
              if (it.disabled) return;
              closeContextMenu();
              it.onSelect();
            }}
          >
            <span className="min-w-0 truncate">{it.label}</span>
            {it.hint ? (
              <span className="editor-menu-dropdown-shortcut">{it.hint}</span>
            ) : null}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}
