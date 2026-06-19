export type {
  CodeRoundTripLink,
  CodeRoundTripSyncMode,
  CraftBridgeConflictPolicy,
  CraftBridgePendingImport,
  CraftBridgeWriteSourceRequest,
  CraftBridgeWriteSourceResponse,
  CraftLinkManifest,
} from "@paytm-craft/bridge";

import type { EditorPersistSlice } from "@/lib/documentPersistence";
import type { CraftBridgePendingImport as BasePending } from "@paytm-craft/bridge";

/** Pending import with concrete Craft editor slice shape. */
export type CraftBridgePendingImport = Omit<BasePending, "slice"> & {
  slice: EditorPersistSlice;
};
