"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { layerPanelChildIds } from "@/lib/editorGraph";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";
import { craftEngineDocumentFromStore } from "@/engine/craftEngineDocument";
import { syncCraftEngineImageAssets, resetCraftEngineImageUploads } from "@/engine/craftEngineImageBridge";
import {
  resetCraftEngineFontUploads,
  syncCraftEngineTextFonts,
} from "@/engine/craftEngineFontBridge";
import { resetCraftEngineSyncAfterHistory } from "@/engine/craftEngineHistorySync";
import {
  createCraftEngineSyncState,
  syncCraftEngineDocument,
} from "@/engine/craftEngineIncrementalSync";
import { CRAFT_ENGINE_SYNC_NODE_CAP } from "@/engine/craftEngineVersion";
import { createCraftEngine } from "@/engine/craftEngineLoader";
import { shouldElideCompositorDocumentSync, isWasmDocumentMutationIdle } from "@/engine/craftEngineAuthorityMirror";
import { refreshWasmHistoryFlags } from "@/engine/craftEngineAuthoritySync";
import { isWasmDocumentAuthority } from "@/engine/craftEngineAuthority";
import {
  consumeCraftEngineForceFullSync,
  consumeCraftEngineWasmBootstrap,
  registerCraftEngine,
  registerCraftEngineSyncState,
} from "@/engine/craftEngineRegistry";
import type { CraftEngineInstance } from "@/engine/craftEngineTypes";
import { cn } from "@/lib/utils";

function readDevicePixelRatio(): number {
  if (typeof window === "undefined") return 1;
  return window.devicePixelRatio || 1;
}

/**
 * WASM GPU compositor underlay. SVG (`SvgSceneRenderer`) is the visible scene in native mode;
 * the WebGPU surface is kept alive for sync/hit infrastructure but not shown (opaque black flicker).
 */
export function NativeSceneCompositor({
  viewportRef,
}: {
  viewportRef: RefObject<HTMLDivElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CraftEngineInstance | null>(null);
  const syncStateRef = useRef(createCraftEngineSyncState());
  const forceFullSyncRef = useRef(false);
  const wasmBootstrappedRef = useRef(false);
  const wasApplyingHistoryRef = useRef(false);
  const [engineReady, setEngineReady] = useState(false);
  const [backendLabel, setBackendLabel] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);

  const zoom = useEditorStore((s) => s.zoom);
  const pan = useEditorStore((s) => s.pan);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const assets = useEditorStore((s) => s.assets);
  const fontAssets = useEditorStore((s) => s.fontAssets);
  const rootIds = useMemo(
    () => layerPanelChildIds(ROOT, nodes, childOrder),
    [nodes, childOrder],
  );
  const isApplyingHistory = useEditorStore((s) => s.isApplyingHistory);
  const transformInteractionMode = useEditorStore((s) => s.transformInteractionMode);
  const isMovingSelection = useEditorStore((s) => s.isMovingSelection);

  const resizeEngine = useCallback(() => {
    const engine = engineRef.current;
    const viewport = viewportRef.current;
    if (!engine || !viewport) return;
    const rect = viewport.getBoundingClientRect();
    const dpr = readDevicePixelRatio();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    engine.resize(w, h, dpr);
  }, [viewportRef]);

  const documentSlice = useMemo(
    () => craftEngineDocumentFromStore({ nodes, childOrder, rootIds, assets }),
    [nodes, childOrder, rootIds, assets],
  );

  const drawFrame = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setViewport(pan.x, pan.y, zoom);
    try {
      engine.render();
    } catch (e) {
      console.warn("[craft-engine] render failed", e);
    }
  }, [pan.x, pan.y, zoom]);

  const runDocumentSync = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (useEditorStore.getState().figImportInProgress) return;

    const nodeCount = Object.keys(nodes).length;
    if (nodeCount > CRAFT_ENGINE_SYNC_NODE_CAP) {
      setSyncWarning(
        `Native engine skipped sync for ${nodeCount.toLocaleString()} layers (limit ${CRAFT_ENGINE_SYNC_NODE_CAP.toLocaleString()}). The SVG canvas still renders.`,
      );
      return;
    }
    setSyncWarning(null);

    const forceFull = forceFullSyncRef.current || consumeCraftEngineForceFullSync();
    forceFullSyncRef.current = false;
    const wasmBootstrapRequested = consumeCraftEngineWasmBootstrap();
    const wasmBootstrap =
      isWasmDocumentAuthority() &&
      !forceFull &&
      (wasmBootstrapRequested || !wasmBootstrappedRef.current);
    await syncCraftEngineImageAssets(engine, nodes, assets);
    await syncCraftEngineTextFonts(engine, nodes, fontAssets);
    if (
      !forceFull &&
      !wasmBootstrap &&
      shouldElideCompositorDocumentSync(documentSlice, syncStateRef.current)
    ) {
      return;
    }
    try {
      const mode = syncCraftEngineDocument(engine, documentSlice, syncStateRef.current, {
        forceFull,
        wasmBootstrap,
      });
      if (mode === "bootstrap") {
        wasmBootstrappedRef.current = true;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn("[craft-engine] document sync failed", e);
      forceFullSyncRef.current = true;
      syncStateRef.current = createCraftEngineSyncState();
      registerCraftEngineSyncState(syncStateRef.current);
      wasmBootstrappedRef.current = false;
      try {
        syncCraftEngineDocument(engine, documentSlice, syncStateRef.current, { forceFull: true });
        setSyncWarning(null);
      } catch (retryErr) {
        const retryMessage = retryErr instanceof Error ? retryErr.message : String(retryErr);
        setSyncWarning(
          `Native engine sync failed: ${message || retryMessage}. The SVG canvas still renders.`,
        );
        throw retryErr;
      }
    }
  }, [documentSlice, nodes, assets, fontAssets]);

  const runDocumentSyncRef = useRef(runDocumentSync);
  runDocumentSyncRef.current = runDocumentSync;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    void (async () => {
      try {
        const engine = await createCraftEngine(canvas);
        if (cancelled) return;
        engineRef.current = engine;
        registerCraftEngine(engine);
        registerCraftEngineSyncState(syncStateRef.current);
        setBackendLabel(engine.backendLabel());
        setEngineReady(true);
        setLoadError(null);
        resizeEngine();
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setLoadError(message);
        console.error("[craft-engine] init failed", e);
        return;
      }

      try {
        await runDocumentSyncRef.current();
        refreshWasmHistoryFlags();
        drawFrame();
      } catch (e) {
        if (cancelled) return;
        console.warn("[craft-engine] post-init sync/render failed", e);
      }
    })();

    return () => {
      cancelled = true;
      engineRef.current = null;
      registerCraftEngine(null);
      registerCraftEngineSyncState(null);
      resetCraftEngineImageUploads();
      resetCraftEngineFontUploads();
      syncStateRef.current = createCraftEngineSyncState();
      wasmBootstrappedRef.current = false;
      setEngineReady(false);
      setSyncWarning(null);
    };
  }, [resizeEngine, drawFrame]);

  useEffect(() => {
    if (!engineReady) return;
    resizeEngine();
    drawFrame();
  }, [engineReady, resizeEngine, drawFrame]);

  useEffect(() => {
    if (wasApplyingHistoryRef.current && !isApplyingHistory) {
      const reset = resetCraftEngineSyncAfterHistory(syncStateRef.current);
      syncStateRef.current = reset.state;
      registerCraftEngineSyncState(syncStateRef.current);
      forceFullSyncRef.current = reset.forceFull;
    }
    wasApplyingHistoryRef.current = isApplyingHistory;
  }, [isApplyingHistory]);

  useEffect(() => {
    if (!engineReady) return;
    if (!isWasmDocumentMutationIdle()) return;
    if (useEditorStore.getState().figImportInProgress) return;

    const run = () => {
      void runDocumentSyncRef
        .current()
        .then(() => drawFrame())
        .catch((e) => console.warn("[craft-engine] sync failed", e));
    };

    if (typeof requestIdleCallback === "function") {
      const idleId = requestIdleCallback(run, { timeout: 2500 });
      return () => cancelIdleCallback(idleId);
    }
    const timerId = window.setTimeout(run, 0);
    return () => window.clearTimeout(timerId);
  }, [
    engineReady,
    documentSlice,
    drawFrame,
    transformInteractionMode,
    isMovingSelection,
  ]);

  useEffect(() => {
    if (!engineReady) return;
    drawFrame();
  }, [engineReady, drawFrame, pan.x, pan.y, zoom]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !engineReady) return;
    const observer = new ResizeObserver(() => {
      resizeEngine();
      drawFrame();
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [viewportRef, engineReady, resizeEngine, drawFrame]);

  return (
    <>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-[1]",
          !engineReady && "invisible",
        )}
        data-native-scene-compositor
        data-engine-ready={engineReady ? "true" : "false"}
        data-gpu-backend={backendLabel ?? undefined}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full opacity-0"
          aria-hidden
        />
      </div>
      {loadError ? (
        <div
          className="pointer-events-none absolute bottom-3 left-3 z-[3] max-w-sm rounded-md border border-red-500/40 bg-red-950/80 px-3 py-2 text-xs text-red-100"
          data-native-engine-error
        >
          Native engine failed: {loadError}. Run <code>npm run build:engine</code>, hard-refresh the
          page, and reload.
        </div>
      ) : null}
      {!loadError && syncWarning ? (
        <div
          className="pointer-events-none absolute bottom-3 left-3 z-[3] max-w-sm rounded-md border border-amber-500/40 bg-amber-950/80 px-3 py-2 text-xs text-amber-100"
          data-native-engine-warning
        >
          {syncWarning}
        </div>
      ) : null}
    </>
  );
}
