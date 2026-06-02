"use client";

import { useEffect, useRef } from "react";
import {
  documentToEditorPatch,
  readLocalDocument,
  serializePersistStable,
} from "@/lib/documentPersistence";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { needsNodeHierarchyRepair, repairNodeHierarchy } from "@/lib/editorGraph";
import { editorPatchFromPage } from "@/lib/editorPages";
import { getSyncProvider } from "@/lib/syncProviderSingleton";
import { toPersistSlice, useEditorStore } from "@/stores/useEditorStore";

function persistFingerprint(state: ReturnType<typeof useEditorStore.getState>): string {
  return serializePersistStable(toPersistSlice(state));
}

/**
 * Keeps storage in sync via {@link LocalSyncProvider} with a debounced auto-save.
 * Document data is read synchronously when the store is created — no blocking hydration pass.
 */
export function EditorDocumentPersistence() {
  const lastSavedRef = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistIdleRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubStore: (() => void) | null = null;
    let unsubDoc: (() => void) | null = null;

    const st = useEditorStore.getState();
    const hasInMemoryDesign = (st.childOrder[EDITOR_ROOT_KEY] ?? []).length > 0;
    const localDoc = readLocalDocument();
    // Keep designs applied before navigation (e.g. React import from dashboard).
    if (localDoc && !hasInMemoryDesign) {
      useEditorStore.setState({
        ...documentToEditorPatch(localDoc),
        documentHydrating: false,
        documentHydrationRevision: st.documentHydrationRevision + 1,
        documentSaveStatus: "saved",
        historyPast: [],
        historyFuture: [],
      });
    } else if (!localDoc) {
      useEditorStore.getState().applySampleDocumentIfEmpty();
      useEditorStore.setState({ documentHydrating: false });
    } else {
      useEditorStore.setState({ documentHydrating: false });
    }

    // Repair desynced trees (parentId vs childOrder) from older builds or partial updates.
    const afterHydrate = useEditorStore.getState();
    let pagesChanged = false;
    const pages = { ...afterHydrate.pages };
    for (const [pageId, page] of Object.entries(pages)) {
      if (!needsNodeHierarchyRepair(page.nodes, page.childOrder)) continue;
      pagesChanged = true;
      const repaired = repairNodeHierarchy(page.nodes, page.childOrder);
      pages[pageId] = { ...page, ...repaired };
    }
    if (pagesChanged) {
      const active = pages[afterHydrate.activePageId]!;
      useEditorStore.setState({
        pages,
        ...editorPatchFromPage(active),
      });
    }

    // Always repair the active canvas once (idempotent) so render matches selection.
    const live = useEditorStore.getState();
    const liveRepaired = repairNodeHierarchy(live.nodes, live.childOrder);
    if (needsNodeHierarchyRepair(live.nodes, live.childOrder)) {
      useEditorStore.setState(liveRepaired);
    }

    lastSavedRef.current = persistFingerprint(useEditorStore.getState());

    unsubStore = useEditorStore.subscribe((state, prev) => {
      if (!prev) return;

      if (state.documentHydrationRevision !== prev.documentHydrationRevision) {
        lastSavedRef.current = persistFingerprint(state);
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        return;
      }

      if (
        prev.documentSaveStatus === "saving" &&
        (state.documentSaveStatus === "saved" ||
          state.documentSaveStatus === "saved-api" ||
          state.documentSaveStatus === "api-save-failed")
      ) {
        lastSavedRef.current = persistFingerprint(state);
        return;
      }

      if (prev.documentSaveStatus === "saving" && state.documentSaveStatus === "unsaved") {
        return;
      }

      const runCheck = () => {
        persistIdleRef.current = null;
        const fp = persistFingerprint(state);
        const fpPrev = persistFingerprint(prev);
        if (fp === fpPrev || fp === lastSavedRef.current) return;

        useEditorStore.setState({ documentSaveStatus: "unsaved" });

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          debounceRef.current = null;
          useEditorStore.getState().saveToLocal();
        }, 2000);
      };

      if (typeof requestIdleCallback === "function") {
        if (persistIdleRef.current != null) cancelIdleCallback(persistIdleRef.current);
        persistIdleRef.current = requestIdleCallback(runCheck, { timeout: 120 });
      } else {
        runCheck();
      }
    });

    unsubDoc = getSyncProvider().subscribeToDocument((doc) => {
      if (cancelled) return;
      const applied = useEditorStore.getState().applyPersistedDocumentIfClean(doc);
      if (applied) {
        lastSavedRef.current = persistFingerprint(useEditorStore.getState());
      }
    });

    return () => {
      cancelled = true;
      unsubStore?.();
      unsubDoc?.();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (persistIdleRef.current != null) {
        if (typeof cancelIdleCallback === "function") cancelIdleCallback(persistIdleRef.current);
        else clearTimeout(persistIdleRef.current);
        persistIdleRef.current = null;
      }
    };
  }, []);

  return null;
}
