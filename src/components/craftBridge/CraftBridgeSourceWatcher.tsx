"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  classifySyncConflict,
  shouldAutoImportFromSource,
  shouldSurfaceConflict,
} from "@paytm-craft/bridge/client";
import { useEditorStore } from "@/stores/useEditorStore";
import { fetchLinkedSourceContent, importFromLinkedSourceFile } from "@/lib/craftBridge/clientImport";
import { computeCanvasExportHash, buildLinkedExportSource, type SyncSourceInput } from "@/lib/craftBridge/clientSync";

const SOURCE_POLL_MS = 2000;
const INBOUND_PAUSE_MS = 2500;

/** Polls linked source file and re-imports when IDE edits change it (source → canvas). */
export function CraftBridgeSourceWatcher() {
  const link = useEditorStore((s) => s.codeRoundTripLink);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const designTokens = useEditorStore((s) => s.designTokens);
  const assets = useEditorStore((s) => s.assets);
  const fileName = useEditorStore((s) => s.fileName);
  const sourceHeader = useEditorStore((s) => s.codeRoundTripSourceHeader);
  const applyGeneratedDesign = useEditorStore((s) => s.applyGeneratedDesign);
  const setCodeRoundTripSourceHeader = useEditorStore((s) => s.setCodeRoundTripSourceHeader);
  const updateCodeRoundTripLink = useEditorStore((s) => s.updateCodeRoundTripLink);
  const setCraftBridgeInboundActive = useEditorStore((s) => s.setCraftBridgeInboundActive);
  const setCraftBridgeSyncStatus = useEditorStore((s) => s.setCraftBridgeSyncStatus);
  const setCraftBridgeConflict = useEditorStore((s) => s.setCraftBridgeConflict);
  const clearCraftBridgeConflict = useEditorStore((s) => s.clearCraftBridgeConflict);
  const documentHydrating = useEditorStore((s) => s.documentHydrating);
  const figImportInProgress = useEditorStore((s) => s.figImportInProgress);
  const craftBridgeInboundActive = useEditorStore((s) => s.craftBridgeInboundActive);

  const importingRef = useRef(false);
  const pauseOutboundUntilRef = useRef(0);

  const syncInput: SyncSourceInput | null = link
    ? {
        nodes,
        childOrder,
        selectedIds,
        designTokens,
        assets,
        fileName,
        sourceHeader,
        link,
      }
    : null;

  const applySourceImport = useCallback(async () => {
    if (!link?.repoRoot?.trim() || !link.sourcePath?.trim()) return;
    if (importingRef.current) return;

    importingRef.current = true;
    setCraftBridgeInboundActive(true);
    setCraftBridgeSyncStatus("syncing", null);
    clearCraftBridgeConflict();

    try {
      const result = await importFromLinkedSourceFile(link);
      if (!result.ok) {
        setCraftBridgeSyncStatus("error", result.error);
        return;
      }

      await applyGeneratedDesign(result.slice, "replace", {
        recordHistory: true,
        zoomToFit: false,
      });

      if (result.sourceHeader) {
        setCodeRoundTripSourceHeader(result.sourceHeader);
      }

      updateCodeRoundTripLink({
        lastImportedHash: result.hash,
        lastExportedHash: result.hash,
        lastSyncedAt: new Date().toISOString(),
      });

      pauseOutboundUntilRef.current = Date.now() + INBOUND_PAUSE_MS;
      setCraftBridgeSyncStatus("synced", null);
    } catch (e) {
      setCraftBridgeSyncStatus(
        "error",
        e instanceof Error ? e.message : "Source import failed.",
      );
    } finally {
      importingRef.current = false;
      window.setTimeout(() => setCraftBridgeInboundActive(false), INBOUND_PAUSE_MS);
    }
  }, [
    link,
    applyGeneratedDesign,
    setCodeRoundTripSourceHeader,
    updateCodeRoundTripLink,
    setCraftBridgeInboundActive,
    setCraftBridgeSyncStatus,
    setCraftBridgeConflict,
    clearCraftBridgeConflict,
  ]);

  useEffect(() => {
    if (!link?.watchSource) return;
    if (!link.repoRoot?.trim() || !link.sourcePath?.trim()) return;
    if (documentHydrating || figImportInProgress) return;
    if (!syncInput) return;

    let cancelled = false;
    const policy = link.conflictPolicy ?? "ask";

    const tick = async () => {
      if (cancelled || importingRef.current || craftBridgeInboundActive) return;
      if (Date.now() < pauseOutboundUntilRef.current) return;

      const fetched = await fetchLinkedSourceContent(link);
      if ("ok" in fetched && fetched.ok === false) return;
      const read = fetched as { hash: string; content: string };

      if (link.lastImportedHash && read.hash === link.lastImportedHash) {
        clearCraftBridgeConflict();
        return;
      }
      if (link.lastExportedHash && read.hash === link.lastExportedHash) {
        updateCodeRoundTripLink({ lastImportedHash: read.hash });
        clearCraftBridgeConflict();
        return;
      }

      const canvasExportHash = (await computeCanvasExportHash(syncInput)) ?? "";
      const canvasContent = buildLinkedExportSource(syncInput) ?? "";
      const kind = classifySyncConflict({
        sourceHash: read.hash,
        lastImportedHash: link.lastImportedHash,
        lastExportedHash: link.lastExportedHash,
        canvasExportHash,
      });

      if (kind === "none") return;

      if (shouldSurfaceConflict(kind, policy)) {
        setCraftBridgeConflict({
          sourceHash: read.hash,
          canvasHash: canvasExportHash,
          sourceContent: read.content,
          canvasContent,
        });
        setCraftBridgeSyncStatus("idle", null);
        return;
      }

      if (shouldAutoImportFromSource(kind, policy)) {
        await applySourceImport();
      }
    };

    const id = window.setInterval(() => {
      void tick();
    }, SOURCE_POLL_MS);

    void tick();

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    link,
    syncInput,
    documentHydrating,
    figImportInProgress,
    craftBridgeInboundActive,
    applySourceImport,
    updateCodeRoundTripLink,
    setCraftBridgeConflict,
    clearCraftBridgeConflict,
    setCraftBridgeSyncStatus,
  ]);

  return null;
}

/** Imperative helper for manual "Import from source" button. */
export function useImportFromLinkedSource() {
  const link = useEditorStore((s) => s.codeRoundTripLink);
  const applyGeneratedDesign = useEditorStore((s) => s.applyGeneratedDesign);
  const setCodeRoundTripSourceHeader = useEditorStore((s) => s.setCodeRoundTripSourceHeader);
  const updateCodeRoundTripLink = useEditorStore((s) => s.updateCodeRoundTripLink);
  const setCraftBridgeInboundActive = useEditorStore((s) => s.setCraftBridgeInboundActive);
  const setCraftBridgeSyncStatus = useEditorStore((s) => s.setCraftBridgeSyncStatus);
  const clearCraftBridgeConflict = useEditorStore((s) => s.clearCraftBridgeConflict);

  return useCallback(async () => {
    if (!link?.repoRoot?.trim() || !link.sourcePath?.trim()) return false;

    setCraftBridgeInboundActive(true);
    setCraftBridgeSyncStatus("syncing", null);
    clearCraftBridgeConflict();

    try {
      const result = await importFromLinkedSourceFile(link);
      if (!result.ok) {
        setCraftBridgeSyncStatus("error", result.error);
        return false;
      }

      await applyGeneratedDesign(result.slice, "replace", {
        recordHistory: true,
        zoomToFit: true,
      });

      if (result.sourceHeader) {
        setCodeRoundTripSourceHeader(result.sourceHeader);
      }

      updateCodeRoundTripLink({
        lastImportedHash: result.hash,
        lastExportedHash: result.hash,
        lastSyncedAt: new Date().toISOString(),
      });
      setCraftBridgeSyncStatus("synced", null);
      return true;
    } catch (e) {
      setCraftBridgeSyncStatus(
        "error",
        e instanceof Error ? e.message : "Source import failed.",
      );
      return false;
    } finally {
      window.setTimeout(() => setCraftBridgeInboundActive(false), INBOUND_PAUSE_MS);
    }
  }, [
    link,
    applyGeneratedDesign,
    setCodeRoundTripSourceHeader,
    updateCodeRoundTripLink,
    setCraftBridgeInboundActive,
    setCraftBridgeSyncStatus,
    clearCraftBridgeConflict,
  ]);
}
