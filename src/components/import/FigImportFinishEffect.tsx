"use client";

import { useEffect, useRef } from "react";
import { fitCanvasToImportedDocumentWithRetry } from "@/lib/viewportZoom";
import { waitForNextPaint } from "@/lib/figImport/figImportRuntime";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { useEditorStore } from "@/stores/useEditorStore";

/** Re-fit the canvas after Figma import once the viewport is mounted and layers are painted. */
export function FigImportFinishEffect() {
  const busy = useEditorStore((s) => s.figImportInProgress);
  const wasBusy = useRef(false);

  useEffect(() => {
    if (wasBusy.current && !busy) {
      void (async () => {
        await waitForNextPaint();
        await waitForNextPaint();
        await waitForNextPaint();
        const st = useEditorStore.getState();
        const roots = st.childOrder[EDITOR_ROOT_KEY] ?? [];
        if (roots.length === 0) return;
        await fitCanvasToImportedDocumentWithRetry();
      })();
    }
    wasBusy.current = busy;
  }, [busy]);

  return null;
}
