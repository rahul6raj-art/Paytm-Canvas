import { jsonV1Data, jsonV1Error } from "@/lib/apiV1Responses";
import { parseJsonBody } from "@/lib/apiV1Validation";
import { fileVersionToListDto, mockApiStore } from "@/lib/mockApiStore";
import { validatePaytmCraftDocument } from "@/lib/documentPersistence";

type RouteContext = { params: Promise<{ fileId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { fileId } = await context.params;
  if (!mockApiStore.getFile(fileId)) {
    return jsonV1Error("NOT_FOUND", "File not found", 404);
  }
  const list = mockApiStore.listFileVersions(fileId).map(fileVersionToListDto);
  return jsonV1Data(list);
}

export async function POST(request: Request, context: RouteContext) {
  const { fileId } = await context.params;
  if (!mockApiStore.getFile(fileId)) {
    return jsonV1Error("NOT_FOUND", "File not found", 404);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonV1Error("BAD_REQUEST", "Invalid JSON body", 400);
  }
  const o = parseJsonBody(body);
  if (!o) {
    return jsonV1Error("VALIDATION_ERROR", "Body must be a JSON object", 400);
  }
  if (!Object.prototype.hasOwnProperty.call(o, "documentJson")) {
    return jsonV1Error("VALIDATION_ERROR", "documentJson is required", 400);
  }
  if (!validatePaytmCraftDocument(o.documentJson)) {
    return jsonV1Error("VALIDATION_ERROR", "documentJson must be a valid Paytm Craft document (version 1)", 400);
  }
  const name = Object.prototype.hasOwnProperty.call(o, "name") ? o.name : undefined;
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return jsonV1Error("VALIDATION_ERROR", "name must be a non-empty string when provided", 400);
  }
  const row = mockApiStore.createFileVersion({
    fileId,
    ...(typeof name === "string" ? { name: name.trim() } : {}),
    documentJson: o.documentJson,
  });
  if (!row) {
    return jsonV1Error("NOT_FOUND", "File not found", 404);
  }
  return jsonV1Data(fileVersionToListDto(row), { status: 201 });
}
