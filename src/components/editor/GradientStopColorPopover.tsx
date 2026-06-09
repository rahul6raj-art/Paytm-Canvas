"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ColorInput } from "./ColorInput";
import { LibraryColorPickerMenu } from "./LibraryColorPickerMenu";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "./useAnchoredDropdown";
import { isColorValue } from "@/lib/designTokens";
import { useEditorStore } from "@/stores/useEditorStore";

export function GradientStopColorPopover({
  open,
  anchorRef,
  hex,
  instanceKey,
  disabled,
  onClose,
  onCommitHex,
  remeasureKey,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  remeasureKey?: unknown;
  hex: string;
  instanceKey: string;
  disabled?: boolean;
  onClose: () => void;
  onCommitHex: (hex: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const designTokens = useEditorStore((s) => s.designTokens);

  const position = useAnchoredDropdownPosition(anchorRef, open, 6, {
    viewportClamp: true,
    maxHeight: 420,
    width: 248,
    remeasureKey,
  });
  useDismissAnchoredDropdown(open, onClose, anchorRef, menuRef);

  useEffect(() => setMounted(true), []);

  const pickLibraryColor = (tokenId: string) => {
    const token = designTokens[tokenId];
    if (token?.type === "color" && isColorValue(token.value)) {
      onCommitHex(token.value.hex);
    }
    onClose();
  };

  const menu =
    open && mounted && !disabled ? (
      <div
        ref={menuRef}
        role="dialog"
        aria-label="Gradient stop color"
        className="fixed z-[130] overflow-hidden rounded-md border border-app-border bg-app-panel p-2 shadow-xl"
        style={anchoredMenuStyle(position)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="mb-1.5 px-0.5 text-[11px] font-medium text-app-subtle">Stop color</p>
        <ColorInput
          hex={hex}
          instanceKey={instanceKey}
          disabled={disabled}
          onCommitHex={onCommitHex}
        />
        <div className="mt-2 border-t border-app-border-subtle pt-2">
          <LibraryColorPickerMenu onPick={pickLibraryColor} />
        </div>
      </div>
    ) : null;

  return mounted && menu ? createPortal(menu, document.body) : null;
}
