import { jsonV1Data, jsonV1Error } from "@/lib/apiV1Responses";
import { isNonEmptyString, parseJsonBody } from "@/lib/apiV1Validation";
import { commentToDto, mockApiStore } from "@/lib/mockApiStore";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId")?.trim() ?? "";
  if (!fileId) {
    return jsonV1Error("VALIDATION_ERROR", "Query parameter fileId is required", 400);
  }
  if (!mockApiStore.getFile(fileId)) {
    return jsonV1Error("NOT_FOUND", "File not found", 404);
  }
  const list = mockApiStore.listComments(fileId).map(commentToDto);
  return jsonV1Data(list);
}

export async function POST(request: Request) {
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
  if (!isNonEmptyString(o.fileId)) {
    return jsonV1Error("VALIDATION_ERROR", "fileId is required", 400);
  }
  const bodyStr = typeof o.body === "string" ? o.body : "";
  const x = typeof o.x === "number" && !Number.isNaN(o.x) ? o.x : undefined;
  const y = typeof o.y === "number" && !Number.isNaN(o.y) ? o.y : undefined;
  const parentNodeId = typeof o.parentNodeId === "string" && o.parentNodeId.trim() ? o.parentNodeId.trim() : undefined;
  const frameId = typeof o.frameId === "string" && o.frameId.trim() ? o.frameId.trim() : undefined;
  const row = mockApiStore.createComment({
    fileId: o.fileId.trim(),
    body: bodyStr,
    x,
    y,
    parentNodeId,
    frameId,
  });
  if (!row) {
    return jsonV1Error("NOT_FOUND", "File not found", 404);
  }
  return jsonV1Data(commentToDto(row), { status: 201 });
}
