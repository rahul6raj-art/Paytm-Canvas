"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ColorPickerPanel } from "./ColorPickerPanel";
import type { ColorCommitOptions } from "./ColorInput";
import {
  adjacentPanelDialogStyle,
  useAdjacentElementDialogPosition,
  useAdjacentPanelDialogPosition,
} from "./useAdjacentPanelDialogPosition";
import { useDismissAnchoredDropdown } from "./useAnchoredDropdown";
import { useDraggableFloatingPanel } from "./useDraggableFloatingPanel";
import { inspectorHeaderActionBtnClass } from "@/lib/inspectorIconStyles";
import { cn } from "@/lib/utils";

export function InspectorColorPickerAside({
  open,
  onClose,
  anchorRef,
  hostRef,
  hostSide = "left",
  title,
  hex,
  opacity,
  disabled,
  onCommitHex,
  onCommitOpacity,
  zIndex = 121,
  dataAttrs,
}: {
  open: boolean;
  onClose: () => void;
  /** Dock beside the right properties panel, aligned to this trigger. */
  anchorRef?: RefObject<HTMLElement | null>;
  /** Dock beside another floating panel (e.g. gradient editor). */
  hostRef?: RefObject<HTMLElement | null>;
  hostSide?: "left" | "right";
  title: string;
  hex: string;
  opacity: number;
  disabled?: boolean;
  onCommitHex: (hex: string, opts?: ColorCommitOptions) => void;
  onCommitOpacity: (opacity: number, opts?: ColorCommitOptions) => void;
  zIndex?: number;
  dataAttrs?: Record<string, string | boolean>;
}) {
  const [mounted, setMounted] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const noopAnchorRef = useRef<HTMLDivElement>(null);
  const dismissAnchorRef = anchorRef ?? noopAnchorRef;

  const useHost = Boolean(hostRef);
  const panelPosition = useAdjacentPanelDialogPosition(
    useHost ? noopAnchorRef : (anchorRef ?? noopAnchorRef),
    open && !useHost,
    { width: 280, maxHeight: 440 },
  );
  const hostPosition = useAdjacentElementDialogPosition(hostRef ?? noopAnchorRef, open && useHost, {
    width: 280,
    maxHeight: 440,
    side: hostSide,
  });
  const position = useHost ? hostPosition : panelPosition;
  const { position: dragPosition, onHeaderPointerDown, isDragging } = useDraggableFloatingPanel(
    open,
    position,
  );

  useDismissAnchoredDropdown(open, onClose, dismissAnchorRef, pickerRef, {
    ignoreRefs: hostRef ? [hostRef] : undefined,
  });

  useEffect(() => setMounted(true), []);

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

  if (!open || !mounted) return null;

  return createPortal(
    <div
      ref={pickerRef}
      {...(dataAttrs ?? {})}
      role="dialog"
      aria-label={title}
      aria-modal="false"
      data-editor-shell
      className="editor-inspector-dialog fixed"
      style={{ ...adjacentPanelDialogStyle(dragPosition), zIndex }}
    >
      <div
        className={cn("editor-inspector-dialog-header", isDragging && "cursor-grabbing")}
        onPointerDown={onHeaderPointerDown}
      >
        <div className="inspector-field-label pointer-events-none">{title}</div>
        <button
          type="button"
          onClick={onClose}
          className={cn(inspectorHeaderActionBtnClass, "rounded-lg")}
          aria-label={`Close ${title.toLowerCase()}`}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
      <div className="editor-inspector-dialog-body">
        <ColorPickerPanel
          hex={hex}
          opacity={opacity}
          disabled={disabled}
          onCommitHex={onCommitHex}
          onCommitOpacity={onCommitOpacity}
        />
      </div>
    </div>,
    document.body,
  );
}
