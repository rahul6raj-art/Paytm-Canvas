"use client";

import { useCallback } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { syncSourceToLinkedFile } from "@/lib/craftBridge/clientSync";

/** Push current canvas layers to the linked source file (manual export). */
export function useExportToLinkedSource() {
  const link = useEditorStore((s) => s.codeRoundTripLink);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const designTokens = useEditorStore((s) => s.designTokens);
  const assets = useEditorStore((s) => s.assets);
  const fileName = useEditorStore((s) => s.fileName);
  const sourceHeader = useEditorStore((s) => s.codeRoundTripSourceHeader);
  const updateCodeRoundTripLink = useEditorStore((s) => s.updateCodeRoundTripLink);
  const setCraftBridgeSyncStatus = useEditorStore((s) => s.setCraftBridgeSyncStatus);
  const setCraftBridgeInboundActive = useEditorStore((s) => s.setCraftBridgeInboundActive);

  const canExport =
    !!link?.repoRoot?.trim() && !!link?.sourcePath?.trim();

  return useCallback(async (): Promise<{
    ok: boolean;
    skipped?: boolean;
    absolutePath?: string;
    error?: string;
  }> => {
    if (!canExport || !link) {
      return {
        ok: false,
        error: "Link your repo file first (File → Export React → Source file bridge).",
      };
    }

    setCraftBridgeSyncStatus("syncing", null);
    setCraftBridgeInboundActive(true);
    try {
      const result = await syncSourceToLinkedFile({
        nodes,
        childOrder,
        selectedIds,
        designTokens,
        assets,
        fileName,
        sourceHeader,
        link,
        explicitUserExport: true,
      });

      if (!result.ok) {
        setCraftBridgeSyncStatus("error", result.error);
        return { ok: false, error: result.error };
      }

      if (!result.skipped) {
        // Canvas is the source of truth for this export — do not re-import from preview
        // (that replaces the artboard with a fresh live capture and drops layer edits).
        updateCodeRoundTripLink({
          lastSyncedAt: result.writtenAt,
          lastExportedHash: result.hash,
          lastImportedHash: result.hash,
        });
      }
      setCraftBridgeSyncStatus("synced", null);
      return {
        ok: true,
        skipped: result.skipped,
        absolutePath: result.absolutePath,
      };
    } finally {
      window.setTimeout(() => setCraftBridgeInboundActive(false), 2500);
    }
  }, [
    canExport,
    link,
    nodes,
    childOrder,
    selectedIds,
    designTokens,
    assets,
    fileName,
    sourceHeader,
    updateCodeRoundTripLink,
    setCraftBridgeSyncStatus,
    setCraftBridgeInboundActive,
  ]);
}

export function useCanExportToLinkedSource(): boolean {
  const link = useEditorStore((s) => s.codeRoundTripLink);
  return !!link?.repoRoot?.trim() && !!link?.sourcePath?.trim();
}
