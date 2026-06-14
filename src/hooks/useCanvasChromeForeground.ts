"use client";

import { useMemo } from "react";
import { useTheme } from "@/components/ThemeProvider";
import {
  canvasChromeForeground,
  type CanvasChromeForeground,
} from "@/lib/canvasForeground";
import { resolveDisplayCanvasBackgroundHex } from "@/lib/canvasVisual";
import { useEditorStore } from "@/stores/useEditorStore";

/** Chrome colors (frame labels, rulers) matched to the visible pasteboard, including dark UI. */
export function useCanvasChromeForeground(): CanvasChromeForeground {
  const stored = useEditorStore((s) => s.canvasBackgroundColor);
  const { resolved } = useTheme();
  return useMemo(() => {
    const bg = resolveDisplayCanvasBackgroundHex(stored, resolved);
    return canvasChromeForeground(bg);
  }, [stored, resolved]);
}
