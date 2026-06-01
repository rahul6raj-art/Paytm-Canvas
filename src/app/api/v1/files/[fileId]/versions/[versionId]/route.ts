import { jsonV1Data, jsonV1Error } from "@/lib/apiV1Responses";
import { fileVersionToDetailDto, mockApiStore } from "@/lib/mockApiStore";

type RouteContext = { params: Promise<{ fileId: string; versionId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { fileId, versionId } = await context.params;
  if (!mockApiStore.getFile(fileId)) {
    return jsonV1Error("NOT_FOUND", "File not found", 404);
  }
  const row = mockApiStore.getFileVersion(fileId, versionId);
  if (!row) {
    return jsonV1Error("NOT_FOUND", "Version not found", 404);
  }
  return jsonV1Data(fileVersionToDetailDto(row));
}
