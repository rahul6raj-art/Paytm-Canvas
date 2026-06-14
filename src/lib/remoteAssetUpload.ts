import { apiClient } from "@/lib/apiClient";
import type { EditorAsset } from "@/lib/documentPersistence";
import { validateImageImportFile } from "@/lib/editorAssets";

function readNaturalSize(url: string): Promise<{ width: number; height: number } | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (w > 0 && h > 0) resolve({ width: w, height: h });
      else resolve(undefined);
    };
    img.onerror = () => resolve(undefined);
    img.src = url;
  });
}

/**
 * Upload an image to object storage via presigned PUT, then register the asset row.
 * Returns an `EditorAsset` whose `dataUrl` is the public HTTP URL (not a data URL).
 */
export async function uploadImageAssetForWorkspace(workspaceId: string, file: File): Promise<EditorAsset> {
  const err = validateImageImportFile(file);
  if (err) throw new Error(err);

  const contentType = (file.type || "application/octet-stream").toLowerCase();
  const ticket = await apiClient.requestAssetUploadUrl(workspaceId, {
    fileName: file.name || "upload",
    contentType,
  });

  const putRes = await fetch(ticket.url, {
    method: ticket.method || "PUT",
    headers: ticket.headers,
    body: file,
  });
  if (!putRes.ok) {
    throw new Error(`Storage upload failed (${putRes.status})`);
  }

  const completed = await apiClient.completeAssetUpload(workspaceId, {
    assetId: ticket.assetId,
    storageKey: ticket.storageKey,
    fileName: file.name || "upload",
    mime: contentType,
    byteSize: file.size,
  });

  const dims =
    completed.width != null && completed.height != null
      ? { width: completed.width, height: completed.height }
      : await readNaturalSize(completed.url);

  return {
    id: completed.id,
    name: completed.fileName,
    mimeType: completed.mime,
    dataUrl: completed.url,
    createdAt: completed.createdAt,
    width: dims?.width,
    height: dims?.height,
  };
}
