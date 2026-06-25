import { jsonV1Data, jsonV1Error } from "@/lib/apiV1Responses";
import { mockApiStore } from "@/lib/mockApiStore";
import { resolveMockApiSessionUser } from "@/lib/mockApiRequestAuth";
import { mockApiUserDto } from "@/lib/mockApiSession";

export async function GET(request: Request) {
  const user = resolveMockApiSessionUser(request);
  if (!user) {
    return jsonV1Error("UNAUTHORIZED", "Not signed in", 401);
  }
  return jsonV1Data(mockApiUserDto(user));
}

export async function PATCH(request: Request) {
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

  const patch: { displayName?: string; avatarUrl?: string | null } = {};
  if (typeof o.displayName === "string") patch.displayName = o.displayName;
  if (o.removeAvatar === true) patch.avatarUrl = null;

  if (!("displayName" in patch) && !("avatarUrl" in patch)) {
    return jsonV1Error("VALIDATION", "No profile fields to update", 400);
  }

  try {
    const updated = mockApiStore.updateUserProfile(user.id, patch);
    if (!updated) return jsonV1Error("NOT_FOUND", "User not found", 404);
    return jsonV1Data(mockApiUserDto(updated));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not update profile";
    return jsonV1Error("VALIDATION", message, 400);
  }
}
