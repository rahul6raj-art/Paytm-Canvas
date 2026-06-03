"use client";

import { useEffect } from "react";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { useEditorStore } from "@/stores/useEditorStore";

const FIG_IMPORT_WATCHDOG_MS = 240_000;
const EMPTY_CANVAS_RECOVERY_MS = 6_000;

/**
 * Ensures loading overlays cannot block the editor indefinitely and recovers an empty canvas.
 */
export function EditorBootGuard() {
  useEffect(() => {
    const st = useEditorStore.getState();
    if (!st.figImportInProgress) {
      useEditorStore.setState({ documentHydrating: false });
    }

    const figWatchdog = window.setTimeout(() => {
      const st = useEditorStore.getState();
      if (!st.figImportInProgress) return;
      st.resetEditorBlockingState();
      window.alert(
        "Figma import took too long and was stopped. Try a smaller .fig file, or clear browser storage (key: paytm-craft-document-v1) and import again.",
      );
    }, FIG_IMPORT_WATCHDOG_MS);

    const emptyRecovery = window.setTimeout(() => {
      const st = useEditorStore.getState();
      if (st.figImportInProgress) return;
      if ((st.childOrder[EDITOR_ROOT_KEY] ?? []).length > 0) return;
      st.applySampleDocumentIfEmpty();
    }, EMPTY_CANVAS_RECOVERY_MS);

    return () => {
      window.clearTimeout(figWatchdog);
      window.clearTimeout(emptyRecovery);
    };
  }, []);

  return null;
}
