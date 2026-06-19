/** Browser-safe exports — no node:fs / node:crypto */
export * from "./types";
export * from "./auth";
export {
  classifySyncConflict,
  shouldAutoImportFromSource,
  shouldSurfaceConflict,
  type SyncConflictInput,
  type SyncConflictKind,
} from "./conflict";
export * from "./textDiff";
export * from "./httpClient";
