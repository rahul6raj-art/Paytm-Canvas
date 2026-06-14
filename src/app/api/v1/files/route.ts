import { jsonV1Data, jsonV1Error } from "@/lib/apiV1Responses";
import { isNonEmptyString, parseJsonBody } from "@/lib/apiV1Validation";
import { mockApiTokenGuard } from "@/lib/mockApiRequestAuth";
import { fileToSummary, mockApiStore } from "@/lib/mockApiStore";

export async function GET(request: Request) {
  const denied = mockApiTokenGuard(request, "GET", { read: "files:read", write: "files:write" });
  if (denied) return denied;
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId")?.trim() || undefined;
  if (workspaceId && !mockApiStore.workspaceExists(workspaceId)) {
    return jsonV1Error("NOT_FOUND", "Workspace not found", 404);
  }
  const rows = mockApiStore.listFiles(workspaceId);
  return jsonV1Data(rows.map(fileToSummary));
}

export async function POST(request: Request) {
  const denied = mockApiTokenGuard(request, "POST", { read: "files:read", write: "files:write" });
  if (denied) return denied;
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
  const workspaceId = o.workspaceId;
  const name = o.name;
  if (!isNonEmptyString(workspaceId)) {
    return jsonV1Error("VALIDATION_ERROR", "workspaceId is required", 400);
  }
  if (!mockApiStore.workspaceExists(workspaceId)) {
    return jsonV1Error("NOT_FOUND", "Workspace not found", 404);
  }
  if (!isNonEmptyString(name)) {
    return jsonV1Error("VALIDATION_ERROR", "name is required", 400);
  }
  const hasDoc = Object.prototype.hasOwnProperty.call(o, "documentJson");
  const row = mockApiStore.createFile({
    workspaceId,
    name,
    documentJson: hasDoc ? o.documentJson : undefined,
  });
  return jsonV1Data(fileToSummary(row), { status: 201 });
}
