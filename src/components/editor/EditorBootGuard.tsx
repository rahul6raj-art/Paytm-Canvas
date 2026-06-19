"use client";

import { useEffect } from "react";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { useEditorStore } from "@/stores/useEditorStore";

const EMPTY_CANVAS_RECOVERY_MS = 6_000;

/**
 * Ensures loading overlays cannot block the editor indefinitely and finalizes hydration on an empty canvas.
 */
export function EditorBootGuard() {
  useEffect(() => {
    const st = useEditorStore.getState();
    if (!st.figImportInProgress) {
      useEditorStore.setState({ documentHydrating: false });
    }

    const emptyRecovery = window.setTimeout(() => {
      const st = useEditorStore.getState();
      if (st.figImportInProgress) return;
      if ((st.childOrder[EDITOR_ROOT_KEY] ?? []).length > 0) return;
      st.applySampleDocumentIfEmpty();
    }, EMPTY_CANVAS_RECOVERY_MS);

    return () => {
      window.clearTimeout(emptyRecovery);
    };
  }, []);

  return null;
}
