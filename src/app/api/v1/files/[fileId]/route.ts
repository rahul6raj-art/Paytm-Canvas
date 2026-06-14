import { jsonV1Data, jsonV1Error } from "@/lib/apiV1Responses";
import { parseJsonBody } from "@/lib/apiV1Validation";
import { mockApiTokenGuard } from "@/lib/mockApiRequestAuth";
import { fileToSummary, mockApiStore } from "@/lib/mockApiStore";

type RouteContext = { params: Promise<{ fileId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const denied = mockApiTokenGuard(request, "GET", { read: "files:read", write: "files:write" });
  if (denied) return denied;
  const { fileId } = await context.params;
  const row = mockApiStore.getFile(fileId);
  if (!row) {
    return jsonV1Error("NOT_FOUND", "File not found", 404);
  }
  return jsonV1Data({
    ...fileToSummary(row),
    createdAt: row.createdAt,
    documentJson: row.documentJson,
    revision: row.revision,
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const denied = mockApiTokenGuard(request, "PUT", { read: "files:read", write: "files:write" });
  if (denied) return denied;
  const { fileId } = await context.params;
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
  const hasName = Object.prototype.hasOwnProperty.call(o, "name");
  const hasDoc = Object.prototype.hasOwnProperty.call(o, "documentJson");
  if (!hasName && !hasDoc) {
    return jsonV1Error("VALIDATION_ERROR", "Provide at least one of: name, documentJson", 400);
  }
  if (hasName && (typeof o.name !== "string" || !o.name.trim())) {
    return jsonV1Error("VALIDATION_ERROR", "name must be a non-empty string when provided", 400);
  }
  const ifMatch = request.headers.get("If-Match")?.trim() || undefined;
  const updated = mockApiStore.updateFile(
    fileId,
    {
      name: hasName ? (o.name as string) : undefined,
      documentJson: hasDoc ? o.documentJson : undefined,
    },
    ifMatch !== undefined ? { ifMatch } : undefined,
  );
  if (!updated.ok) {
    if (updated.code === "NOT_FOUND") {
      return jsonV1Error("NOT_FOUND", "File not found", 404);
    }
    return jsonV1Error(
      "CONFLICT",
      `Revision mismatch (server has revision ${updated.currentRevision})`,
      409,
    );
  }
  const row = updated.row;
  return jsonV1Data({
    ...fileToSummary(row),
    createdAt: row.createdAt,
    documentJson: row.documentJson,
    revision: row.revision,
  });
}
