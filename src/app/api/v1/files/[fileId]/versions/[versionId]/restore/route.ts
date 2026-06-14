import { jsonV1Data, jsonV1Error } from "@/lib/apiV1Responses";
import { mockApiStore } from "@/lib/mockApiStore";

type RouteContext = { params: Promise<{ fileId: string; versionId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { fileId, versionId } = await context.params;
  const updated = mockApiStore.restoreFileFromVersion(fileId, versionId);
  if (!updated) {
    return jsonV1Error("NOT_FOUND", "File or version not found", 404);
  }
  return jsonV1Data({
    id: updated.id,
    workspaceId: updated.workspaceId,
    name: updated.name,
    updatedAt: updated.updatedAt,
    createdAt: updated.createdAt,
    documentJson: updated.documentJson,
    revision: updated.revision,
  });
}
