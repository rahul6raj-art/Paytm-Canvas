"use client";

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

const VIEWPORT_PAD = 8;
const DEFAULT_WIDTH = 280;
const RIGHT_PANEL_SELECTOR = "[data-right-properties-panel]";

export type AdjacentPanelDialogPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

export function adjacentPanelDialogStyle(position: AdjacentPanelDialogPosition): CSSProperties {
  return {
    left: position.left,
    top: position.top,
    width: position.width,
    maxHeight: position.maxHeight,
  };
}

/** Dock a floating panel flush to the left edge of the right properties column. */
export function useAdjacentPanelDialogPosition(
  anchorRef: RefObject<HTMLElement | null>,
  open: boolean,
  options?: {
    width?: number;
    gap?: number;
    maxHeight?: number;
    remeasureKey?: unknown;
  },
) {
  const [position, setPosition] = useState<AdjacentPanelDialogPosition>({
    left: VIEWPORT_PAD,
    top: VIEWPORT_PAD,
    width: DEFAULT_WIDTH,
    maxHeight: 420,
  });

  useLayoutEffect(() => {
    if (!open) return;

    const update = () => {
      const width = options?.width ?? DEFAULT_WIDTH;
      const gap = options?.gap ?? 8;
      const maxPreferred = options?.maxHeight ?? 560;
      const vh = window.innerHeight;
      const vw = window.innerWidth;

      const panel = document.querySelector(RIGHT_PANEL_SELECTOR);
      const panelRect = panel?.getBoundingClientRect();
      const panelLeft = panelRect?.left ?? vw - 300;

      let left = panelLeft - width - gap;
      left = Math.max(VIEWPORT_PAD, Math.min(left, vw - width - VIEWPORT_PAD));

      let top = VIEWPORT_PAD;
      const anchor = anchorRef.current;
      if (anchor) {
        top = anchor.getBoundingClientRect().top;
      } else if (panelRect) {
        top = panelRect.top + VIEWPORT_PAD;
      }

      const maxHeight = Math.max(200, Math.min(maxPreferred, vh - VIEWPORT_PAD * 2));
      top = Math.max(VIEWPORT_PAD, Math.min(top, vh - maxHeight - VIEWPORT_PAD));

      setPosition({ left, top, width, maxHeight });
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
    options?.width,
    options?.gap,
    options?.maxHeight,
    options?.remeasureKey,
  ]);

  return position;
}

/** Dock a floating panel beside another fixed element (e.g. color picker left of gradient dialog). */
export function useAdjacentElementDialogPosition(
  elementRef: RefObject<HTMLElement | null>,
  open: boolean,
  options?: {
    width?: number;
    gap?: number;
    maxHeight?: number;
    side?: "left" | "right";
    remeasureKey?: unknown;
  },
) {
  const [position, setPosition] = useState<AdjacentPanelDialogPosition>({
    left: VIEWPORT_PAD,
    top: VIEWPORT_PAD,
    width: 240,
    maxHeight: 420,
  });

  useLayoutEffect(() => {
    if (!open) return;

    const update = () => {
      const width = options?.width ?? 240;
      const gap = options?.gap ?? 8;
      const maxPreferred = options?.maxHeight ?? 480;
      const side = options?.side ?? "left";
      const vh = window.innerHeight;
      const vw = window.innerWidth;

      const element = elementRef.current;
      const elementRect = element?.getBoundingClientRect();
      if (!elementRect) {
        setPosition({ left: VIEWPORT_PAD, top: VIEWPORT_PAD, width, maxHeight: maxPreferred });
        return;
      }

      let left =
        side === "left"
          ? elementRect.left - width - gap
          : elementRect.right + gap;
      left = Math.max(VIEWPORT_PAD, Math.min(left, vw - width - VIEWPORT_PAD));

      let top = elementRect.top;
      const maxHeight = Math.max(
        200,
        Math.min(maxPreferred, elementRect.height, vh - VIEWPORT_PAD * 2),
      );
      top = Math.max(VIEWPORT_PAD, Math.min(top, vh - maxHeight - VIEWPORT_PAD));

      setPosition({ left, top, width, maxHeight });
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
    elementRef,
    options?.width,
    options?.gap,
    options?.maxHeight,
    options?.side,
    options?.remeasureKey,
  ]);

  return position;
}
