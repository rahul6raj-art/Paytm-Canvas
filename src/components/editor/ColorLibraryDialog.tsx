"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { LayoutGrid, List, X } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  adjacentPanelDialogStyle,
  useAdjacentPanelDialogPosition,
} from "./useAdjacentPanelDialogPosition";
import { useDismissAnchoredDropdown } from "./useAnchoredDropdown";
import { useDraggableFloatingPanel } from "./useDraggableFloatingPanel";
import { ColorLibraryPickerBody } from "./ColorLibraryPickerBody";
import { getColorDesignTokens } from "./LibraryColorPickerMenu";
import { EditorHintWrap } from "./EditorHoverHint";
import { inspectorHeaderActionBtnClass, inspectorLucideProps } from "@/lib/inspectorIconStyles";
import { cn } from "@/lib/utils";

type ColorLibraryView = "grid" | "list";

type ColorLibraryDialogProps = {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  title?: string;
  activeTokenId?: string | null;
  onPick?: (tokenId: string) => void;
};

export function ColorLibraryDialog({
  open,
  onClose,
  anchorRef,
  title = "Color library",
  activeTokenId,
  onPick,
}: ColorLibraryDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<ColorLibraryView>("list");
  const dialogRef = useRef<HTMLDivElement>(null);
  const applyTokenToSelection = useEditorStore((s) => s.applyTokenToSelection);
  const designTokens = useEditorStore((s) => s.designTokens);

  const panelPosition = useAdjacentPanelDialogPosition(anchorRef, open, {
    width: 280,
    maxHeight: 480,
  });
  const { position: dragPosition, onHeaderPointerDown, isDragging } = useDraggableFloatingPanel(
    open,
    panelPosition,
  );

  useDismissAnchoredDropdown(open, onClose, anchorRef, dialogRef);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open) return;
    setView(activeTokenId ? "list" : "grid");
  }, [open, activeTokenId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const handlePick = (tokenId: string) => {
    if (onPick) {
      onPick(tokenId);
    } else {
      applyTokenToSelection(tokenId);
    }
    onClose();
  };

  if (!open || !mounted) return null;

  const colors = getColorDesignTokens(designTokens);
  if (colors.length === 0) return null;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-label={title}
      aria-modal="false"
      data-editor-shell
      className="editor-inspector-dialog fixed"
      style={{ ...adjacentPanelDialogStyle(dragPosition), zIndex: 121 }}
    >
      <div
        className={cn("editor-inspector-dialog-header", isDragging && "cursor-grabbing")}
        onPointerDown={onHeaderPointerDown}
      >
        <div className="inspector-field-label pointer-events-none min-w-0 truncate">{title}</div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div
            className="pointer-events-auto flex items-center rounded border border-app-border bg-app-inset p-0.5"
            role="group"
            aria-label="Color library view"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <EditorHintWrap title="Grid view">
              <button
                type="button"
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded transition-colors",
                  view === "grid"
                    ? "bg-app-panel text-app-fg shadow-sm"
                    : "text-app-subtle hover:text-app-fg",
                )}
              >
                <LayoutGrid className="h-3 w-3" strokeWidth={2} />
              </button>
            </EditorHintWrap>
            <EditorHintWrap title="List view with names">
              <button
                type="button"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded transition-colors",
                  view === "list"
                    ? "bg-app-panel text-app-fg shadow-sm"
                    : "text-app-subtle hover:text-app-fg",
                )}
              >
                <List className="h-3 w-3" strokeWidth={2} />
              </button>
            </EditorHintWrap>
          </div>
          <button
            type="button"
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            className={cn(inspectorHeaderActionBtnClass, "pointer-events-auto rounded-lg")}
            aria-label={`Close ${title.toLowerCase()}`}
          >
            <X {...inspectorLucideProps()} />
          </button>
        </div>
      </div>
      <div className="editor-inspector-dialog-body !px-2.5">
        <ColorLibraryPickerBody
          activeTokenId={activeTokenId}
          onPick={handlePick}
          gridCols="panel"
          listScrollContained={false}
          showViewToggle={false}
          viewOverride={view}
          scrollActiveKey={open ? activeTokenId : null}
        />
      </div>
    </div>,
    document.body,
  );
}
