"use client";

import { useLayoutEffect, useState } from "react";
import { useEditorStore } from "@/stores/useEditorStore";

const LEFT_SIDEBAR_SELECTOR = "[data-left-sidebar]";

/** Horizontal offset for canvas rulers — clears the floating left sidebar. */
export function useCanvasRulerLeftInset(): number {
  const uiChromeVisible = useEditorStore((s) => s.uiChromeVisible);
  const [leftInset, setLeftInset] = useState(0);

  useLayoutEffect(() => {
    if (!uiChromeVisible) {
      setLeftInset(0);
      return;
    }

    const sync = () => {
      const el = document.querySelector(LEFT_SIDEBAR_SELECTOR);
      if (!el) {
        setLeftInset(0);
        return;
      }
      setLeftInset(Math.round(el.getBoundingClientRect().width));
    };

    sync();
    const el = document.querySelector(LEFT_SIDEBAR_SELECTOR);
    if (!el) return;

    const ro = new ResizeObserver(() => sync());
    ro.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [uiChromeVisible]);

  return leftInset;
}
