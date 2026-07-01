export type CodeRoundTripSyncMode = "manual" | "auto";

export type CraftBridgeConflictPolicy = "ask" | "source-wins" | "canvas-wins";

export type CodeRoundTripLink = {
  sourcePath: string;
  repoRoot: string;
  /** Relative paths to companion `.css` files (page folder round-trip). */
  cssPaths?: string[];
  previewUrl?: string;
  syncMode: CodeRoundTripSyncMode;
  watchSource?: boolean;
  lastSyncedAt?: string;
  lastExportedHash?: string;
  lastImportedHash?: string;
  conflictPolicy?: CraftBridgeConflictPolicy;
};

export type CraftLinkManifest = {
  craftUrl: string;
  repoRoot?: string;
  bridgeToken?: string;
  links: Array<{
    sourcePath: string;
    cssPaths?: string[];
    previewUrl?: string;
    syncMode?: CodeRoundTripSyncMode;
    watchSource?: boolean;
    conflictPolicy?: CraftBridgeConflictPolicy;
  }>;
};

export type CraftBridgeWriteSourceRequest = {
  repoRoot: string;
  sourcePath: string;
  content: string;
  ifMatchHash?: string;
};

export type CraftBridgeWriteSourceResponse = {
  ok: true;
  hash: string;
  writtenAt: string;
  absolutePath: string;
};

/** Opaque persist slice — Craft app supplies concrete EditorPersistSlice shape. */
export type CraftBridgePendingImport = {
  id: string;
  createdAt: string;
  slice: Record<string, unknown>;
  /** Playwright viewport used for capture (from live preview push). */
  captureViewport?: { width?: number; height?: number };
  link?: Pick<
    CodeRoundTripLink,
    | "sourcePath"
    | "repoRoot"
    | "cssPaths"
    | "previewUrl"
    | "syncMode"
    | "watchSource"
    | "conflictPolicy"
  >;
  sourceHeader?: string;
  message?: string;
};
