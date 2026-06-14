import type { CraftFileDetail } from "@/lib/apiClient";
import { apiClient } from "@/lib/apiClient";
import {
  documentToEditorPatch,
  validatePaytmCraftDocument,
} from "@/lib/documentPersistence";
import { isPaytmCraftHttpApiMode } from "@/lib/env";
import { blankWorkspace } from "@/lib/templates";
import type { EditorPersistSlice } from "@/stores/useEditorStore";
import { useEditorStore } from "@/stores/useEditorStore";

const ROUTE_FILE_ID_PARAM = "fileId";

/** Read `?fileId=` from the current editor URL (browser only). */
export function getRouteApiFileId(search?: string): string | null {
  let query = search;
  if (query === undefined) {
    if (typeof window === "undefined") return null;
    query = window.location.search;
  }
  const raw = new URLSearchParams(query).get(ROUTE_FILE_ID_PARAM);
  const id = raw?.trim();
  return id ? id : null;
}

/** Build `/editor?fileId=…` for deep links in api mode. */
export function editorHrefForApiFile(fileId: string): string {
  return `/editor?${ROUTE_FILE_ID_PARAM}=${encodeURIComponent(fileId)}`;
}

export function persistSliceFromApiFileDetail(detail: CraftFileDetail): EditorPersistSlice {
  const raw = detail.documentJson;
  if (raw != null && validatePaytmCraftDocument(raw)) {
    const patch = documentToEditorPatch(raw);
    return { ...patch, fileName: detail.name };
  }
  const slice = blankWorkspace();
  return { ...slice, fileName: detail.name };
}

/**
 * Load a mock/real API file into the editor store and bind the API sync session.
 * Returns false when the file is missing.
 */
export async function hydrateEditorFromApiFile(fileId: string): Promise<boolean> {
  if (!isPaytmCraftHttpApiMode()) return false;
  const detail = await apiClient.getFile(fileId);
  if (!detail) return false;

  const slice = persistSliceFromApiFileDetail(detail);
  useEditorStore.getState().loadWorkspaceFromPersist(slice, {
    apiFileId: detail.id,
    apiWorkspaceId: detail.workspaceId,
    apiRevision: detail.revision,
  });
  void useEditorStore.getState().loadApiComments();
  return true;
}
