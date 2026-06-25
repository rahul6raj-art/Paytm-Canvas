import { jsonV1Data, jsonV1Error } from "@/lib/apiV1Responses";
import { mockApiStore } from "@/lib/mockApiStore";
import { resolveMockApiSessionUser } from "@/lib/mockApiRequestAuth";
import { mockApiUserDto } from "@/lib/mockApiSession";

export async function POST(request: Request) {
  const user = resolveMockApiSessionUser(request);
  if (!user) {
    return jsonV1Error("UNAUTHORIZED", "Not signed in", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonV1Error("VALIDATION", "Invalid JSON body", 400);
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!o) return jsonV1Error("VALIDATION", "Body must be a JSON object", 400);

  const currentPassword = String(o.currentPassword ?? "");
  const newPassword = String(o.newPassword ?? "");
  if (!currentPassword || newPassword.length < 8) {
    return jsonV1Error("VALIDATION", "currentPassword and newPassword (8+ chars) required", 400);
  }

  try {
    const updated = mockApiStore.changeUserPassword(user.id, currentPassword, newPassword);
    if (!updated) return jsonV1Error("NOT_FOUND", "User not found", 404);
    return jsonV1Data(mockApiUserDto(updated));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not change password";
    const status = message === "Current password is incorrect" ? 401 : 400;
    const code = status === 401 ? "UNAUTHORIZED" : "VALIDATION";
    return jsonV1Error(code, message, status);
  }
}
