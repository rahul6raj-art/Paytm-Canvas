import { jsonV1Data, jsonV1Error } from "@/lib/apiV1Responses";
import { parseJsonBody } from "@/lib/apiV1Validation";
import { commentToDto, mockApiStore } from "@/lib/mockApiStore";

type RouteContext = { params: Promise<{ commentId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { commentId } = await context.params;
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
  const hasBody = Object.prototype.hasOwnProperty.call(o, "body");
  const hasResolved = Object.prototype.hasOwnProperty.call(o, "resolved");
  if (!hasBody && !hasResolved) {
    return jsonV1Error("VALIDATION_ERROR", "Provide at least one of: body, resolved", 400);
  }
  if (hasBody && typeof o.body !== "string") {
    return jsonV1Error("VALIDATION_ERROR", "body must be a string when provided", 400);
  }
  if (hasResolved && typeof o.resolved !== "boolean") {
    return jsonV1Error("VALIDATION_ERROR", "resolved must be a boolean when provided", 400);
  }
  const next = mockApiStore.updateComment(commentId, {
    body: hasBody ? (o.body as string) : undefined,
    resolved: hasResolved ? (o.resolved as boolean) : undefined,
  });
  if (!next) {
    return jsonV1Error("NOT_FOUND", "Comment not found", 404);
  }
  return jsonV1Data(commentToDto(next));
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { commentId } = await context.params;
  const ok = mockApiStore.deleteComment(commentId);
  if (!ok) {
    return jsonV1Error("NOT_FOUND", "Comment not found", 404);
  }
  return jsonV1Data({ deleted: true as const });
}
