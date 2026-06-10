"use client";

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

const VIEWPORT_PAD = 8;

export type AnchoredMenuPosition = {
  left: number;
  top?: number;
  bottom?: number;
  maxHeight?: number;
};

export type AnchoredDropdownOptions = {
  /** Clamp menu inside the viewport and flip above the anchor when needed. */
  viewportClamp?: boolean;
  /** Preferred max height (px) before clamping to available space. */
  maxHeight?: number;
  /** Minimum comfortable height (px) — triggers flip-above when space below is smaller. */
  minHeight?: number;
  /** Menu width (px) used for horizontal clamping. */
  width?: number;
  /** Re-run layout when content size changes (e.g. expanded panel). */
  remeasureKey?: unknown;
};

export function anchoredMenuStyle(position: AnchoredMenuPosition): CSSProperties {
  return {
    left: position.left,
    ...(position.bottom != null
      ? { bottom: position.bottom, top: undefined }
      : { top: position.top ?? 0, bottom: undefined }),
    ...(position.maxHeight != null ? { maxHeight: position.maxHeight } : {}),
  };
}

export function useAnchoredDropdownPosition(
  anchorRef: RefObject<HTMLElement | null>,
  open: boolean,
  gap = 4,
  options?: AnchoredDropdownOptions,
) {
  const [position, setPosition] = useState<AnchoredMenuPosition>({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;

    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pad = VIEWPORT_PAD;
      const menuWidth = options?.width ?? Math.min(280, vw - pad * 2);
      const left = Math.max(pad, Math.min(r.left, vw - menuWidth - pad));

      if (!options?.viewportClamp) {
        setPosition({ left, top: r.bottom + gap });
        return;
      }

      const maxPreferred = Math.min(options.maxHeight ?? 420, vh * 0.7);
      const spaceBelow = vh - r.bottom - gap - pad;
      const spaceAbove = r.top - gap - pad;
      const minComfortable = Math.min(options?.minHeight ?? 120, maxPreferred);

      // Flip above when the preferred menu height won't fit below and there's more room above.
      const placeAbove =
        (spaceBelow < maxPreferred || spaceBelow < minComfortable) && spaceAbove > spaceBelow;

      if (placeAbove) {
        const maxHeight = Math.max(120, Math.min(maxPreferred, spaceAbove));
        setPosition({ left, bottom: vh - r.top + gap, maxHeight });
        return;
      }

      const top = r.bottom + gap;
      let maxHeight = Math.max(120, Math.min(maxPreferred, spaceBelow));
      if (top + maxHeight > vh - pad) {
        maxHeight = Math.max(120, vh - pad - top);
      }
      setPosition({ left, top, maxHeight });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [
    open,
    anchorRef,
    gap,
    options?.viewportClamp,
    options?.maxHeight,
    options?.minHeight,
    options?.width,
    options?.remeasureKey,
  ]);

  return position;
}

export function useDismissAnchoredDropdown(
  open: boolean,
  onClose: () => void,
  anchorRef: RefObject<HTMLElement | null>,
  menuRef: RefObject<HTMLElement | null>,
) {
  useLayoutEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
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
  }, [open, onClose, anchorRef, menuRef]);
}
