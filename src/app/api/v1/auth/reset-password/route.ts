import { jsonV1Data, jsonV1Error } from "@/lib/apiV1Responses";
import { mockApiStore } from "@/lib/mockApiStore";
import { mockApiUserDto } from "@/lib/mockApiSession";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonV1Error("VALIDATION", "Invalid JSON body", 400);
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!o) return jsonV1Error("VALIDATION", "Body must be a JSON object", 400);

  const token = String(o.token ?? "").trim();
  const newPassword = String(o.newPassword ?? "");
  if (!token || newPassword.length < 8) {
    return jsonV1Error("VALIDATION", "token and newPassword (8+ chars) required", 400);
  }

  try {
    const user = mockApiStore.resetPasswordWithToken(token, newPassword);
    return jsonV1Data(mockApiUserDto(user));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not reset password";
    return jsonV1Error("VALIDATION", message, 400);
  }
}
