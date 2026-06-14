"use client";

import { startTransition, useEffect, useRef } from "react";
import {
  clearLocalDocument,
  documentToEditorPatch,
  isBrokenOrphanedLocalDocument,
  readLocalDocument,
  serializePersistStable,
} from "@/lib/documentPersistence";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  needsNodeHierarchyRepair,
  reconcileHierarchyLight,
  repairNodeHierarchyIfNeeded,
} from "@/lib/editorGraph";
import { editorPatchFromPage } from "@/lib/editorPages";
import { getRouteApiFileId, hydrateEditorFromApiFile } from "@/lib/apiFileHydration";
import { isPaytmCraftHttpApiMode } from "@/lib/env";
import { FIG_IMPORT_POST_LAYOUT_NODE_CAP } from "@/lib/figImport/figImportConstants";
import { getSyncProvider } from "@/lib/syncProviderSingleton";
import { toPersistSlice, useEditorStore } from "@/stores/useEditorStore";

const CHEAP_FINGERPRINT_NODE_THRESHOLD = 5_000;

function persistFingerprint(state: ReturnType<typeof useEditorStore.getState>): string {
  const slice = toPersistSlice(state);
  const nodeCount = Object.keys(slice.nodes).length;
  if (nodeCount > CHEAP_FINGERPRINT_NODE_THRESHOLD) {
    return `${slice.fileName}|n:${nodeCount}|p:${slice.activePageId}|r:${state.documentHydrationRevision}`;
  }
  return serializePersistStable(slice);
}

function scheduleIdle(task: () => void, timeoutMs = 250): () => void {
  if (typeof window === "undefined") {
    task();
    return () => {};
  }
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(task, { timeout: timeoutMs });
    return () => cancelIdleCallback(id);
  }
  const id = window.setTimeout(task, 0);
  return () => window.clearTimeout(id);
}

function hasCanvasRootDesign(state: ReturnType<typeof useEditorStore.getState>): boolean {
  return (state.childOrder[EDITOR_ROOT_KEY] ?? []).length > 0;
}

function applyLocalDocumentToStore(localDoc: ReturnType<typeof readLocalDocument>): void {
  if (!localDoc) return;
  const st = useEditorStore.getState();
  startTransition(() => {
    useEditorStore.setState({
      ...documentToEditorPatch(localDoc),
      documentHydrating: false,
      documentHydrationRevision: st.documentHydrationRevision + 1,
      documentSaveStatus: "saved",
      historyPast: [],
      historyFuture: [],
    });
  });
}

function restoreFromLocalStorage(): void {
  const st = useEditorStore.getState();
  if (st.figImportInProgress) return;

  const hasInMemoryDesign = hasCanvasRootDesign(st);

  let localDoc = readLocalDocument();
  if (localDoc && isBrokenOrphanedLocalDocument(localDoc)) {
    console.warn(
      "[Paytm Craft] Discarding corrupted local document (layers not attached to canvas).",
    );
    clearLocalDocument();
    localDoc = null;
  }

  if (localDoc && !hasInMemoryDesign) {
    applyLocalDocumentToStore(localDoc);
    return;
  }

  if (!localDoc && !hasInMemoryDesign) {
    useEditorStore.getState().applySampleDocumentIfEmpty();
  }
}

/**
 * Keeps storage in sync via {@link LocalSyncProvider} with a debounced auto-save.
 * Hydration is deferred so the editor shell can paint before parsing localStorage.
 */
export function EditorDocumentPersistence() {
  const lastSavedRef = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistIdleRef = useRef<number | null>(null);
  const repairPassRef = useRef(0);
  const hydrationStartedRef = useRef(false);
  const skippedHydrationDuringImportRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let unsubStore: (() => void) | null = null;
    let unsubDoc: (() => void) | null = null;
    let unsubRepair: (() => void) | null = null;
    let unsubImportHydration: (() => void) | null = null;
    const cancelTimers: Array<() => void> = [];

    const run = (fn: () => void) => {
      if (cancelled) return;
      fn();
    };

    const finishSubscriptions = () => {
      if (cancelled) return;
      lastSavedRef.current = persistFingerprint(useEditorStore.getState());

      unsubRepair = useEditorStore.subscribe((state, prev) => {
        if (!prev) return;
        if (state.figImportInProgress || prev.figImportInProgress) return;
        if (state.nodes === prev.nodes && state.childOrder === prev.childOrder) return;
        if (!needsNodeHierarchyRepair(state.nodes, state.childOrder)) return;

        const wholesaleReplace = state.documentHydrationRevision !== prev.documentHydrationRevision;
        const nodeCount = Object.keys(state.nodes).length;
        if (wholesaleReplace && nodeCount > FIG_IMPORT_POST_LAYOUT_NODE_CAP) return;

        const pass = ++repairPassRef.current;
        scheduleIdle(() => {
          if (cancelled || pass !== repairPassRef.current) return;
          const live = useEditorStore.getState();
          if (!needsNodeHierarchyRepair(live.nodes, live.childOrder)) return;
          const repaired = wholesaleReplace
            ? reconcileHierarchyLight(live.nodes, live.childOrder)
            : repairNodeHierarchyIfNeeded(live.nodes, live.childOrder);
          if (
            repaired.nodes === live.nodes &&
            repaired.childOrder === live.childOrder
          ) {
            return;
          }
          startTransition(() => {
            useEditorStore.setState(repaired);
          });
        });
      });

      unsubStore = useEditorStore.subscribe((state, prev) => {
        if (!prev) return;
        if (state.figImportInProgress || prev.figImportInProgress) return;

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
            state.documentSaveStatus === "api-save-failed" ||
            state.documentSaveStatus === "api-conflict")
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
          persistIdleRef.current = requestIdleCallback(runCheck, { timeout: 500 });
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
    };

    const repairPagesInBackground = () => {
      scheduleIdle(() => {
        run(() => {
          const afterHydrate = useEditorStore.getState();
          if (afterHydrate.figImportInProgress) {
            finishSubscriptions();
            return;
          }
          const nodeCount = Object.keys(afterHydrate.nodes).length;
          if (nodeCount > FIG_IMPORT_POST_LAYOUT_NODE_CAP) {
            finishSubscriptions();
            return;
          }
          let pagesChanged = false;
          const pages = { ...afterHydrate.pages };
          for (const [pageId, page] of Object.entries(pages)) {
            if (!needsNodeHierarchyRepair(page.nodes, page.childOrder)) continue;
            pagesChanged = true;
            const repaired = repairNodeHierarchyIfNeeded(page.nodes, page.childOrder);
            pages[pageId] = { ...page, ...repaired };
          }
          if (pagesChanged) {
            const active = pages[afterHydrate.activePageId]!;
            startTransition(() => {
              useEditorStore.setState({
                pages,
                ...editorPatchFromPage(active),
              });
            });
          }

          const live = useEditorStore.getState();
          const liveRepaired = repairNodeHierarchyIfNeeded(live.nodes, live.childOrder);
          if (
            liveRepaired.nodes !== live.nodes ||
            liveRepaired.childOrder !== live.childOrder
          ) {
            startTransition(() => {
              useEditorStore.setState(liveRepaired);
            });
          }

          finishSubscriptions();
        });
      }, 600);
    };

    unsubImportHydration = useEditorStore.subscribe((state, prev) => {
      if (!prev?.figImportInProgress || state.figImportInProgress) return;
      if (!skippedHydrationDuringImportRef.current) return;
      skippedHydrationDuringImportRef.current = false;

      const finishPostImportHydration = () => {
        const live = useEditorStore.getState();
        if (hasCanvasRootDesign(live)) {
          lastSavedRef.current = persistFingerprint(live);
          return;
        }
        try {
          restoreFromLocalStorage();
        } catch (e) {
          console.warn("[Paytm Craft] Post-import hydration failed", e);
          clearLocalDocument();
          if (!hasCanvasRootDesign(useEditorStore.getState())) {
            useEditorStore.getState().applySampleDocumentIfEmpty();
          }
        }
      };

      const waitForImportedDesign = (attemptsLeft: number) => {
        const live = useEditorStore.getState();
        if (hasCanvasRootDesign(live)) {
          lastSavedRef.current = persistFingerprint(live);
          return;
        }
        if (attemptsLeft <= 0) {
          finishPostImportHydration();
          return;
        }
        requestAnimationFrame(() => waitForImportedDesign(attemptsLeft - 1));
      };

      if (hasCanvasRootDesign(state)) {
        finishPostImportHydration();
        return;
      }
      waitForImportedDesign(12);
    });

    const completeHydration = () => {
      useEditorStore.setState({ documentHydrating: false });
      repairPagesInBackground();
    };

    const runHydrationWork = async () => {
      if (hydrationStartedRef.current) return;
      hydrationStartedRef.current = true;

      if (useEditorStore.getState().figImportInProgress) {
        skippedHydrationDuringImportRef.current = true;
        completeHydration();
        return;
      }

      const routeFileId = getRouteApiFileId();
      const st = useEditorStore.getState();
      const shouldHydrateRoute =
        isPaytmCraftHttpApiMode() &&
        routeFileId &&
        (!st.isApiBackedFile || st.apiFileId !== routeFileId);

      if (shouldHydrateRoute) {
        try {
          const ok = await hydrateEditorFromApiFile(routeFileId);
          if (!ok) {
            console.warn("[Paytm Craft] API file not found for route:", routeFileId);
            restoreFromLocalStorage();
          }
        } catch (e) {
          console.warn("[Paytm Craft] API route hydration failed", e);
          restoreFromLocalStorage();
        }
        completeHydration();
        return;
      }

      try {
        restoreFromLocalStorage();
      } catch (e) {
        console.warn("[Paytm Craft] Failed to restore from browser storage", e);
        clearLocalDocument();
        if (!hasCanvasRootDesign(useEditorStore.getState())) {
          useEditorStore.getState().applySampleDocumentIfEmpty();
        }
      }
      completeHydration();
    };

    useEditorStore.setState({ documentHydrating: false });
    cancelTimers.push(scheduleIdle(() => run(() => void runHydrationWork()), 80));

    const emptyRecovery = window.setTimeout(() => {
      if (cancelled) return;
      const live = useEditorStore.getState();
      if (hasCanvasRootDesign(live)) return;
      if (live.figImportInProgress) return;
      live.applySampleDocumentIfEmpty();
    }, 5_000);
    cancelTimers.push(() => window.clearTimeout(emptyRecovery));

    return () => {
      cancelled = true;
      repairPassRef.current += 1;
      for (const cancel of cancelTimers) cancel();
      unsubImportHydration?.();
      unsubRepair?.();
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
