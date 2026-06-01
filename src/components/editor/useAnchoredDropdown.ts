"use client";

import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

export type AnchoredMenuPosition = { left: number; top: number };

export function useAnchoredDropdownPosition(
  anchorRef: RefObject<HTMLElement | null>,
  open: boolean,
  gap = 4,
) {
  const [position, setPosition] = useState<AnchoredMenuPosition>({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;

    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      setPosition({ left: r.left, top: r.bottom + gap });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, gap]);

  return position;
}

export function useDismissAnchoredDropdown(
  open: boolean,
  onClose: () => void,
  anchorRef: RefObject<HTMLElement | null>,
  menuRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
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
