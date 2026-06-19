export type CraftBridgeConflictPolicy = "ask" | "source-wins" | "canvas-wins";

export type SyncConflictKind = "none" | "source-only" | "both";

export type SyncConflictInput = {
  sourceHash: string;
  lastImportedHash?: string;
  lastExportedHash?: string;
  canvasExportHash: string;
};

/**
 * Classifies whether source and/or canvas changed since last sync.
 * - source-only: safe to auto-import from source
 * - both: concurrent edits — apply conflictPolicy
 */
export function classifySyncConflict(input: SyncConflictInput): SyncConflictKind {
  const { sourceHash, lastImportedHash, lastExportedHash, canvasExportHash } = input;

  const sourceChanged =
    !!sourceHash &&
    sourceHash !== lastImportedHash &&
    sourceHash !== lastExportedHash;

  if (!sourceChanged) return "none";

  const canvasChanged =
    !!canvasExportHash &&
    !!lastExportedHash &&
    canvasExportHash !== lastExportedHash;

  if (canvasChanged) return "both";
  return "source-only";
}

export function shouldAutoImportFromSource(
  kind: SyncConflictKind,
  policy: CraftBridgeConflictPolicy,
): boolean {
  if (kind === "none") return false;
  if (kind === "source-only") return true;
  if (policy === "source-wins") return true;
  if (policy === "canvas-wins") return false;
  return false;
}

export function shouldSurfaceConflict(
  kind: SyncConflictKind,
  policy: CraftBridgeConflictPolicy,
): boolean {
  return kind === "both" && policy === "ask";
}
