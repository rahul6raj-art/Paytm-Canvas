import type { EditorAsset } from "@/lib/documentPersistence";
import { buildEditorAssetFromFile } from "@/lib/editorAssets";
import { isPaytmCraftRemoteMode } from "@/lib/env";
import { uploadImageAssetForWorkspace } from "@/lib/remoteAssetUpload";

/** Local data URL import, or remote MinIO upload when workspace context is available. */
export async function resolveImageAssetFromFile(
  file: File,
  opts?: { workspaceId?: string },
): Promise<EditorAsset> {
  if (isPaytmCraftRemoteMode() && opts?.workspaceId) {
    return uploadImageAssetForWorkspace(opts.workspaceId, file);
  }
  return buildEditorAssetFromFile(file);
}
