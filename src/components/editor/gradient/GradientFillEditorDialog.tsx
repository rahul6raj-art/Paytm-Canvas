"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { FillGradient } from "@/lib/gradient";
import { cn } from "@/lib/utils";
import {
  adjacentPanelDialogStyle,
  useAdjacentPanelDialogPosition,
} from "../useAdjacentPanelDialogPosition";
import { useDraggableFloatingPanel } from "../useDraggableFloatingPanel";
import type { GradientEditorFocusRequest } from "@/lib/gradientEditorFocus";
import { GradientFillEditor } from "./GradientFillEditor";

const GRADIENT_STOP_COLOR_PICKER_SELECTOR = "[data-gradient-stop-color-picker]";

export function GradientFillEditorDialog({
  open,
  onClose,
  anchorRef,
  nodeId,
  gradient,
  fillOpacity,
  disabled,
  onChange,
  onCreateStyle,
  remeasureKey,
  focusStop,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  nodeId: string;
  gradient: FillGradient;
  fillOpacity: number;
  disabled?: boolean;
  onChange: (g: FillGradient, opts?: { skipHistory?: boolean }) => void;
  onCreateStyle?: () => void;
  remeasureKey?: unknown;
  focusStop?: Pick<GradientEditorFocusRequest, "stopId" | "openColorPicker" | "nonce"> | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [stopColorPickerOpen, setStopColorPickerOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const position = useAdjacentPanelDialogPosition(anchorRef, open, {
    width: 280,
    maxHeight: 560,
    remeasureKey,
  });
  const { position: dragPosition, onHeaderPointerDown, isDragging } = useDraggableFloatingPanel(
    open,
    position,
  );

  useLayoutEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (dialogRef.current?.contains(t)) return;
      if (t instanceof Element && t.closest(GRADIENT_STOP_COLOR_PICKER_SELECTOR)) return;
      onClose();
    };

    let active = false;
    const id = requestAnimationFrame(() => {
      active = true;
      document.addEventListener("mousedown", onDown);
    });

    return () => {
      cancelAnimationFrame(id);
      if (active) document.removeEventListener("mousedown", onDown);
    };
  }, [open, onClose, anchorRef]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) setStopColorPickerOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (stopColorPickerOpen) return;
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose, stopColorPickerOpen]);

  const dialog =
    open && mounted ? (
      <div
        ref={dialogRef}
        role="dialog"
        aria-label="Gradient editor"
        aria-modal="false"
        data-editor-shell
        className="editor-inspector-dialog fixed z-[120]"
        style={adjacentPanelDialogStyle(dragPosition)}
      >
        <div
          className={cn("editor-inspector-dialog-header", isDragging && "cursor-grabbing")}
          onPointerDown={onHeaderPointerDown}
        >
          <div className="inspector-field-label pointer-events-none">Gradient</div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
            aria-label="Close gradient editor"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
        <div className="editor-inspector-dialog-body">
          <GradientFillEditor
            embedded={false}
            nodeId={nodeId}
            gradient={gradient}
            fillOpacity={fillOpacity}
            disabled={disabled}
            colorPickerBesideRef={dialogRef}
            onColorPickerOpenChange={setStopColorPickerOpen}
            focusStop={open ? focusStop : null}
            onChange={onChange}
            onCreateStyle={onCreateStyle}
          />
        </div>
      </div>
    ) : null;

  return mounted && dialog ? createPortal(dialog, document.body) : null;
}
